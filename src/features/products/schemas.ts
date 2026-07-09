import { z } from "zod";

const optionalStr = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v && v.length ? v : null))
    .nullable();

const optionalMoney = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((v) => {
    if (v === "" || v === null || v === undefined) return 0;
    const n = typeof v === "number" ? v : parseFloat(String(v).replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  })
  .refine((v) => v >= 0 && v <= 10_000_000, { message: "Valor inválido" });

const optionalInt = (max = 1_000_000) =>
  z
    .union([z.string(), z.number()])
    .nullish()
    .transform((v) => {
      if (v === "" || v === null || v === undefined) return 0;
      const n = typeof v === "number" ? Math.trunc(v) : parseInt(String(v).replace(/\D/g, ""), 10);
      return Number.isFinite(n) ? n : 0;
    })
    .refine((v) => v >= 0 && v <= max, { message: "Quantidade inválida" });

export const PRODUCT_STATUS = ["active", "inactive", "archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUS)[number];

export const productSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome").max(200),
  sku: optionalStr(80),
  category: optionalStr(80),
  description: optionalStr(2000),
  cost_price: optionalMoney,
  sale_price: optionalMoney,
  stock_qty: optionalInt(),
  min_stock: optionalInt(),
  status: z.enum(PRODUCT_STATUS).default("active"),
  image_url: optionalStr(500),
  notes: optionalStr(2000),
});

export type ProductInput = z.input<typeof productSchema>;
export type ProductPayload = z.output<typeof productSchema>;

export const productFilterSchema = z.object({
  search: z.string().trim().max(120).optional(),
  category: z.string().trim().max(80).optional(),
  status: z.enum(PRODUCT_STATUS).optional(),
  availability: z.enum(["all", "in_stock", "low", "out"]).default("all"),
  includeDeleted: z.boolean().default(false),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(5).max(100).default(20),
  sort: z.enum(["name", "created_at", "stock_qty", "sale_price"]).default("created_at"),
  order: z.enum(["asc", "desc"]).default("desc"),
});
export type ProductFilter = z.infer<typeof productFilterSchema>;

export const MOVEMENT_TYPES = ["in", "out", "adjust", "sale", "sale_revert"] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const MOVEMENT_LABEL: Record<MovementType, string> = {
  in: "Entrada",
  out: "Saída",
  adjust: "Ajuste",
  sale: "Venda",
  sale_revert: "Reversão",
};

export const stockAdjustSchema = z.object({
  product_id: z.string().uuid(),
  type: z.enum(["in", "out", "adjust"]),
  qty: z.coerce.number().int(),
  reason: optionalStr(300),
});
export type StockAdjustInput = z.input<typeof stockAdjustSchema>;

export const orderItemSchema = z.object({
  product_id: z.string().uuid().nullish(),
  name_snapshot: z.string().trim().min(1).max(200),
  sku_snapshot: optionalStr(80),
  quantity: z.coerce.number().int().min(1).max(100_000),
  unit_sale_price: optionalMoney,
  unit_cost_price: optionalMoney,
});
export type OrderItemInput = z.input<typeof orderItemSchema>;
