import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  productSchema,
  productFilterSchema,
  stockAdjustSchema,
} from "./schemas";

const idInput = z.object({ id: z.string().uuid() });

export const listProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => productFilterSchema.parse(v ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;

    let q = supabase
      .from("products")
      .select(
        "id, name, sku, category, cost_price, sale_price, stock_qty, min_stock, status, image_url, deleted_at, created_at, updated_at",
        { count: "exact" },
      );

    if (!data.includeDeleted) q = q.is("deleted_at", null);
    if (data.status) q = q.eq("status", data.status);
    if (data.category) q = q.eq("category", data.category);
    if (data.search) {
      const s = data.search.replace(/[%,]/g, " ").trim();
      q = q.or(`name.ilike.%${s}%,sku.ilike.%${s}%,category.ilike.%${s}%`);
    }
    if (data.availability === "in_stock") q = q.gt("stock_qty", 0);
    else if (data.availability === "out") q = q.eq("stock_qty", 0);
    // 'low' is filtered client-side (stock_qty <= min_stock is per-row)

    q = q.order(data.sort, { ascending: data.order === "asc", nullsFirst: false }).range(from, to);

    const { data: rows, error, count } = await q;
    if (error) throw error;

    let filtered = rows ?? [];
    if (data.availability === "low") {
      filtered = filtered.filter((r) => (r.stock_qty ?? 0) <= (r.min_stock ?? 0));
    }
    return { rows: filtered, count: count ?? 0, page: data.page, pageSize: data.pageSize };
  });

export const getProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => idInput.parse(v))
  .handler(async ({ data, context }) => {
    const [productRes, movementsRes] = await Promise.all([
      context.supabase.from("products").select("*").eq("id", data.id).maybeSingle(),
      context.supabase
        .from("product_movements")
        .select("id, type, qty, qty_after, reason, order_id, created_at, actor")
        .eq("product_id", data.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    if (productRes.error) throw productRes.error;
    if (!productRes.data) throw new Error("Produto não encontrado");
    return { product: productRes.data, movements: movementsRes.data ?? [] };
  });

export const createProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => productSchema.parse(v))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("products")
      .insert({ ...data, created_by: context.userId })
      .select("id")
      .single();
    if (error) throw error;
    return { id: row.id };
  });

export const updateProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => productSchema.extend({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error } = await context.supabase.from("products").update(rest).eq("id", id);
    if (error) throw error;
    return { ok: true };
  });

export const softDeleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => idInput.parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("products")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const restoreProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => idInput.parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("products")
      .update({ deleted_at: null })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const adjustStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => stockAdjustSchema.parse(v))
  .handler(async ({ data, context }) => {
    const { data: newQty, error } = await context.supabase.rpc("adjust_product_stock", {
      _product_id: data.product_id,
      _type: data.type,
      _qty: data.qty,
      _reason: data.reason ?? "",
    });
    if (error) throw error;
    return { stock_qty: newQty };
  });

export const listProductMovements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) =>
    z
      .object({
        product_id: z.string().uuid(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(5).max(100).default(20),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    const { data: rows, error, count } = await context.supabase
      .from("product_movements")
      .select("id, type, qty, qty_after, reason, order_id, created_at", { count: "exact" })
      .eq("product_id", data.product_id)
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) throw error;
    return { rows: rows ?? [], count: count ?? 0, page: data.page, pageSize: data.pageSize };
  });

export const listCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("products")
      .select("category")
      .not("category", "is", null)
      .is("deleted_at", null)
      .limit(500);
    if (error) throw error;
    const set = new Set<string>();
    (data ?? []).forEach((r) => r.category && set.add(r.category));
    return Array.from(set).sort();
  });

/** Lightweight list for order picker */
export const searchProductOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) =>
    z.object({ search: z.string().trim().max(120).optional() }).parse(v ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("products")
      .select("id, name, sku, sale_price, cost_price, stock_qty, min_stock, status")
      .is("deleted_at", null)
      .eq("status", "active")
      .order("name")
      .limit(30);
    if (data.search) {
      const s = data.search.replace(/[%,]/g, " ").trim();
      q = q.or(`name.ilike.%${s}%,sku.ilike.%${s}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const countLowStock = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("products")
      .select("id, name, stock_qty, min_stock")
      .is("deleted_at", null)
      .eq("status", "active");
    if (error) throw error;
    const low = (data ?? []).filter((r) => (r.stock_qty ?? 0) <= (r.min_stock ?? 0));
    return {
      count: low.length,
      top: low
        .sort((a, b) => (a.stock_qty ?? 0) - (b.stock_qty ?? 0))
        .slice(0, 5)
        .map((r) => ({ id: r.id, name: r.name, stock_qty: r.stock_qty, min_stock: r.min_stock })),
    };
  });
