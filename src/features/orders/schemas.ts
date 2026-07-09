import { z } from "zod";

export const ORDER_STATUS = [
  "new",
  "awaiting_deposit",
  "partial_payment",
  "paid",
  "purchasing",
  "separating",
  "in_transit",
  "shipped",
  "received",
  "ready_delivery",
  "delivered",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUS)[number];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  new: "Novo",
  awaiting_deposit: "Aguardando pagamento",
  partial_payment: "Pagamento parcial",
  paid: "Pago",
  purchasing: "Em compra",
  separating: "Separando pedido",
  in_transit: "Em trânsito",
  shipped: "Enviado",
  received: "Recebido",
  ready_delivery: "Pronto p/ entrega",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

export const STATUS_TONE: Record<OrderStatus, string> = {
  new: "bg-muted text-foreground",
  awaiting_deposit: "bg-amber-500/15 text-amber-500",
  partial_payment: "bg-amber-500/15 text-amber-400",
  paid: "bg-blue-500/15 text-blue-500",
  purchasing: "bg-indigo-500/15 text-indigo-400",
  separating: "bg-indigo-500/15 text-indigo-300",
  in_transit: "bg-cyan-500/15 text-cyan-400",
  shipped: "bg-cyan-500/15 text-cyan-300",
  received: "bg-teal-500/15 text-teal-400",
  ready_delivery: "bg-violet-500/15 text-violet-400",
  delivered: "bg-emerald-500/15 text-emerald-500",
  cancelled: "bg-destructive/15 text-destructive",
};


const optionalStr = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length ? v : null))
    .nullable();

const nullableDate = z
  .string()
  .optional()
  .transform((v) => (v && v.length ? v : null))
  .nullable();

const nullableUuid = z
  .string()
  .optional()
  .transform((v) => (v && v.length ? v : null))
  .refine((v) => v === null || /^[0-9a-f-]{36}$/i.test(v), { message: "ID inválido" })
  .nullable();

const money = z
  .union([z.string(), z.number()])
  .transform((v) => {
    if (v === "" || v === null || v === undefined) return 0;
    const n = typeof v === "number" ? v : parseFloat(String(v).replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  })
  .refine((v) => v >= 0 && v <= 100_000_000, { message: "Valor inválido" });

export const PAYMENT_METHODS = [
  "PIX",
  "Cartão de Crédito",
  "Cartão de Débito",
  "Dinheiro",
  "Transferência",
  "Boleto",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

const qty = z
  .union([z.string(), z.number()])
  .transform((v) => {
    if (v === "" || v === null || v === undefined) return 1;
    const n = typeof v === "number" ? v : parseInt(String(v), 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  });

export const orderSchema = z.object({
  client_id: nullableUuid,
  supplier_id: nullableUuid,
  employee_id: nullableUuid,
  brand: optionalStr(80),
  model: optionalStr(120),
  reference: optionalStr(120),
  photo_path: optionalStr(500),
  quantity: qty,
  sale_price: money,
  cost_price: money,
  commission: money,
  card_fee: money,
  shipping: money,
  other_costs: money,
  amount_received: money,
  payment_method: optionalStr(60),
  purchase_date: nullableDate,
  expected_delivery: nullableDate,
  tracking_code: optionalStr(80),
  status: z.enum(ORDER_STATUS).default("new"),
  ship_zip: optionalStr(20),
  ship_street: optionalStr(200),
  ship_number: optionalStr(20),
  ship_complement: optionalStr(120),
  ship_district: optionalStr(120),
  ship_city: optionalStr(120),
  ship_state: optionalStr(2),
  ship_reference: optionalStr(200),
  notes: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v && v.length ? v : null))
    .nullable(),
});



export type OrderInput = z.input<typeof orderSchema>;
export type OrderPayload = z.output<typeof orderSchema>;

export const orderFilterSchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z.enum(ORDER_STATUS).optional(),
  client_id: z.string().uuid().optional(),
  supplier_id: z.string().uuid().optional(),
  sort: z.enum(["created_at", "expected_delivery", "sale_price", "order_number", "status"]).default("created_at"),
  order: z.enum(["asc", "desc"]).default("desc"),
  includeDeleted: z.boolean().default(false),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(5).max(100).default(20),
});
export type OrderFilter = z.infer<typeof orderFilterSchema>;

const percent = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === "" || v === null || v === undefined) return null;
    const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : null;
  })
  .refine((v) => v === null || (v >= 0 && v <= 100), { message: "Percentual inválido" })
  .nullable();

export const paymentSchema = z.object({
  direction: z.enum(["in", "out"]),
  amount: money.refine((v) => v > 0, { message: "Valor obrigatório" }),
  method: optionalStr(60),
  installments: z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((v) => {
      if (v === "" || v === null || v === undefined) return null;
      const n = typeof v === "number" ? v : parseInt(String(v), 10);
      return Number.isFinite(n) && n > 0 ? n : null;
    })
    .nullable(),
  card_fee: money,
  card_fee_percent: percent,
  paid_at: z
    .string()
    .optional()
    .transform((v) => (v && v.length ? v : new Date().toISOString())),
  notes: optionalStr(500),
});
export type PaymentInput = z.input<typeof paymentSchema>;
export type PaymentPayload = z.output<typeof paymentSchema>;

export const mixedPaymentsSchema = z.object({
  order_id: z.string().uuid(),
  entries: z.array(paymentSchema).min(1).max(10),
  expected_total: z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === "number" ? v : parseFloat(String(v).replace(",", ".")) || 0)),
});
export type MixedPaymentsInput = z.input<typeof mixedPaymentsSchema>;
export type MixedPaymentsPayload = z.output<typeof mixedPaymentsSchema>;

