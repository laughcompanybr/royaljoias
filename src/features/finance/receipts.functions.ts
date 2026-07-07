import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sanitizeReceiptPath } from "./receipt-validation";

const RECEIPT_BUCKET = "finance-receipts";

const sourceEnum = z.enum(["expense", "transaction", "payment"]);

const filterSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  source: z.enum(["all", "expense", "transaction", "payment"]).default("all"),
  search: z.string().trim().max(120).optional().nullable(),
  // Ref filter — narrow the list to a single record (used to open /anexos
  // already filtered from an order or a financial entry).
  ref_source: sourceEnum.optional().nullable(),
  ref_id: z.string().uuid().optional().nullable(),
  // Or filter by all payments linked to a specific order
  order_id: z.string().uuid().optional().nullable(),
});

export type ReceiptRow = {
  id: string;
  source: "expense" | "transaction" | "payment";
  source_label: string;
  path: string;
  description: string;
  amount: number | null;
  date: string;
  created_by: string | null;
  extra?: string | null;
  order_id?: string | null;
};

/**
 * List every receipt visible to the caller. RLS on each source table
 * already scopes rows to the owner or staff/admin, so this function just
 * unions the three sources and filters client-server on date/source.
 */
export const listReceipts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => filterSchema.parse(v ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const from = data.from ?? null;
    const to = data.to ?? null;
    const src = data.source;
    const ref = data.ref_source && data.ref_id ? { source: data.ref_source, id: data.ref_id } : null;

    const wantExpense = !ref && (src === "all" || src === "expense");
    const wantTx = !ref && (src === "all" || src === "transaction");
    const wantPayment = (!ref && (src === "all" || src === "payment")) || !!data.order_id;

    const runExpense = wantExpense || ref?.source === "expense";
    const runTx = wantTx || ref?.source === "transaction";
    const runPayment = wantPayment || ref?.source === "payment";

    const [exp, tx, pay] = await Promise.all([
      runExpense
        ? (ref?.source === "expense"
            ? supabase
                .from("expenses")
                .select("id, description, amount, category, incurred_at, receipt_url, created_by")
                .eq("id", ref.id)
                .not("receipt_url", "is", null)
            : supabase
                .from("expenses")
                .select("id, description, amount, category, incurred_at, receipt_url, created_by")
                .not("receipt_url", "is", null)
                .order("incurred_at", { ascending: false })
                .limit(500))
        : Promise.resolve({ data: [], error: null }),
      runTx
        ? (ref?.source === "transaction"
            ? supabase
                .from("financial_transactions")
                .select("id, description, amount, category, direction, paid_at, due_date, receipt_url, created_by")
                .eq("id", ref.id)
                .not("receipt_url", "is", null)
            : supabase
                .from("financial_transactions")
                .select("id, description, amount, category, direction, paid_at, due_date, receipt_url, created_by")
                .not("receipt_url", "is", null)
                .order("created_at", { ascending: false })
                .limit(500))
        : Promise.resolve({ data: [], error: null }),
      runPayment
        ? (() => {
            let q = supabase
              .from("payments")
              .select("id, amount, direction, paid_at, notes, receipt_url, created_by, order_id, orders(order_number)")
              .not("receipt_url", "is", null);
            if (ref?.source === "payment") q = q.eq("id", ref.id);
            if (data.order_id) q = q.eq("order_id", data.order_id);
            return q.order("paid_at", { ascending: false }).limit(500);
          })()
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (exp.error) throw exp.error;
    if (tx.error) throw tx.error;
    if (pay.error) throw pay.error;

    const rows: ReceiptRow[] = [];

    for (const r of exp.data ?? []) {
      if (!r.receipt_url) continue;
      const d = r.incurred_at;
      if (from && d < from) continue;
      if (to && d > to) continue;
      rows.push({
        id: r.id,
        source: "expense",
        source_label: "Despesa",
        path: r.receipt_url,
        description: r.description ?? "Despesa",
        amount: Number(r.amount ?? 0),
        date: d,
        created_by: r.created_by ?? null,
        extra: r.category ?? null,
      });
    }
    for (const r of tx.data ?? []) {
      if (!r.receipt_url) continue;
      const d = (r.paid_at ?? r.due_date ?? "").slice(0, 10);
      if (from && d && d < from) continue;
      if (to && d && d > to) continue;
      rows.push({
        id: r.id,
        source: "transaction",
        source_label: r.direction === "in" ? "Receita" : "Despesa (Mov.)",
        path: r.receipt_url,
        description: r.description ?? "Movimento",
        amount: Number(r.amount ?? 0),
        date: d,
        created_by: r.created_by ?? null,
        extra: r.category ?? null,
      });
    }
    for (const r of pay.data ?? []) {
      if (!r.receipt_url) continue;
      const d = (r.paid_at ?? "").slice(0, 10);
      if (from && d && d < from) continue;
      if (to && d && d > to) continue;
      const orderNumber = (r.orders as { order_number?: string } | null)?.order_number;
      rows.push({
        id: r.id,
        source: "payment",
        source_label: r.direction === "in" ? "Recebimento" : "Pagamento",
        path: r.receipt_url,
        description: orderNumber ? `Pedido #${orderNumber}` : (r.notes ?? "Pagamento"),
        amount: Number(r.amount ?? 0),
        date: d,
        created_by: r.created_by ?? null,
        extra: r.notes ?? null,
        order_id: r.order_id ?? null,
      });
    }

    const search = (data.search ?? "").toLowerCase().trim();
    const filtered = search
      ? rows.filter((r) =>
          [r.description, r.extra, r.source_label, r.path]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(search)),
        )
      : rows;

    filtered.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
    return filtered.slice(0, 500);
  });

/**
 * Return a short-lived signed URL for a receipt, only if the caller can
 * actually read it under storage RLS. We validate the path shape first,
 * then rely on Supabase Storage's signed-URL endpoint (which checks the
 * caller's SELECT policy) and log the access for auditing.
 */
export const getReceiptSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) =>
    z
      .object({
        path: z.string().min(1).max(500),
        expires_in: z.number().int().min(30).max(3600).default(600),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    const clean = sanitizeReceiptPath(data.path);
    if (!clean) throw new Error("Caminho inválido");

    const { data: signed, error } = await context.supabase.storage
      .from(RECEIPT_BUCKET)
      .createSignedUrl(clean, data.expires_in);
    if (error || !signed) {
      // Do not leak the raw storage error to the client — it may reveal
      // whether the object exists to a caller who shouldn't know.
      throw new Error("Comprovante indisponível ou acesso negado");
    }

    // Audit access (best-effort — never blocks the download)
    await context.supabase
      .from("audit_log")
      .insert({
        table_name: "storage.objects",
        record_id: clean,
        operation: "RECEIPT_ACCESSED",
        actor: context.userId,
        new_data: { bucket: RECEIPT_BUCKET, expires_in: data.expires_in },
      })
      .then(() => undefined, () => undefined);

    return { url: signed.signedUrl, expires_in: data.expires_in };
  });

/**
 * Remove a receipt from the corresponding record. RLS on the source table
 * enforces that only the owner (or staff/admin) can UPDATE the row, so a
 * caller without access will fail here even before we touch storage.
 * We clear receipt_url in the source row, then remove the storage object,
 * and record the deletion in audit_log so it stays traceable.
 */
export const deleteReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) =>
    z
      .object({
        source: sourceEnum,
        id: z.string().uuid(),
        path: z.string().min(1).max(500),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    const clean = sanitizeReceiptPath(data.path);
    if (!clean) throw new Error("Caminho inválido");
    const table =
      data.source === "expense"
        ? "expenses"
        : data.source === "transaction"
        ? "financial_transactions"
        : "payments";

    // 1. Clear receipt_url on the owning record (RLS-checked).
    const { data: updated, error: updErr } = await context.supabase
      .from(table)
      .update({ receipt_url: null })
      .eq("id", data.id)
      .eq("receipt_url", clean)
      .select("id")
      .maybeSingle();

    if (updErr) throw new Error("Não foi possível remover: acesso negado ou registro alterado");
    if (!updated) throw new Error("Registro não encontrado ou já atualizado");

    // 2. Remove the file from storage (RLS-checked; failures are non-fatal
    //    because the row no longer references the object).
    const { error: rmErr } = await context.supabase.storage
      .from(RECEIPT_BUCKET)
      .remove([clean]);

    // 3. Audit-log the deletion regardless of storage outcome.
    await context.supabase
      .from("audit_log")
      .insert({
        table_name: "storage.objects",
        record_id: clean,
        operation: "RECEIPT_DELETED",
        actor: context.userId,
        old_data: {
          bucket: RECEIPT_BUCKET,
          source: data.source,
          source_id: data.id,
          storage_removed: !rmErr,
          storage_error: rmErr?.message ?? null,
        },
      })
      .then(() => undefined, () => undefined);

    return { ok: true };
  });
