import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Plus,
  Search,
  ArrowUpDown,
  MoreVertical,
  Trash2,
  Undo2,
  Package,
  Loader2,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  KanbanSquare,
  List as ListIcon,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrderForm } from "@/features/orders/OrderForm";
import { OrderDetailSheet } from "@/features/orders/OrderDetailSheet";
import { KanbanBoard } from "@/features/orders/KanbanBoard";
import {
  listOrders,
  createOrder,
  softDeleteOrder,
  restoreOrder,
} from "@/features/orders/orders.functions";
import { ORDER_STATUS, STATUS_LABEL, STATUS_TONE, type OrderStatus } from "@/features/orders/schemas";
import { formatBRL, formatDate } from "@/lib/format";


type SortKey = "created_at" | "expected_delivery" | "sale_price" | "order_number" | "status";

function PedidosPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listOrders);
  const createFn = useServerFn(createOrder);
  const delFn = useServerFn(softDeleteOrder);
  const restoreFn = useServerFn(restoreOrder);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("created_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [page, setPage] = useState(1);
  const [openCreate, setOpenCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const pageSize = 20;

  const filter = useMemo(
    () => ({
      search: search.trim() || undefined,
      status: status === "all" ? undefined : (status as OrderStatus),
      sort,
      order,
      includeDeleted,
      page,
      pageSize,
    }),
    [search, status, sort, order, includeDeleted, page],
  );

  const query = useQuery({
    queryKey: ["orders", filter],
    queryFn: () => listFn({ data: filter }),
    placeholderData: (prev) => prev,
  });

  const createMut = useMutation({
    mutationFn: (v: Record<string, unknown>) => createFn({ data: v as never }),
    onSuccess: (r) => {
      toast.success(`Pedido #${r.order_number} criado`);
      setOpenCreate(false);
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Pedido removido"); qc.invalidateQueries({ queryKey: ["orders"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const restoreMut = useMutation({
    mutationFn: (id: string) => restoreFn({ data: { id } }),
    onSuccess: () => { toast.success("Pedido restaurado"); qc.invalidateQueries({ queryKey: ["orders"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = query.data?.rows ?? [];
  const total = query.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const toggleSort = (key: SortKey) => {
    if (sort === key) setOrder((o) => (o === "asc" ? "desc" : "asc"));
    else { setSort(key); setOrder("asc"); }
    setPage(1);
  };

  return (
    <div className="pb-24 md:pb-0">
      <PageHeader
        eyebrow="Operação"
        title="Pedidos"
        description="Gestão completa dos pedidos: financeiro, rastreio, timeline e documentos."
        actions={
          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild>
              <Button className="hidden md:inline-flex"><Plus className="mr-2 size-4" /> Novo pedido</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">Novo pedido</DialogTitle>
              </DialogHeader>
              <OrderForm
                submitLabel="Criar pedido"
                onSubmit={async (v) => { await createMut.mutateAsync(v as never); }}
                onCancel={() => setOpenCreate(false)}
              />
            </DialogContent>
          </Dialog>
        }
      />

      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list"><ListIcon className="mr-1.5 size-4" />Lista</TabsTrigger>
          <TabsTrigger value="kanban"><KanbanSquare className="mr-1.5 size-4" />Kanban</TabsTrigger>
        </TabsList>

        <TabsContent value="kanban" className="mt-0">
          <KanbanBoard />
        </TabsContent>

        <TabsContent value="list" className="mt-0 space-y-4">


      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card/40 p-4">
        <div className="min-w-[240px] flex-1">
          <Label htmlFor="search" className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">
            Pesquisar
          </Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="search"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Nº do pedido, marca, modelo, rastreio..."
              className="pl-9"
            />
          </div>
        </div>
        <div className="w-48">
          <Label className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">Status</Label>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {ORDER_STATUS.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
            </SelectContent>
          </Select>
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
            icon={Package}
            title="Nenhum pedido encontrado"
            description="Ajuste os filtros ou registre um novo pedido."
            action={<Button onClick={() => setOpenCreate(true)}><Plus className="mr-2 size-4" /> Novo pedido</Button>}
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">
                    <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("order_number")}>
                      Nº <ArrowUpDown className="size-3" />
                    </button>
                  </TableHead>
                  <TableHead>Cliente / Item</TableHead>
                  <TableHead>
                    <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("status")}>
                      Status <ArrowUpDown className="size-3" />
                    </button>
                  </TableHead>
                  <TableHead className="text-right">
                    <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("sale_price")}>
                      Venda / Lucro <ArrowUpDown className="size-3" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("expected_delivery")}>
                      Entrega <ArrowUpDown className="size-3" />
                    </button>
                  </TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((o) => {
                  const client = o.clients as { name?: string; whatsapp?: string | null } | null;
                  const balance = Number(o.sale_price ?? 0) - Number(o.amount_received ?? 0);
                  return (
                    <TableRow
                      key={o.id}
                      className={o.deleted_at ? "opacity-50" : "cursor-pointer"}
                      onClick={() => !o.deleted_at && setSelectedId(o.id)}
                    >
                      <TableCell className="font-mono text-sm">#{o.order_number}</TableCell>
                      <TableCell>
                        <p className="font-medium">{client?.name ?? <span className="text-muted-foreground">Sem cliente</span>}</p>
                        <p className="text-xs text-muted-foreground">
                          {[o.brand, o.model].filter(Boolean).join(" ") || "—"}
                          {o.reference ? ` · ${o.reference}` : ""}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                        {o.deleted_at ? <Badge variant="outline" className="ml-1 text-[10px]">removido</Badge> : null}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        <p className="font-medium">{formatBRL(o.sale_price)}</p>
                        <p className={`text-xs ${Number(o.profit ?? 0) >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                          Lucro: {formatBRL(o.profit)}
                        </p>
                        {balance > 0 ? <p className="text-xs text-amber-500">Saldo: {formatBRL(balance)}</p> : null}
                      </TableCell>
                      <TableCell className="text-sm">
                        {o.expected_delivery ? formatDate(o.expected_delivery) : <span className="text-muted-foreground">—</span>}
                        {o.tracking_code ? <p className="text-xs font-mono text-muted-foreground">{o.tracking_code}</p> : null}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost"><MoreVertical className="size-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {client?.whatsapp ? (
                              <DropdownMenuItem asChild>
                                <a href={`https://wa.me/55${client.whatsapp}`} target="_blank" rel="noopener">
                                  <MessageCircle className="mr-2 size-4" /> WhatsApp cliente
                                </a>
                              </DropdownMenuItem>
                            ) : null}
                            {o.deleted_at ? (
                              <DropdownMenuItem onClick={() => restoreMut.mutate(o.id)}>
                                <Undo2 className="mr-2 size-4" /> Restaurar
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => { if (confirm(`Remover pedido #${o.order_number}?`)) delMut.mutate(o.id); }}
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

            <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
              <p className="text-muted-foreground">
                {total} pedido{total === 1 ? "" : "s"} · página {page} de {totalPages}
              </p>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="size-4" />
                </Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
        </TabsContent>
      </Tabs>

      <OrderDetailSheet
        orderId={selectedId}
        open={!!selectedId}
        onOpenChange={(o) => { if (!o) setSelectedId(null); }}
      />

      <Button
        size="icon"
        onClick={() => setOpenCreate(true)}
        aria-label="Novo pedido"
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-lg md:hidden"
      >
        <Plus className="size-6" />
      </Button>
    </div>

  );
}

export const Route = createFileRoute("/_authenticated/pedidos")({
  component: PedidosPage,
});
