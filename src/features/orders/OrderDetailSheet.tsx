import { useCallback, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getOrder,
  updateOrder,
  changeOrderStatus,
  addMixedPayments,
  deletePayment,
  addOrderAttachment,
  deleteOrderAttachment,
  signOrderAttachment,
} from "./orders.functions";
import { getCardFeePercent } from "@/features/settings/settings.functions";
import {
  ORDER_STATUS,
  STATUS_LABEL,
  STATUS_TONE,
  PAYMENT_METHODS,
  type OrderPayload,
  type PaymentMethod,
} from "./schemas";

import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Paperclip,
  Upload,
  Download,
  Trash2,
  Activity,
  Wallet,
  Truck,
  Pencil,
  Copy,
  Plus,
  ArrowDownCircle,
  ArrowUpCircle,
  Package,
  ExternalLink,
} from "lucide-react";
import { OrderForm } from "./OrderForm";
import { formatBRL, formatDate } from "@/lib/format";

interface Props {
  orderId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

function formatBytes(n: number | null | undefined) {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const EVENT_LABEL: Record<string, string> = {
  created: "Pedido criado",
  status_changed: "Status alterado",
  payment: "Pagamento",
  attachment: "Anexo",
};

export function OrderDetailSheet({ orderId, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const getFn = useServerFn(getOrder);
  const updateFn = useServerFn(updateOrder);
  const statusFn = useServerFn(changeOrderStatus);
  const addMixedFn = useServerFn(addMixedPayments);
  const delPayFn = useServerFn(deletePayment);
  const cardFeeFn = useServerFn(getCardFeePercent);
  const addAttachFn = useServerFn(addOrderAttachment);
  const delAttachFn = useServerFn(deleteOrderAttachment);
  const signFn = useServerFn(signOrderAttachment);

  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const query = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => getFn({ data: { id: orderId! } }),
    enabled: !!orderId && open,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["order", orderId] });
    qc.invalidateQueries({ queryKey: ["orders"] });
  };

  const updateMut = useMutation({
    mutationFn: (v: OrderPayload) => updateFn({ data: { id: orderId!, ...v } as never }),
    onSuccess: () => { toast.success("Pedido atualizado"); setEditing(false); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMut = useMutation({
    mutationFn: (status: (typeof ORDER_STATUS)[number]) => statusFn({ data: { id: orderId!, status } }),
    onSuccess: () => { toast.success("Status atualizado"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const cardFeeQ = useQuery({ queryKey: ["settings", "card-fee-percent"], queryFn: () => cardFeeFn(), staleTime: 5 * 60_000 });

  const addMixedMut = useMutation({
    mutationFn: (v: { entries: MixedEntry[]; expected_total: number }) =>
      addMixedFn({
        data: {
          order_id: orderId!,
          expected_total: v.expected_total,
          entries: v.entries.map((e) => ({
            direction: e.direction,
            amount: e.amount,
            method: e.method,
            installments: e.installments ?? null,
            card_fee: e.card_fee,
            card_fee_percent: e.card_fee_percent ?? null,
            paid_at: e.paid_at,
            notes: e.notes ?? "",
          })),
        } as never,
      }),
    onSuccess: (r) => { toast.success(`${r.count} pagamento(s) registrado(s)`); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const delPayMut = useMutation({
    mutationFn: (id: string) => delPayFn({ data: { id } }),
    onSuccess: () => { toast.success("Pagamento removido"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const delAttachMut = useMutation({
    mutationFn: (v: { id: string; storage_path: string }) => delAttachFn({ data: v }),
    onSuccess: () => { toast.success("Anexo removido"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleUpload = useCallback(async (file: File) => {
    if (!orderId) return;
    if (file.size > 15 * 1024 * 1024) return toast.error("Arquivo excede 15MB");
    setUploading(true);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${orderId}/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage.from("order-files").upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      await addAttachFn({
        data: { order_id: orderId, storage_path: path, filename: file.name, mime: file.type || null, size: file.size, kind: null },
      });
      toast.success("Anexo enviado");
      invalidate();
    } catch (e) { toast.error((e as Error).message); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  }, [orderId, addAttachFn]); // eslint-disable-line

  const handleDownload = async (storage_path: string, filename: string | null) => {
    try {
      const { url } = await signFn({ data: { storage_path } });
      const a = document.createElement("a");
      a.href = url; a.download = filename ?? "arquivo"; a.target = "_blank"; a.rel = "noopener";
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) { toast.error((e as Error).message); }
  };

  const order = query.data?.order;
  const client = order?.clients as { name?: string; whatsapp?: string | null; instagram?: string | null } | null;
  const supplier = order?.suppliers as { name?: string; company?: string | null; whatsapp?: string | null } | null;
  const totals = query.data?.totals;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <SheetTitle className="font-display text-2xl">
              {query.isLoading ? "Carregando..." : `Pedido #${order?.order_number ?? "—"}`}
            </SheetTitle>
            {order ? (
              <Badge className={STATUS_TONE[order.status]}>{STATUS_LABEL[order.status]}</Badge>
            ) : null}
          </div>
          {order ? (
            <p className="text-sm text-muted-foreground">
              {[order.brand, order.model].filter(Boolean).join(" ") || "Sem descrição"} · {client?.name ?? "Sem cliente"}
            </p>
          ) : null}
        </SheetHeader>

        {query.isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-gold" /></div>
        ) : order && totals ? (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatBox label="Venda" value={formatBRL(order.sale_price)} />
              <StatBox label="Custo" value={formatBRL(order.cost_price)} />
              <StatBox label="Lucro" value={formatBRL(totals.profit)} tone={totals.profit >= 0 ? "positive" : "negative"} />
              <StatBox label="Saldo a receber" value={formatBRL(totals.balance)} tone={totals.balance > 0 ? "warning" : "positive"} />
            </div>

            <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-card/40 p-3">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Status</Label>
              <Select value={order.status} onValueChange={(v) => statusMut.mutate(v as (typeof ORDER_STATUS)[number])}>
                <SelectTrigger className="max-w-[220px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ORDER_STATUS.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                </SelectContent>
              </Select>
              {statusMut.isPending ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
            </div>

            <Tabs defaultValue="info" className="mt-6">
              <TabsList className="w-full">
                <TabsTrigger value="info" className="flex-1">Dados</TabsTrigger>
                <TabsTrigger value="payments" className="flex-1">
                  <Wallet className="mr-1 size-3.5" /> Pagamentos ({query.data?.payments.length ?? 0})
                </TabsTrigger>
                <TabsTrigger value="tracking" className="flex-1">
                  <Truck className="mr-1 size-3.5" /> Rastreio
                </TabsTrigger>
                <TabsTrigger value="attachments" className="flex-1">
                  <Paperclip className="mr-1 size-3.5" /> Anexos ({query.data?.attachments.length ?? 0})
                </TabsTrigger>
                <TabsTrigger value="timeline" className="flex-1">
                  <Activity className="mr-1 size-3.5" /> Timeline
                </TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="mt-4">
                {editing ? (
                  <OrderForm
                    defaultValues={{
                      client_id: order.client_id ?? "",
                      supplier_id: order.supplier_id ?? "",
                      brand: order.brand ?? "",
                      model: order.model ?? "",
                      reference: order.reference ?? "",
                      photo_path: order.photo_path ?? "",
                      quantity: order.quantity ?? 1,
                      sale_price: order.sale_price,
                      cost_price: order.cost_price,
                      commission: order.commission ?? 0,
                      card_fee: order.card_fee ?? 0,
                      shipping: order.shipping ?? 0,
                      other_costs: order.other_costs ?? 0,
                      amount_received: order.amount_received,
                      payment_method: order.payment_method ?? "",
                      purchase_date: order.purchase_date ?? "",
                      expected_delivery: order.expected_delivery ?? "",
                      tracking_code: order.tracking_code ?? "",
                      status: order.status,
                      ship_zip: order.ship_zip ?? "",
                      ship_street: order.ship_street ?? "",
                      ship_number: order.ship_number ?? "",
                      ship_complement: order.ship_complement ?? "",
                      ship_district: order.ship_district ?? "",
                      ship_city: order.ship_city ?? "",
                      ship_state: order.ship_state ?? "",
                      ship_reference: order.ship_reference ?? "",
                      notes: order.notes ?? "",
                    }}
                    submitLabel="Salvar alterações"
                    onSubmit={async (v) => { await updateMut.mutateAsync(v); }}
                    onCancel={() => setEditing(false)}
                  />

                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-end">
                      <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                        <Pencil className="mr-2 size-3.5" /> Editar
                      </Button>
                    </div>

                    {query.data?.photoUrl ? (
                      <div className="overflow-hidden rounded-xl border border-border bg-muted/30">
                        <img src={query.data.photoUrl} alt={order.model ?? "Relógio"} className="max-h-72 w-full object-contain" />
                      </div>
                    ) : null}

                    <dl className="grid grid-cols-2 gap-4 text-sm">
                      <Info label="Cliente" value={client?.name} />
                      <Info label="Fornecedor" value={supplier?.name} />
                      <Info label="Marca" value={order.brand} />
                      <Info label="Modelo" value={order.model} />
                      <Info label="Referência" value={order.reference} />
                      <Info label="Quantidade" value={String(order.quantity ?? 1)} />
                      <Info label="Forma de pagamento" value={order.payment_method} />
                      <Info label="Data da compra" value={formatDate(order.purchase_date)} />
                      <Info label="Previsão de entrega" value={formatDate(order.expected_delivery)} />
                      <Info label="Criado em" value={formatDate(order.created_at)} />
                    </dl>

                    <div className="rounded-xl border border-border bg-card/40 p-4">
                      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Resumo financeiro</p>
                      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                        <Info label="Total venda" value={formatBRL(totals.totalSale)} />
                        <Info label="Total custo" value={formatBRL(totals.totalCost)} />
                        <Info label="Comissão" value={formatBRL(order.commission)} />
                        <Info label="Taxa cartão" value={formatBRL(order.card_fee)} />
                        <Info label="Frete" value={formatBRL(order.shipping)} />
                        <Info label="Outras despesas" value={formatBRL(order.other_costs)} />
                        <Info label="Lucro bruto" value={formatBRL(totals.grossProfit)} />
                        <Info label="Lucro líquido" value={formatBRL(totals.netProfit)} />
                        <Info label="Recebido" value={formatBRL(totals.totalIn)} />
                        <Info label="Pendente" value={formatBRL(totals.balance)} />
                      </div>
                    </div>

                    {(order.ship_zip || order.ship_street || order.ship_city) ? (
                      <div className="rounded-xl border border-border bg-card/40 p-4">
                        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Endereço de entrega</p>
                        <dl className="grid grid-cols-2 gap-3 text-sm">
                          <Info label="CEP" value={order.ship_zip} />
                          <Info
                            label="Endereço"
                            value={[order.ship_street, order.ship_number, order.ship_complement].filter(Boolean).join(", ") || null}
                          />
                          <Info label="Bairro" value={order.ship_district} />
                          <Info label="Cidade / UF" value={[order.ship_city, order.ship_state].filter(Boolean).join(" / ") || null} />
                          <Info label="Referência" value={order.ship_reference} />
                        </dl>
                      </div>
                    ) : null}

                    {order.notes ? (
                      <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Observações</p>
                        <p className="mt-1 whitespace-pre-wrap">{order.notes}</p>
                      </div>
                    ) : null}
                  </div>
                )}

              </TabsContent>

              <TabsContent value="payments" className="mt-4">
                <MixedPaymentForm
                  defaultCardFeePercent={cardFeeQ.data?.percent ?? 3.49}
                  suggestedTotal={Math.max(0, totals.balance)}
                  onSubmit={async (v) => { await addMixedMut.mutateAsync(v); }}
                />
                <div className="mt-4">
                  {query.data?.payments.length ? (
                    <ul className="divide-y divide-border rounded-lg border border-border">
                      {query.data.payments.map((p) => (
                        <li key={p.id} className="flex items-center gap-3 p-3 text-sm">
                          {p.direction === "in" ? (
                            <ArrowDownCircle className="size-5 text-emerald-500" />
                          ) : (
                            <ArrowUpCircle className="size-5 text-destructive" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">{formatBRL(p.amount)}</p>
                            <p className="text-xs text-muted-foreground">
                              {p.method ?? "—"}
                              {p.installments ? ` · ${p.installments}x` : ""}
                              {" · "}{formatDate(p.paid_at)}
                            </p>
                            {(p.card_fee_percent ?? null) !== null && Number(p.card_fee_percent) > 0 ? (
                              <p className="text-[11px] text-muted-foreground">
                                Taxa {Number(p.card_fee_percent).toFixed(2)}% = {formatBRL(p.card_fee)}
                              </p>
                            ) : null}
                            {p.notes ? <p className="mt-0.5 text-xs text-muted-foreground">{p.notes}</p> : null}
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => { if (confirm("Remover pagamento?")) delPayMut.mutate(p.id); }}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="py-8 text-center text-sm text-muted-foreground">Nenhum pagamento registrado.</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="tracking" className="mt-4 space-y-4">
                <div className="rounded-xl border border-border bg-card/40 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Código de rastreio</p>
                  {order.tracking_code ? (
                    <div className="mt-2 flex items-center gap-2">
                      <code className="rounded bg-muted px-2 py-1 font-mono text-sm">{order.tracking_code}</code>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          navigator.clipboard.writeText(order.tracking_code!);
                          toast.success("Copiado");
                        }}
                      >
                        <Copy className="size-4" />
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <a
                          href={`https://rastreamento.correios.com.br/app/index.php?objeto=${encodeURIComponent(order.tracking_code)}`}
                          target="_blank"
                          rel="noopener"
                        >
                          <ExternalLink className="mr-1 size-3.5" /> Correios
                        </a>
                      </Button>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">Nenhum código informado.</p>
                  )}
                </div>
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <Info label="Data da compra" value={formatDate(order.purchase_date)} />
                  <Info label="Previsão de entrega" value={formatDate(order.expected_delivery)} />
                </dl>
              </TabsContent>

              <TabsContent value="attachments" className="mt-4 space-y-3">
                <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => fileRef.current?.click()} disabled={uploading} className="flex-1">
                    {uploading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Upload className="mr-2 size-4" />}
                    Enviar anexo
                  </Button>
                  <Button asChild variant="outline">
                    <a
                      href={`/anexos?order_id=${order.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="mr-2 size-4" /> Comprovantes financeiros
                    </a>
                  </Button>
                </div>

                {query.data?.attachments.length ? (
                  <ul className="divide-y divide-border rounded-lg border border-border">
                    {query.data.attachments.map((a) => (
                      <li key={a.id} className="flex items-center gap-3 p-3">
                        <Paperclip className="size-4 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{a.filename ?? "arquivo"}</p>
                          <p className="text-xs text-muted-foreground">{formatBytes(a.size)} · {formatDate(a.created_at)}</p>
                        </div>
                        <Button size="icon" variant="ghost" onClick={() => handleDownload(a.storage_path, a.filename)}>
                          <Download className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => { if (confirm("Remover anexo?")) delAttachMut.mutate({ id: a.id, storage_path: a.storage_path }); }}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">Nenhum anexo enviado.</p>
                )}
              </TabsContent>

              <TabsContent value="timeline" className="mt-4">
                {query.data?.events.length ? (
                  <ol className="relative ml-3 border-l border-border">
                    {query.data.events.map((e) => (
                      <li key={e.id} className="mb-4 ml-4">
                        <span className="absolute -left-1.5 mt-1.5 flex size-3 items-center justify-center rounded-full bg-gold" />
                        <p className="text-sm font-medium">
                          {EVENT_LABEL[e.type] ?? e.type}{" "}
                          <span className="text-muted-foreground">· {formatDate(e.created_at)}</span>
                        </p>
                        {e.message ? <p className="text-sm text-muted-foreground">{e.message}</p> : null}
                        <TimelineMeta type={e.type} meta={e.meta as Record<string, unknown> | null} />
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">Sem eventos registrados.</p>
                )}
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Info({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-foreground">{value || "—"}</dd>
    </div>
  );
}

function StatBox({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "positive" | "negative" | "warning" }) {
  const cls =
    tone === "positive" ? "text-emerald-500" :
    tone === "negative" ? "text-destructive" :
    tone === "warning" ? "text-amber-500" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card/40 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-base ${cls}`}>{value}</p>
    </div>
  );
}

const CARD_METHODS: readonly PaymentMethod[] = ["Cartão de Crédito", "Cartão de Débito"];

interface MixedEntry {
  direction: "in" | "out";
  method: PaymentMethod;
  amount: number;
  installments: number | null;
  card_fee_percent: number | null;
  card_fee: number;
  paid_at: string;
  notes: string;
}

function makeEntry(method: PaymentMethod, direction: "in" | "out", cardPct: number): MixedEntry {
  const isCard = CARD_METHODS.includes(method);
  return {
    direction,
    method,
    amount: 0,
    installments: isCard ? 1 : null,
    card_fee_percent: isCard ? cardPct : null,
    card_fee: 0,
    paid_at: new Date().toISOString().slice(0, 10),
    notes: "",
  };
}

function TimelineMeta({ type, meta }: { type: string; meta: Record<string, unknown> | null }) {
  if (!meta) return null;
  if (type === "status_changed" && "from" in meta && "to" in meta) {
    return (
      <p className="mt-0.5 text-xs text-muted-foreground">
        <code className="rounded bg-muted px-1">{String(meta.from)}</code>
        {" → "}
        <code className="rounded bg-muted px-1">{String(meta.to)}</code>
      </p>
    );
  }
  if (type === "values_changed") {
    const entries = Object.entries(meta);
    return (
      <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
        {entries.map(([k, v]) => {
          const change = v as { from?: unknown; to?: unknown };
          return (
            <li key={k}>
              <span className="font-medium">{k}</span>:{" "}
              <code className="rounded bg-muted px-1">{String(change.from ?? "—")}</code>
              {" → "}
              <code className="rounded bg-muted px-1">{String(change.to ?? "—")}</code>
            </li>
          );
        })}
      </ul>
    );
  }
  return null;
}

function MixedPaymentForm({
  defaultCardFeePercent,
  suggestedTotal,
  onSubmit,
}: {
  defaultCardFeePercent: number;
  suggestedTotal: number;
  onSubmit: (v: { entries: MixedEntry[]; expected_total: number }) => Promise<void>;
}) {
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [entries, setEntries] = useState<MixedEntry[]>([]);
  const [expectedTotal, setExpectedTotal] = useState<number>(suggestedTotal);
  const [submitting, setSubmitting] = useState(false);

  // Sync suggested total when it changes (e.g. after a payment is inserted)
  useMemo(() => {
    setExpectedTotal(suggestedTotal);
  }, [suggestedTotal]);

  const sum = entries.reduce((a, b) => a + Number(b.amount || 0), 0);
  const diff = expectedTotal - sum;

  function toggleMethod(m: PaymentMethod) {
    setEntries((prev) => {
      const exists = prev.find((e) => e.method === m);
      if (exists) return prev.filter((e) => e.method !== m);
      return [...prev, makeEntry(m, direction, defaultCardFeePercent)];
    });
  }

  function updateEntry(idx: number, patch: Partial<MixedEntry>) {
    setEntries((prev) => {
      const next = [...prev];
      const merged = { ...next[idx], ...patch };
      if (CARD_METHODS.includes(merged.method)) {
        const pct = merged.card_fee_percent ?? 0;
        merged.card_fee = Number(((merged.amount || 0) * pct / 100).toFixed(2));
      } else {
        merged.card_fee = 0;
        merged.card_fee_percent = null;
      }
      next[idx] = merged;
      return next;
    });
  }

  function changeDirection(v: "in" | "out") {
    setDirection(v);
    setEntries((prev) => prev.map((e) => ({ ...e, direction: v })));
  }

  async function handleSubmit() {
    if (!entries.length) {
      toast.error("Selecione ao menos uma forma de pagamento");
      return;
    }
    if (entries.some((e) => !e.amount || e.amount <= 0)) {
      toast.error("Informe o valor de cada pagamento");
      return;
    }
    if (expectedTotal > 0 && Math.abs(diff) > 0.01) {
      toast.error(`A soma (${formatBRL(sum)}) não confere com o total (${formatBRL(expectedTotal)}).`);
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({ entries, expected_total: expectedTotal });
      setEntries([]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card/40 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Registrar pagamento</p>
        <div className="ml-auto flex items-center gap-2">
          <Label className="text-xs">Tipo</Label>
          <Select value={direction} onValueChange={(v) => changeDirection(v as "in" | "out")}>
            <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="in">Entrada</SelectItem>
              <SelectItem value="out">Saída</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mb-3">
        <Label className="text-xs">Formas de pagamento (selecione uma ou mais)</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {PAYMENT_METHODS.map((m) => {
            const active = entries.some((e) => e.method === m);
            return (
              <button
                key={m}
                type="button"
                onClick={() => toggleMethod(m)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40"
                }`}
              >
                {m}
              </button>
            );
          })}
        </div>
      </div>

      {entries.length > 0 ? (
        <div className="space-y-3">
          {entries.map((e, idx) => {
            const isCard = CARD_METHODS.includes(e.method);
            return (
              <div key={e.method} className="rounded-lg border border-border bg-background p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium">{e.method}</p>
                  <Button size="icon" variant="ghost" onClick={() => toggleMethod(e.method)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-6">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs">Valor recebido</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={e.amount || ""}
                      onChange={(ev) => updateEntry(idx, { amount: parseFloat(ev.target.value) || 0 })}
                    />
                  </div>
                  {isCard ? (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Parcelas</Label>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          value={e.installments ?? 1}
                          onChange={(ev) => updateEntry(idx, { installments: parseInt(ev.target.value, 10) || 1 })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Taxa (%)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={e.card_fee_percent ?? 0}
                          onChange={(ev) => updateEntry(idx, { card_fee_percent: parseFloat(ev.target.value) || 0 })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Taxa (R$)</Label>
                        <Input value={formatBRL(e.card_fee)} readOnly className="bg-muted/40" />
                      </div>
                    </>
                  ) : null}
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs">Data</Label>
                    <Input
                      type="date"
                      value={e.paid_at}
                      onChange={(ev) => updateEntry(idx, { paid_at: ev.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-6">
                    <Label className="text-xs">Observações</Label>
                    <Input
                      value={e.notes}
                      onChange={(ev) => updateEntry(idx, { notes: ev.target.value })}
                      placeholder="Opcional"
                    />
                  </div>
                </div>
              </div>
            );
          })}

          <div className="grid gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-3 text-sm sm:grid-cols-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total esperado</p>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={expectedTotal || ""}
                onChange={(e) => setExpectedTotal(parseFloat(e.target.value) || 0)}
                className="mt-1 h-9"
              />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Soma dos pagamentos</p>
              <p className="mt-1 font-display text-base">{formatBRL(sum)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Diferença</p>
              <p
                className={`mt-1 font-display text-base ${
                  Math.abs(diff) < 0.01
                    ? "text-emerald-500"
                    : diff > 0
                    ? "text-amber-500"
                    : "text-destructive"
                }`}
              >
                {formatBRL(diff)}
              </p>
            </div>
            <div className="flex items-end">
              <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plus className="mr-2 size-4" />}
                Registrar {entries.length > 1 ? `${entries.length} pagamentos` : "pagamento"}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
          Selecione as formas de pagamento acima para começar. Ex.: PIX + Cartão para pagamento misto.
        </p>
      )}
    </div>
  );
}

// unused-suppress: keep icon import used only if attachments empty
void Package;
