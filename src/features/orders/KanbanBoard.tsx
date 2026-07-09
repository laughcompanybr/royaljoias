import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { changeOrderStatus, listOrders } from "@/features/orders/orders.functions";
import { STATUS_LABEL, STATUS_TONE, type OrderStatus } from "@/features/orders/schemas";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { GripVertical, Search, Truck, User } from "lucide-react";

const COLUMNS: { status: OrderStatus; title: string }[] = [
  { status: "new", title: STATUS_LABEL.new },
  { status: "awaiting_deposit", title: STATUS_LABEL.awaiting_deposit },
  { status: "paid", title: STATUS_LABEL.paid },
  { status: "purchasing", title: STATUS_LABEL.purchasing },
  { status: "in_transit", title: STATUS_LABEL.in_transit },
  { status: "received", title: STATUS_LABEL.received },
  { status: "delivered", title: STATUS_LABEL.delivered },
  { status: "cancelled", title: STATUS_LABEL.cancelled },
];

type OrderRow = {
  id: string;
  order_number: number | null;
  status: OrderStatus;
  brand: string | null;
  model: string | null;
  reference: string | null;
  sale_price: number | null;
  tracking_code: string | null;
  expected_delivery: string | null;
  clients: { id: string; name: string } | null;
  suppliers: { id: string; name: string } | null;
};

const currency = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function KanbanBoard() {
  const listFn = useServerFn(listOrders);
  const changeFn = useServerFn(changeOrderStatus);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useState<Record<string, OrderStatus>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["orders", "kanban"],
    queryFn: () =>
      listFn({
        data: {
          sort: "created_at",
          order: "desc",
          includeDeleted: false,
          page: 1,
          pageSize: 100,
        },
      }),
  });

  const mutation = useMutation({
    mutationFn: (vars: { id: string; status: OrderStatus }) => changeFn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err: unknown) => {
      toast.error("Falha ao mover pedido", {
        description: err instanceof Error ? err.message : "Tente novamente",
      });
      setOptimistic({});
      qc.invalidateQueries({ queryKey: ["orders", "kanban"] });
    },
  });

  const rows = (data?.rows ?? []) as OrderRow[];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .map((r) => ({ ...r, status: optimistic[r.id] ?? r.status }))
      .filter((r) => {
        if (!q) return true;
        return (
          String(r.order_number ?? "").includes(q) ||
          (r.brand ?? "").toLowerCase().includes(q) ||
          (r.model ?? "").toLowerCase().includes(q) ||
          (r.reference ?? "").toLowerCase().includes(q) ||
          (r.tracking_code ?? "").toLowerCase().includes(q) ||
          (r.clients?.name ?? "").toLowerCase().includes(q)
        );
      });
  }, [rows, optimistic, search]);

  const byStatus = useMemo(() => {
    const map: Record<OrderStatus, OrderRow[]> = {} as Record<OrderStatus, OrderRow[]>;
    for (const c of COLUMNS) map[c.status] = [];
    for (const r of filtered) if (map[r.status]) map[r.status].push(r);
    return map;
  }, [filtered]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const activeOrder = activeId ? filtered.find((r) => r.id === activeId) : null;

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;
    const id = String(e.active.id);
    const targetStatus = overId as OrderStatus;
    if (!COLUMNS.some((c) => c.status === targetStatus)) return;
    const current = rows.find((r) => r.id === id);
    if (!current || current.status === targetStatus) return;
    setOptimistic((prev) => ({ ...prev, [id]: targetStatus }));
    mutation.mutate({ id, status: targetStatus });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar pedido, cliente, marca…"
          className="pl-9"
        />
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex min-w-max gap-4 pb-4">
            {COLUMNS.map((col) => (
              <Column
                key={col.status}
                status={col.status}
                title={col.title}
                orders={byStatus[col.status] ?? []}
                loading={isLoading}
              />
            ))}
          </div>
        </div>
        <DragOverlay dropAnimation={null}>
          {activeOrder ? <OrderCard order={activeOrder} dragging /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function Column({
  status,
  title,
  orders,
  loading,
}: {
  status: OrderStatus;
  title: string;
  orders: OrderRow[];
  loading: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const total = orders.reduce((a, b) => a + Number(b.sale_price ?? 0), 0);

  return (
    <div className="flex w-72 shrink-0 flex-col sm:w-80">
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className={cn("inline-flex h-2 w-2 rounded-full", STATUS_TONE[status])} />
          <h2 className="text-sm font-semibold">{title}</h2>
          <Badge variant="secondary" className="h-5 px-1.5 text-xs">
            {orders.length}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground">{currency(total)}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[50vh] flex-1 flex-col gap-2 rounded-lg border border-dashed border-border/60 bg-muted/30 p-2 transition-colors",
          isOver && "border-primary/60 bg-primary/5",
        )}
      >
        {loading
          ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
          : orders.length === 0
            ? (
              <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
                Sem pedidos
              </div>
            )
            : orders.map((o) => <OrderCard key={o.id} order={o} />)}
      </div>
    </div>
  );
}

function OrderCard({ order, dragging = false }: { order: OrderRow; dragging?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: order.id });
  return (
    <Card
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "cursor-grab select-none space-y-2 p-3 shadow-sm transition active:cursor-grabbing",
        (isDragging || dragging) && "opacity-70 shadow-lg ring-2 ring-primary/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <GripVertical className="h-3 w-3" />#{order.order_number ?? "—"}
          </div>
          <div className="mt-0.5 truncate text-sm font-medium">
            {[order.brand, order.model].filter(Boolean).join(" ") || "Pedido"}
          </div>
          {order.reference ? (
            <div className="truncate text-xs text-muted-foreground">Ref. {order.reference}</div>
          ) : null}
        </div>
        <span className="whitespace-nowrap text-sm font-semibold">{currency(order.sale_price)}</span>
      </div>
      <div className="space-y-1 text-xs text-muted-foreground">
        {order.clients?.name ? (
          <div className="flex items-center gap-1.5 truncate">
            <User className="h-3 w-3" />
            <span className="truncate">{order.clients.name}</span>
          </div>
        ) : null}
        {order.tracking_code ? (
          <div className="flex items-center gap-1.5 truncate">
            <Truck className="h-3 w-3" />
            <span className="truncate">{order.tracking_code}</span>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
