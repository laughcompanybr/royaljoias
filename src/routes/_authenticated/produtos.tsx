import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Plus,
  Search,
  MoreVertical,
  Trash2,
  Undo2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Boxes,
  Pencil,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Sliders,
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ProductForm } from "@/features/products/ProductForm";
import {
  listProducts,
  createProduct,
  updateProduct,
  softDeleteProduct,
  restoreProduct,
  adjustStock,
  getProduct,
} from "@/features/products/products.functions";
import {
  PRODUCT_STATUS,
  MOVEMENT_LABEL,
  type ProductInput,
  type ProductStatus,
  type MovementType,
} from "@/features/products/schemas";
import { formatBRL, formatDate } from "@/lib/format";

type Row = {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  cost_price: number | null;
  sale_price: number | null;
  stock_qty: number | null;
  min_stock: number | null;
  status: string;
  image_url: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

type SortKey = "name" | "created_at" | "stock_qty" | "sale_price";

function ProdutosPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listProducts);
  const createFn = useServerFn(createProduct);
  const updateFn = useServerFn(updateProduct);
  const delFn = useServerFn(softDeleteProduct);
  const restoreFn = useServerFn(restoreProduct);
  const adjustFn = useServerFn(adjustStock);
  const getFn = useServerFn(getProduct);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | ProductStatus>("");
  const [availability, setAvailability] = useState<"all" | "in_stock" | "low" | "out">("all");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [sort, setSort] = useState<SortKey>("created_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [adjusting, setAdjusting] = useState<Row | null>(null);
  const [viewing, setViewing] = useState<Row | null>(null);

  const pageSize = 20;

  const filter = useMemo(
    () => ({
      search: search.trim() || undefined,
      status: status || undefined,
      availability,
      includeDeleted,
      page,
      pageSize,
      sort,
      order,
    }),
    [search, status, availability, includeDeleted, page, sort, order],
  );

  const query = useQuery({
    queryKey: ["products", filter],
    queryFn: () => listFn({ data: filter }),
    placeholderData: (prev) => prev,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["products"] });

  const createMut = useMutation({
    mutationFn: (v: Record<string, unknown>) => createFn({ data: v as never }),
    onSuccess: () => { toast.success("Produto criado"); setOpenCreate(false); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateMut = useMutation({
    mutationFn: (v: Record<string, unknown>) => updateFn({ data: v as never }),
    onSuccess: () => { toast.success("Produto atualizado"); setEditing(null); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Produto removido"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const restoreMut = useMutation({
    mutationFn: (id: string) => restoreFn({ data: { id } }),
    onSuccess: () => { toast.success("Produto restaurado"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (query.data?.rows ?? []) as Row[];
  const total = query.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const toggleSort = (k: SortKey) => {
    if (sort === k) setOrder((o) => (o === "asc" ? "desc" : "asc"));
    else { setSort(k); setOrder("asc"); }
    setPage(1);
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sort !== k ? <ArrowUpDown className="size-3" /> : order === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />;

  const editingDefaults: Partial<ProductInput> | undefined = editing
    ? {
        name: editing.name,
        sku: editing.sku ?? "",
        category: editing.category ?? "",
        cost_price: editing.cost_price ?? 0,
        sale_price: editing.sale_price ?? 0,
        stock_qty: editing.stock_qty ?? 0,
        min_stock: editing.min_stock ?? 0,
        status: (editing.status as ProductStatus) ?? "active",
        image_url: editing.image_url ?? "",
      }
    : undefined;

  return (
    <div>
      <PageHeader
        eyebrow="Operação"
        title="Produtos"
        description="Cadastro e controle de estoque. Ajuste manual, entradas, saídas e histórico completo por item."
        actions={
          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 size-4" /> Novo produto</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto" description="Cadastro de novo produto">
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">Novo produto</DialogTitle>
              </DialogHeader>
              <ProductForm
                submitLabel="Criar produto"
                onSubmit={async (v) => { await createMut.mutateAsync(v as never); }}
                onCancel={() => setOpenCreate(false)}
              />
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card/40 p-4">
        <div className="min-w-[240px] flex-1">
          <Label htmlFor="search" className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">Pesquisar</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="search"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Nome, SKU, categoria..."
              className="pl-9"
            />
          </div>
        </div>
        <div className="min-w-[160px]">
          <Label className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">Status</Label>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value as "" | ProductStatus); setPage(1); }}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {PRODUCT_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="min-w-[180px]">
          <Label className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">Disponibilidade</Label>
          <select
            value={availability}
            onChange={(e) => { setAvailability(e.target.value as typeof availability); setPage(1); }}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="all">Todos</option>
            <option value="in_stock">Em estoque</option>
            <option value="low">Estoque baixo</option>
            <option value="out">Sem estoque</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="deleted" checked={includeDeleted} onCheckedChange={(v) => { setIncludeDeleted(v); setPage(1); }} />
          <Label htmlFor="deleted" className="text-sm">Incluir removidos</Label>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card/60">
        {query.isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-gold" /></div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title="Nenhum produto encontrado"
            description="Cadastre seus produtos para controlar estoque, custos e vendas."
            action={<Button onClick={() => setOpenCreate(true)}><Plus className="mr-2 size-4" /> Novo produto</Button>}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("name")}>
                        Produto <SortIcon k="name" />
                      </button>
                    </TableHead>
                    <TableHead>SKU / Categoria</TableHead>
                    <TableHead className="text-right">
                      <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("sale_price")}>
                        Preço <SortIcon k="sale_price" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("stock_qty")}>
                        Estoque <SortIcon k="stock_qty" />
                      </button>
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((p) => {
                    const low = (p.stock_qty ?? 0) <= (p.min_stock ?? 0);
                    const out = (p.stock_qty ?? 0) === 0;
                    return (
                      <TableRow
                        key={p.id}
                        className={p.deleted_at ? "opacity-50" : "cursor-pointer"}
                        onClick={() => !p.deleted_at && setViewing(p)}
                      >
                        <TableCell className="font-medium">
                          {p.name}
                          {p.deleted_at ? <Badge variant="outline" className="ml-2 text-[10px]">removido</Badge> : null}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {p.sku ?? "—"}
                          {p.category ? <p className="text-xs">{p.category}</p> : null}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {formatBRL(p.sale_price)}
                          <p className="text-xs text-muted-foreground">custo {formatBRL(p.cost_price)}</p>
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          <span className={out ? "text-destructive" : low ? "text-amber-500" : ""}>
                            {p.stock_qty ?? 0}
                          </span>
                          <p className="text-xs text-muted-foreground">mín {p.min_stock ?? 0}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant={p.status === "active" ? "default" : "outline"}>{p.status}</Badge>
                          {out ? <Badge variant="outline" className="ml-1 text-[10px] text-destructive">sem estoque</Badge>
                            : low ? <Badge variant="outline" className="ml-1 text-[10px] text-amber-500">baixo</Badge> : null}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" aria-label="Ações"><MoreVertical className="size-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {!p.deleted_at ? (
                                <>
                                  <DropdownMenuItem onClick={() => setEditing(p)}>
                                    <Pencil className="mr-2 size-4" /> Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setAdjusting(p)}>
                                    <Sliders className="mr-2 size-4" /> Ajustar estoque
                                  </DropdownMenuItem>
                                </>
                              ) : null}
                              {p.deleted_at ? (
                                <DropdownMenuItem onClick={() => restoreMut.mutate(p.id)}>
                                  <Undo2 className="mr-2 size-4" /> Restaurar
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => { if (confirm(`Remover ${p.name}?`)) delMut.mutate(p.id); }}
                                >
                                  <Trash2 className="mr-2 size-4" /> Remover
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
              <p className="text-muted-foreground">
                {total} produto{total === 1 ? "" : "s"} · página {page} de {totalPages}
              </p>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Página anterior">
                  <ChevronLeft className="size-4" />
                </Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Próxima página">
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Edit */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto" description="Editar produto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Editar produto</DialogTitle>
          </DialogHeader>
          {editing ? (
            <ProductForm
              submitLabel="Salvar alterações"
              defaultValues={editingDefaults}
              onSubmit={async (v) => { await updateMut.mutateAsync({ id: editing.id, ...(v as object) } as never); }}
              onCancel={() => setEditing(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Adjust stock */}
      <AdjustDialog
        product={adjusting}
        onClose={() => setAdjusting(null)}
        onSubmit={async (payload) => {
          try {
            await adjustFn({ data: payload });
            toast.success("Estoque atualizado");
            setAdjusting(null);
            invalidate();
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />

      {/* View history */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto" description="Detalhes e histórico do produto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">{viewing?.name}</DialogTitle>
          </DialogHeader>
          {viewing ? <ProductHistory productId={viewing.id} fetchFn={getFn} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdjustDialog({
  product,
  onClose,
  onSubmit,
}: {
  product: Row | null;
  onClose: () => void;
  onSubmit: (v: { product_id: string; type: "in" | "out" | "adjust"; qty: number; reason?: string }) => Promise<void>;
}) {
  const [type, setType] = useState<"in" | "out" | "adjust">("in");
  const [qty, setQty] = useState<string>("1");
  const [reason, setReason] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  return (
    <Dialog open={!!product} onOpenChange={(o) => { if (!o) { onClose(); setQty("1"); setReason(""); setType("in"); } }}>
      <DialogContent description="Ajuste de estoque">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Ajustar estoque · {product?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
            Estoque atual: <strong>{product?.stock_qty ?? 0}</strong>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as typeof type)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="in">Entrada (+)</option>
                <option value="out">Saída (−)</option>
                <option value="adjust">Definir total</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qty">Quantidade</Label>
              <Input id="qty" type="number" min="0" step="1" value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reason">Motivo</Label>
            <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex: recebimento fornecedor, quebra, contagem" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancelar</Button>
          <Button
            disabled={submitting}
            onClick={async () => {
              if (!product) return;
              const n = parseInt(qty, 10);
              if (!Number.isFinite(n) || n < 0) { toast.error("Informe uma quantidade válida"); return; }
              setSubmitting(true);
              try {
                await onSubmit({ product_id: product.id, type, qty: n, reason: reason || undefined });
                setQty("1"); setReason(""); setType("in");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProductHistory({
  productId,
  fetchFn,
}: {
  productId: string;
  fetchFn: (args: { data: { id: string } }) => Promise<{
    product: Record<string, unknown>;
    movements: Array<{
      id: string;
      type: string;
      qty: number;
      qty_after: number;
      reason: string | null;
      order_id: string | null;
      created_at: string;
    }>;
  }>;
}) {
  const q = useQuery({
    queryKey: ["product", productId],
    queryFn: () => fetchFn({ data: { id: productId } }),
  });

  if (q.isLoading) return <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin" /></div>;
  if (q.isError || !q.data) return <p className="py-6 text-sm text-muted-foreground">Erro ao carregar histórico.</p>;

  const p = q.data.product as {
    stock_qty?: number; min_stock?: number; sale_price?: number; cost_price?: number;
    sku?: string | null; category?: string | null;
  };
  const movements = q.data.movements;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Estoque" value={String(p.stock_qty ?? 0)} />
        <Stat label="Mínimo" value={String(p.min_stock ?? 0)} />
        <Stat label="Venda" value={formatBRL(p.sale_price ?? 0)} />
        <Stat label="Custo" value={formatBRL(p.cost_price ?? 0)} />
      </div>
      <div>
        <h4 className="mb-2 text-sm font-medium">Movimentações recentes</h4>
        {movements.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/60 p-4 text-center text-sm text-muted-foreground">
            Sem movimentações registradas.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <Badge variant="outline">
                        {MOVEMENT_LABEL[m.type as MovementType] ?? m.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{m.qty > 0 ? `+${m.qty}` : m.qty}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{m.qty_after}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{m.reason ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(m.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-lg">{value}</p>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/produtos")({
  component: ProdutosPage,
});
