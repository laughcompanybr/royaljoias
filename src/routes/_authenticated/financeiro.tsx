import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format, startOfMonth, endOfMonth, differenceInDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  ArrowDownRight,
  ArrowUpRight,
  Download,
  Plus,
  Trash2,
  Wallet,
  TrendingUp,
  Receipt,
  CalendarClock,
  History,
  Search,
  Eye,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatBRL, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  bulkPayPayables,
  createExpense,
  createFinancialTransaction,
  deleteExpense,
  deleteFinancialTransaction,
  getCashFlow,
  getPayableHistory,
  listExpenses,
  listFinancialTransactions,
  listPayables,
  payPayable,
  listReceivables,
  markTransactionPaid,
} from "@/features/finance/finance.functions";
import {
  EXPENSE_CATEGORIES,
  expenseSchema,
  financialTxSchema,
  TX_METHODS,
  TX_STATUSES,
  type ExpenseInput,
  type FinancialTxInput,
} from "@/features/finance/schemas";
import { CheckCircle2, ArrowRightLeft, ExternalLink } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ReceiptField, getReceiptUrl } from "@/features/finance/ReceiptField";
import { GoalsPanel } from "@/features/finance/GoalsPanel";


const CHART_COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2, 210 90% 60%))", "hsl(var(--chart-3, 30 90% 60%))", "hsl(var(--chart-4, 340 82% 62%))", "hsl(var(--chart-5, 160 70% 45%))", "hsl(var(--chart-6, 260 70% 65%))", "hsl(var(--muted-foreground))"];

const financeSearchSchema = z.object({
  tab: fallback(
    z.enum(["cashflow", "entries", "exits", "receivables", "payables", "movements", "expenses", "goals"]),
    "cashflow",
  ).default("cashflow"),
  from: fallback(z.string(), format(startOfMonth(new Date()), "yyyy-MM-dd")).default(format(startOfMonth(new Date()), "yyyy-MM-dd")),
  to: fallback(z.string(), format(endOfMonth(new Date()), "yyyy-MM-dd")).default(format(endOfMonth(new Date()), "yyyy-MM-dd")),
  category: fallback(z.string(), "all").default("all"),
  // Payables
  pSearch: fallback(z.string(), "").default(""),
  pFrom: fallback(z.string(), "").default(""),
  pTo: fallback(z.string(), "").default(""),
  pStatus: fallback(z.enum(["all", "overdue", "upcoming", "future", "no_date"]), "all").default("all"),
  // Movements
  mSearch: fallback(z.string(), "").default(""),
  mDirection: fallback(z.enum(["all", "in", "out"]), "all").default("all"),
  mStatus: fallback(z.string(), "all").default("all"),
});

export const Route = createFileRoute("/_authenticated/financeiro")({
  component: FinancePage,
  validateSearch: zodValidator(financeSearchSchema),
});

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Bind a single search-param key to a getter/setter tuple. */
function useSearchState<K extends keyof z.infer<typeof financeSearchSchema>>(
  key: K,
): [z.infer<typeof financeSearchSchema>[K], (v: z.infer<typeof financeSearchSchema>[K]) => void] {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const set = useCallback(
    (v: z.infer<typeof financeSearchSchema>[K]) => {
      navigate({ search: (prev: z.infer<typeof financeSearchSchema>) => ({ ...prev, [key]: v }), replace: true });
    },
    [navigate, key],
  );
  return [search[key], set];
}

function FinancePage() {
  const [from, setFrom] = useSearchState("from");
  const [to, setTo] = useSearchState("to");
  const [category, setCategory] = useSearchState("category");
  const [tab, setTab] = useSearchState("tab");

  const granularity = useMemo<"day" | "month">(
    () => (differenceInDays(parseISO(to), parseISO(from)) > 90 ? "month" : "day"),
    [from, to],
  );

  const cashFlowFn = useServerFn(getCashFlow);
  const receivablesFn = useServerFn(listReceivables);
  const expensesFn = useServerFn(listExpenses);

  const cashQ = useQuery({
    queryKey: ["finance", "cashflow", from, to, granularity],
    queryFn: () => cashFlowFn({ data: { from, to, granularity } }),
  });
  const receivablesQ = useQuery({ queryKey: ["finance", "receivables"], queryFn: () => receivablesFn() });
  const expensesQ = useQuery({
    queryKey: ["finance", "expenses", from, to, category],
    queryFn: () =>
      expensesFn({
        data: {
          from,
          to,
          category: category !== "all" ? (category as (typeof EXPENSE_CATEGORIES)[number]) : undefined,
        },
      }),
  });

  const totals = cashQ.data?.totals;

  function setPreset(preset: "month" | "30d" | "90d" | "ytd") {
    const now = new Date();
    if (preset === "month") {
      setFrom(format(startOfMonth(now), "yyyy-MM-dd"));
      setTo(format(endOfMonth(now), "yyyy-MM-dd"));
    } else if (preset === "30d") {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setFrom(format(d, "yyyy-MM-dd"));
      setTo(todayISO());
    } else if (preset === "90d") {
      const d = new Date();
      d.setDate(d.getDate() - 90);
      setFrom(format(d, "yyyy-MM-dd"));
      setTo(todayISO());
    } else {
      setFrom(format(new Date(now.getFullYear(), 0, 1), "yyyy-MM-dd"));
      setTo(todayISO());
    }
  }

  function exportCSV() {
    if (!cashQ.data) return;
    const rows: string[][] = [["Data", "Tipo", "Descrição", "Categoria/Método", "Valor"]];
    for (const p of cashQ.data.payments) {
      rows.push([
        format(new Date(p.paid_at), "yyyy-MM-dd"),
        p.direction === "in" ? "Entrada" : "Saída",
        `Pedido #${p.orders?.order_number ?? "—"} ${(p.orders?.brand ?? "") + " " + (p.orders?.model ?? "")}`.trim(),
        p.method ?? "",
        String(Number(p.amount).toFixed(2)),
      ]);
    }
    for (const e of cashQ.data.expenses) {
      rows.push([e.incurred_at, "Saída", e.description ?? "Despesa", e.category ?? "", String(Number(e.amount).toFixed(2))]);
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financeiro_${from}_a_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório exportado");
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <PageHeader
        eyebrow="Gestão"
        title="Financeiro"
        description="Fluxo de caixa, entradas, saídas e contas a receber e a pagar."
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => setPreset("month")}>
                Mês
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPreset("30d")}>
                30d
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPreset("90d")}>
                90d
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPreset("ytd")}>
                Ano
              </Button>
            </div>
            <div className="flex items-end gap-2">
              <div>
                <Label className="text-xs">De</Label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-[140px]" />
              </div>
              <div>
                <Label className="text-xs">Até</Label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-[140px]" />
              </div>
            </div>
            <Button size="sm" onClick={exportCSV} disabled={!cashQ.data}>
              <Download className="mr-1 h-4 w-4" /> Exportar
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Entradas" value={formatBRL(totals?.totalIn ?? 0)} icon={ArrowUpRight} accent="success" />
        <StatCard label="Saídas" value={formatBRL(totals?.totalOut ?? 0)} icon={ArrowDownRight} accent="warning" />
        <StatCard
          label="Resultado do período"
          value={formatBRL(totals?.net ?? 0)}
          icon={TrendingUp}
          accent={(totals?.net ?? 0) >= 0 ? "success" : "warning"}
        />
        <StatCard label="Despesas" value={formatBRL(totals?.totalExpenses ?? 0)} icon={Receipt} accent="gold" />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="cashflow">Fluxo de caixa</TabsTrigger>
          <TabsTrigger value="entries">Entradas</TabsTrigger>
          <TabsTrigger value="exits">Saídas</TabsTrigger>
          <TabsTrigger value="receivables">A receber</TabsTrigger>
          <TabsTrigger value="payables">A pagar</TabsTrigger>
          <TabsTrigger value="movements">Movimentações</TabsTrigger>
          <TabsTrigger value="expenses">Despesas</TabsTrigger>
          <TabsTrigger value="goals">Metas</TabsTrigger>
        </TabsList>


        <TabsContent value="cashflow" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Evolução {granularity === "month" ? "mensal" : "diária"}</CardTitle>
              </CardHeader>
              <CardContent className="h-80">
                {cashQ.isLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : !cashQ.data?.chart.length ? (
                  <EmptyState title="Sem lançamentos" description="Nenhum movimento no período." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={cashQ.data.chart}>
                      <defs>
                        <linearGradient id="g-in" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="g-out" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.55} />
                          <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                      <XAxis dataKey="key" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(v)} />
                      <Tooltip formatter={(v: number) => formatBRL(v)} labelClassName="text-foreground" contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                      <Area type="monotone" dataKey="inflow" name="Entradas" stroke="hsl(var(--primary))" fill="url(#g-in)" strokeWidth={2} />
                      <Area type="monotone" dataKey="outflow" name="Saídas" stroke="hsl(var(--destructive))" fill="url(#g-out)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Despesas por categoria</CardTitle>
              </CardHeader>
              <CardContent className="h-80">
                {cashQ.isLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : !cashQ.data?.categories.length ? (
                  <EmptyState title="Sem despesas" description="Nada lançado no período." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={cashQ.data.categories} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                        {cashQ.data.categories.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatBRL(v)} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Comparativo entradas x saídas</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              {cashQ.isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : cashQ.data?.chart.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cashQ.data.chart} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                    <XAxis
                      dataKey="key"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v: string) => {
                        if (granularity === "month") {
                          const [y, m] = v.split("-");
                          const d = new Date(Number(y), Number(m) - 1, 1);
                          return format(d, "MMM/yy", { locale: ptBR });
                        }
                        return format(parseISO(v), "dd/MM");
                      }}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(v)}
                    />
                    <Tooltip
                      formatter={(v: number, name: string) => [formatBRL(v), name]}
                      labelFormatter={(v: string) =>
                        granularity === "month"
                          ? (() => {
                              const [y, m] = v.split("-");
                              return format(new Date(Number(y), Number(m) - 1, 1), "MMMM 'de' yyyy", { locale: ptBR });
                            })()
                          : format(parseISO(v), "dd 'de' MMMM", { locale: ptBR })
                      }
                      contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="inflow" name="Entradas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="outflow" name="Saídas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState title="Sem lançamentos" description="Nada no período." />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="entries">
          <PaymentsTable
            loading={cashQ.isLoading}
            payments={(cashQ.data?.payments ?? []).filter((p) => p.direction === "in")}
            emptyLabel="Nenhuma entrada no período."
          />
        </TabsContent>

        <TabsContent value="exits">
          <PaymentsTable
            loading={cashQ.isLoading}
            payments={(cashQ.data?.payments ?? []).filter((p) => p.direction === "out")}
            emptyLabel="Nenhuma saída no período."
          />
        </TabsContent>

        <TabsContent value="receivables">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Contas a receber</CardTitle>
                <p className="text-sm text-muted-foreground">Pedidos com saldo em aberto de clientes.</p>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Total em aberto</div>
                <div className="text-lg font-semibold">{formatBRL(receivablesQ.data?.total ?? 0)}</div>
              </div>
            </CardHeader>
            <CardContent>
              {receivablesQ.isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : !receivablesQ.data?.rows.length ? (
                <EmptyState icon={Wallet} title="Nada a receber" description="Todos os pedidos estão quitados." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Recebido</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receivablesQ.data.rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">#{r.order_number}</TableCell>
                        <TableCell>{r.clients?.name ?? "—"}</TableCell>
                        <TableCell>
                          <DueBadge date={r.expected_delivery} />
                        </TableCell>
                        <TableCell className="text-right">{formatBRL(r.sale_price)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{formatBRL(r.amount_received)}</TableCell>
                        <TableCell className="text-right font-semibold text-emerald-500">{formatBRL(r.balance)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payables">
          <PayablesTab />
        </TabsContent>

        <TabsContent value="movements">
          <MovementsTab from={from} to={to} />
        </TabsContent>

        <TabsContent value="expenses">
          <ExpensesTab
            from={from}
            to={to}
            category={category}
            setCategory={setCategory}
            expenses={expensesQ.data ?? []}
            loading={expensesQ.isLoading}
          />
        </TabsContent>

        <TabsContent value="goals">
          <GoalsPanel />
        </TabsContent>
      </Tabs>

    </div>
  );
}

function PaymentsTable({
  payments,
  loading,
  emptyLabel,
}: {
  payments: NonNullable<Awaited<ReturnType<typeof getCashFlow>>>["payments"];
  loading: boolean;
  emptyLabel: string;
}) {
  const total = payments.reduce((a, b) => a + Number(b.amount), 0);
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{payments.length} lançamento(s)</CardTitle>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="text-lg font-semibold">{formatBRL(total)}</div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : !payments.length ? (
          <EmptyState title="Sem movimentos" description={emptyLabel} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Pedido</TableHead>
                <TableHead>Contraparte</TableHead>
                <TableHead>Método</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{formatDate(p.paid_at)}</TableCell>
                  <TableCell className="font-medium">#{p.orders?.order_number ?? "—"}</TableCell>
                  <TableCell>
                    {p.direction === "in" ? p.orders?.clients?.name ?? "—" : p.orders?.suppliers?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p.method ?? "—"}</TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-semibold",
                      p.direction === "in" ? "text-emerald-500" : "text-destructive",
                    )}
                  >
                    {p.direction === "in" ? "+" : "-"} {formatBRL(p.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function DueBadge({ date }: { date: string | null | undefined }) {
  if (!date) return <span className="text-muted-foreground">—</span>;
  const days = differenceInDays(parseISO(date), new Date());
  const label = format(parseISO(date), "dd MMM", { locale: ptBR });
  if (days < 0) return <Badge variant="destructive">{label} · atrasado</Badge>;
  if (days <= 7) return <Badge className="bg-amber-500/15 text-amber-500">{label} · {days}d</Badge>;
  return <Badge variant="outline">{label}</Badge>;
}

function ExpensesTab({
  from,
  to,
  category,
  setCategory,
  expenses,
  loading,
}: {
  from: string;
  to: string;
  category: string;
  setCategory: (v: string) => void;
  expenses: Array<{ id: string; description: string | null; amount: number; category: string | null; incurred_at: string; receipt_url?: string | null }>;
  loading: boolean;
}) {
  const qc = useQueryClient();
  const createFn = useServerFn(createExpense);
  const deleteFn = useServerFn(deleteExpense);
  const [open, setOpen] = useState(false);

  const form = useForm<ExpenseInput>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      description: "",
      amount: 0,
      category: "Operacional",
      incurred_at: todayISO(),
      receipt_url: null,
    },
  });

  const createMut = useMutation({
    mutationFn: (v: ExpenseInput) => createFn({ data: v }),
    onSuccess: () => {
      toast.success("Despesa registrada");
      setOpen(false);
      form.reset({ description: "", amount: 0, category: "Operacional", incurred_at: todayISO(), receipt_url: null });
      qc.invalidateQueries({ queryKey: ["finance"] });
    },
    onError: (e: unknown) => toast.error("Erro", { description: e instanceof Error ? e.message : "" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Despesa removida");
      qc.invalidateQueries({ queryKey: ["finance"] });
    },
    onError: (e: unknown) => toast.error("Erro", { description: e instanceof Error ? e.message : "" }),
  });

  const total = expenses.reduce((a, b) => a + Number(b.amount), 0);

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle>Despesas do período</CardTitle>
          <p className="text-sm text-muted-foreground">
            {expenses.length} lançamento(s) · {formatBRL(total)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {EXPENSE_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Nova despesa</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Registrar despesa</DialogTitle></DialogHeader>
              <form
                className="space-y-3"
                onSubmit={form.handleSubmit((v) => createMut.mutate(v))}
              >
                <div>
                  <Label>Descrição</Label>
                  <Input {...form.register("description")} placeholder="Ex.: Impulsionamento Instagram" />
                  {form.formState.errors.description && (
                    <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Valor (R$)</Label>
                    <Input type="number" step="0.01" {...form.register("amount")} />
                    {form.formState.errors.amount && (
                      <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>
                    )}
                  </div>
                  <div>
                    <Label>Data</Label>
                    <Input type="date" {...form.register("incurred_at")} />
                  </div>
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Select
                    value={form.watch("category")}
                    onValueChange={(v) => form.setValue("category", v as (typeof EXPENSE_CATEGORIES)[number])}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EXPENSE_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <ReceiptField
                  value={form.watch("receipt_url") ?? null}
                  onChange={(v) => form.setValue("receipt_url", v)}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={createMut.isPending}>Salvar</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : !expenses.length ? (
          <EmptyState icon={CalendarClock} title="Sem despesas" description={`De ${formatDate(from)} até ${formatDate(to)}.`} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-16 text-center">Comp.</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{formatDate(e.incurred_at)}</TableCell>
                  <TableCell className="font-medium">{e.description ?? "—"}</TableCell>
                  <TableCell><Badge variant="secondary">{e.category ?? "Outros"}</Badge></TableCell>
                  <TableCell className="text-right font-semibold text-destructive">- {formatBRL(e.amount)}</TableCell>
                  <TableCell className="text-center"><ReceiptLink path={e.receipt_url} source="expense" id={e.id} /></TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8"><Trash2 className="h-4 w-4" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover despesa?</AlertDialogTitle>
                          <AlertDialogDescription>Essa ação é permanente.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMut.mutate(e.id)}>Remover</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function MovementsTab({ from, to }: { from: string; to: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listFinancialTransactions);
  const createFn = useServerFn(createFinancialTransaction);
  const deleteFn = useServerFn(deleteFinancialTransaction);
  const markPaidFn = useServerFn(markTransactionPaid);
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useSearchState("mDirection");
  const [statusRaw, setStatusRaw] = useSearchState("mStatus");
  const status = statusRaw as "all" | (typeof TX_STATUSES)[number];
  const setStatus = (v: typeof status) => setStatusRaw(v);
  const [search, setSearch] = useSearchState("mSearch");
  const [markPaidTx, setMarkPaidTx] = useState<{ id: string; description: string } | null>(null);

  const query = useQuery({
    queryKey: ["finance", "movements", from, to, direction, status, search],
    queryFn: () =>
      listFn({
        data: {
          from,
          to,
          direction: direction !== "all" ? direction : undefined,
          status: status !== "all" ? status : undefined,
          search: search.trim() || undefined,
        },
      }),
  });

  const form = useForm<FinancialTxInput>({
    resolver: zodResolver(financialTxSchema),
    defaultValues: {
      direction: "in",
      status: "paid",
      description: "",
      category: "",
      amount: 0,
      method: "pix",
      due_date: "",
      paid_at: todayISO(),
      notes: "",
      receipt_url: null,
    },
  });

  const createMut = useMutation({
    mutationFn: (v: FinancialTxInput) => createFn({ data: v }),
    onSuccess: () => {
      toast.success("Movimentação registrada");
      setOpen(false);
      form.reset({
        direction: "in",
        status: "paid",
        description: "",
        category: "",
        amount: 0,
        method: "pix",
        due_date: "",
        paid_at: todayISO(),
        notes: "",
        receipt_url: null,
      });
      qc.invalidateQueries({ queryKey: ["finance"] });
    },
    onError: (e: unknown) =>
      toast.error("Erro", { description: e instanceof Error ? e.message : "" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Removida");
      qc.invalidateQueries({ queryKey: ["finance"] });
    },
  });

  const markPaidMut = useMutation({
    mutationFn: (v: { id: string; paid_at: string; method: string; receipt_url: string | null }) =>
      markPaidFn({ data: v }),
    onSuccess: () => {
      toast.success("Marcada como paga");
      setMarkPaidTx(null);
      qc.invalidateQueries({ queryKey: ["finance"] });
    },
    onError: (e: unknown) =>
      toast.error("Erro", { description: e instanceof Error ? e.message : "" }),
  });

  const rows = query.data ?? [];
  const totalIn = rows
    .filter((r) => r.direction === "in" && r.status === "paid")
    .reduce((a, b) => a + Number(b.amount), 0);
  const totalOut = rows
    .filter((r) => r.direction === "out" && r.status === "paid")
    .reduce((a, b) => a + Number(b.amount), 0);
  const pending = rows
    .filter((r) => r.status === "pending" || r.status === "overdue")
    .reduce((a, b) => a + Number(b.amount), 0);

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle>Movimentações manuais</CardTitle>
          <p className="text-sm text-muted-foreground">
            {rows.length} lançamento(s) · Entradas {formatBRL(totalIn)} · Saídas {formatBRL(totalOut)} · Pendente {formatBRL(pending)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar descrição/categoria"
              className="h-9 w-[220px] pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={direction} onValueChange={(v) => setDirection(v as typeof direction)}>
            <SelectTrigger className="h-9 w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos tipos</SelectItem>
              <SelectItem value="in">Entradas</SelectItem>
              <SelectItem value="out">Saídas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              {TX_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{txStatusLabel(s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Nova movimentação</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Registrar movimentação</DialogTitle></DialogHeader>
              <form className="space-y-3" onSubmit={form.handleSubmit((v) => createMut.mutate(v))}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Tipo</Label>
                    <Select
                      value={form.watch("direction")}
                      onValueChange={(v) => form.setValue("direction", v as "in" | "out")}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="in">Entrada</SelectItem>
                        <SelectItem value="out">Saída</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select
                      value={form.watch("status") ?? "paid"}
                      onValueChange={(v) => form.setValue("status", v as (typeof TX_STATUSES)[number])}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TX_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>{txStatusLabel(s)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Input {...form.register("description")} placeholder="Ex.: Aporte do sócio" />
                  {form.formState.errors.description && (
                    <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Valor (R$)</Label>
                    <Input type="number" step="0.01" {...form.register("amount")} />
                    {form.formState.errors.amount && (
                      <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>
                    )}
                  </div>
                  <div>
                    <Label>Método</Label>
                    <Select
                      value={form.watch("method") ?? "pix"}
                      onValueChange={(v) => form.setValue("method", v as (typeof TX_METHODS)[number])}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TX_METHODS.map((m) => (
                          <SelectItem key={m} value={m}>{txMethodLabel(m)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Categoria</Label>
                    <Input {...form.register("category")} placeholder="Opcional" />
                  </div>
                  <div>
                    <Label>{form.watch("status") === "paid" ? "Data de pagamento" : "Vencimento"}</Label>
                    <Input
                      type="date"
                      {...form.register(form.watch("status") === "paid" ? "paid_at" : "due_date")}
                    />
                  </div>
                </div>
                <div>
                  <Label>Observações</Label>
                  <Input {...form.register("notes")} />
                </div>
                <ReceiptField
                  value={form.watch("receipt_url") ?? null}
                  onChange={(v) => form.setValue("receipt_url", v)}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={createMut.isPending}>Salvar</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : !rows.length ? (
          <EmptyState icon={ArrowRightLeft} title="Sem movimentações" description="Registre entradas ou saídas manuais." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-16 text-center">Comp.</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{formatDate(t.paid_at ?? t.due_date ?? t.created_at)}</TableCell>
                  <TableCell className="font-medium">{t.description}</TableCell>
                  <TableCell>{t.category ? <Badge variant="secondary">{t.category}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-muted-foreground">{t.method ? txMethodLabel(t.method) : "—"}</TableCell>
                  <TableCell><StatusBadge status={t.status} /></TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-semibold",
                      t.direction === "in" ? "text-emerald-500" : "text-destructive",
                    )}
                  >
                    {t.direction === "in" ? "+" : "-"} {formatBRL(t.amount)}
                  </TableCell>
                  <TableCell className="text-center">
                    <ReceiptLink path={t.receipt_url} source="transaction" id={t.id} />
                  </TableCell>
                  <TableCell className="flex items-center justify-end gap-1">
                    {t.status !== "paid" && t.status !== "cancelled" ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        title="Marcar como paga"
                        onClick={() => setMarkPaidTx({ id: t.id, description: t.description })}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8"><Trash2 className="h-4 w-4" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover?</AlertDialogTitle>
                          <AlertDialogDescription>Essa ação é permanente.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMut.mutate(t.id)}>Remover</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <MarkTxPaidDialog
        tx={markPaidTx}
        onClose={() => setMarkPaidTx(null)}
        onConfirm={(v) => markPaidTx && markPaidMut.mutate({ id: markPaidTx.id, ...v })}
        pending={markPaidMut.isPending}
      />
    </Card>
  );
}

function MarkTxPaidDialog({
  tx,
  onClose,
  onConfirm,
  pending,
}: {
  tx: { id: string; description: string } | null;
  onClose: () => void;
  onConfirm: (v: { paid_at: string; method: string; receipt_url: string | null }) => void;
  pending: boolean;
}) {
  const [paidAt, setPaidAt] = useState(todayISO());
  const [method, setMethod] = useState("pix");
  const [receipt, setReceipt] = useState<string | null>(null);

  return (
    <Dialog open={!!tx} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marcar como paga · {tx?.description}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data do pagamento</Label>
              <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </div>
            <div>
              <Label>Forma de pagamento</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TX_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>{txMethodLabel(m)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <ReceiptField value={receipt} onChange={setReceipt} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => onConfirm({ paid_at: paidAt, method, receipt_url: receipt })}
            disabled={pending}
          >
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function txStatusLabel(s: (typeof TX_STATUSES)[number]) {
  return { pending: "Pendente", paid: "Paga", overdue: "Atrasada", cancelled: "Cancelada" }[s];
}
function txMethodLabel(m: string) {
  return (
    {
      pix: "PIX",
      credit_card: "Cartão de crédito",
      debit_card: "Cartão de débito",
      cash: "Dinheiro",
      boleto: "Boleto",
      transfer: "Transferência",
      other: "Outro",
    } as Record<string, string>
  )[m] ?? m;
}
function StatusBadge({ status }: { status: (typeof TX_STATUSES)[number] }) {
  const map: Record<(typeof TX_STATUSES)[number], { label: string; className: string }> = {
    paid: { label: "Paga", className: "bg-emerald-500/15 text-emerald-500" },
    pending: { label: "Pendente", className: "bg-amber-500/15 text-amber-500" },
    overdue: { label: "Atrasada", className: "bg-destructive/15 text-destructive" },
    cancelled: { label: "Cancelada", className: "bg-muted text-muted-foreground" },
  };
  const v = map[status];
  return <Badge className={v.className} variant="outline">{v.label}</Badge>;
}

function PayPayableDialog({
  orderId,
  orderNumber,
  supplierName,
  balance,
}: {
  orderId: string;
  orderNumber: number | string;
  supplierName: string;
  balance: number;
}) {
  const qc = useQueryClient();
  const payFn = useServerFn(payPayable);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<string>("");
  const [method, setMethod] = useState<string>("pix");
  const [paidAt, setPaidAt] = useState<string>(todayISO());
  const [notes, setNotes] = useState<string>("");
  const [receipt, setReceipt] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: () =>
      payFn({
        data: {
          order_id: orderId,
          amount: Number(amount),
          method,
          paid_at: paidAt,
          notes: notes || null,
          receipt_url: receipt,
        },
      }),
    onSuccess: () => {
      toast.success("Pagamento registrado");
      setOpen(false);
      setAmount("");
      setNotes("");
      setReceipt(null);
      qc.invalidateQueries({ queryKey: ["finance"] });
      qc.invalidateQueries({ queryKey: ["order", orderId] });
    },
    onError: (e: unknown) =>
      toast.error("Erro", { description: e instanceof Error ? e.message : "" }),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v && !amount) setAmount(balance.toFixed(2));
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <CheckCircle2 className="mr-1 h-4 w-4" /> Marcar como paga
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pedido #{orderNumber} · {supplierName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md bg-muted/40 p-3 text-sm">
            Saldo em aberto: <span className="font-semibold text-destructive">{formatBRL(balance)}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor pago (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max={balance.toFixed(2)}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>Data do pagamento</Label>
              <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Forma de pagamento</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="transfer">Transferência</SelectItem>
                <SelectItem value="boleto">Boleto</SelectItem>
                <SelectItem value="credit_card">Cartão de crédito</SelectItem>
                <SelectItem value="debit_card">Cartão de débito</SelectItem>
                <SelectItem value="cash">Dinheiro</SelectItem>
                <SelectItem value="other">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Observações</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <ReceiptField value={receipt} onChange={setReceipt} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            onClick={() => {
              const n = Number(amount);
              if (!Number.isFinite(n) || n <= 0) return toast.error("Informe um valor válido");
              if (n > balance + 0.009) return toast.error("Valor maior que o saldo em aberto");
              mut.mutate();
            }}
            disabled={mut.isPending}
          >
            Confirmar pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============ Payables Tab with filters, history and bulk pay ============ */

function PayablesTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listPayables);
  const bulkFn = useServerFn(bulkPayPayables);

  const [search, setSearch] = useSearchState("pSearch");
  const [from, setFrom] = useSearchState("pFrom");
  const [to, setTo] = useSearchState("pTo");
  const [statusFilter, setStatusFilter] = useSearchState("pStatus");

  const q = useQuery({
    queryKey: ["finance", "payables", search, from, to, statusFilter],
    queryFn: () => listFn({ data: { search, from, to, statusFilter } }),
  });

  const rows = q.data?.rows ?? [];
  const total = q.data?.total ?? 0;

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    if (allChecked) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  }

  const selectedRows = rows.filter((r) => selected.has(r.id));
  const selectedTotal = selectedRows.reduce((a, b) => a + b.balance, 0);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkPaidAt, setBulkPaidAt] = useState(todayISO());
  const [bulkMethod, setBulkMethod] = useState("pix");
  const [bulkReceipt, setBulkReceipt] = useState<string | null>(null);
  const [bulkNotes, setBulkNotes] = useState("");

  const bulkMut = useMutation({
    mutationFn: () =>
      bulkFn({
        data: {
          paid_at: bulkPaidAt,
          method: bulkMethod,
          receipt_url: bulkReceipt,
          notes: bulkNotes || null,
          items: selectedRows.map((r) => ({ order_id: r.id, amount: r.balance })),
        },
      }),
    onSuccess: (res) => {
      toast.success(`${res.count} pagamento(s) registrados`);
      setBulkOpen(false);
      setSelected(new Set());
      setBulkReceipt(null);
      setBulkNotes("");
      qc.invalidateQueries({ queryKey: ["finance"] });
    },
    onError: (e: unknown) =>
      toast.error("Erro", { description: e instanceof Error ? e.message : "" }),
  });

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle>Contas a pagar</CardTitle>
          <p className="text-sm text-muted-foreground">Pedidos com custo em aberto junto a fornecedores.</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Total em aberto</div>
          <div className="text-lg font-semibold">{formatBRL(total)}</div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por fornecedor ou pedido"
              className="h-9 pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Vencimento de</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-[140px]" />
          </div>
          <div>
            <Label className="text-xs">até</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-[140px]" />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="overdue">Atrasados</SelectItem>
              <SelectItem value="upcoming">Próximos 7 dias</SelectItem>
              <SelectItem value="future">Futuros</SelectItem>
              <SelectItem value="no_date">Sem data</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto flex items-center gap-2">
            {selected.size > 0 ? (
              <>
                <span className="text-xs text-muted-foreground">
                  {selected.size} selecionado(s) · {formatBRL(selectedTotal)}
                </span>
                <Button size="sm" onClick={() => setBulkOpen(true)}>
                  <CheckCircle2 className="mr-1 h-4 w-4" /> Pagar em lote
                </Button>
              </>
            ) : null}
          </div>
        </div>

        {q.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : !rows.length ? (
          <EmptyState icon={Wallet} title="Nada a pagar" description="Nenhum saldo pendente com os filtros atuais." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Selecionar todos" />
                </TableHead>
                <TableHead>Pedido</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Custo</TableHead>
                <TableHead className="text-right">Pago</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead className="w-[220px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} data-state={selected.has(r.id) ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(r.id)}
                      onCheckedChange={() => toggle(r.id)}
                      aria-label={`Selecionar pedido ${r.order_number}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">#{r.order_number}</TableCell>
                  <TableCell>{r.suppliers?.name ?? "—"}</TableCell>
                  <TableCell>
                    <DueBadge date={r.expected_delivery ?? r.purchase_date} />
                  </TableCell>
                  <TableCell className="text-right">{formatBRL(r.cost_price)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatBRL(r.paid)}</TableCell>
                  <TableCell className="text-right font-semibold text-destructive">{formatBRL(r.balance)}</TableCell>
                  <TableCell className="flex items-center justify-end gap-1">
                    <PayableHistoryDialog orderId={r.id} orderNumber={r.order_number} supplierName={r.suppliers?.name ?? "—"} />
                    <PayPayableDialog
                      orderId={r.id}
                      orderNumber={r.order_number}
                      supplierName={r.suppliers?.name ?? "—"}
                      balance={r.balance}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pagar {selected.size} conta(s) em lote</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md bg-muted/40 p-3 text-sm">
              Total: <span className="font-semibold text-destructive">{formatBRL(selectedTotal)}</span>
              <div className="mt-1 text-xs text-muted-foreground">
                Cada pedido será quitado pelo saldo em aberto no valor da tabela.
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data do pagamento</Label>
                <Input type="date" value={bulkPaidAt} onChange={(e) => setBulkPaidAt(e.target.value)} />
              </div>
              <div>
                <Label>Forma de pagamento</Label>
                <Select value={bulkMethod} onValueChange={setBulkMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="transfer">Transferência</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                    <SelectItem value="credit_card">Cartão de crédito</SelectItem>
                    <SelectItem value="debit_card">Cartão de débito</SelectItem>
                    <SelectItem value="cash">Dinheiro</SelectItem>
                    <SelectItem value="other">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Input value={bulkNotes} onChange={(e) => setBulkNotes(e.target.value)} />
            </div>
            <ReceiptField value={bulkReceipt} onChange={setBulkReceipt} label="Comprovante (aplicado a todos)" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancelar</Button>
            <Button onClick={() => bulkMut.mutate()} disabled={bulkMut.isPending || !selected.size}>
              Confirmar {selected.size} pagamento(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function PayableHistoryDialog({
  orderId,
  orderNumber,
  supplierName,
}: {
  orderId: string;
  orderNumber: number | string;
  supplierName: string;
}) {
  const [open, setOpen] = useState(false);
  const [pageSize] = useState(20);
  const [page, setPage] = useState(1);
  const historyFn = useServerFn(getPayableHistory);
  const q = useQuery({
    queryKey: ["finance", "payable-history", orderId, page, pageSize],
    queryFn: () => historyFn({ data: { order_id: orderId, page, pageSize } }),
    enabled: open,
  });
  const rows = q.data?.rows ?? [];
  const total = q.data?.total ?? 0;
  const loadedTotal = rows.reduce((a, b) => a + Number(b.amount), 0);
  const hasMore = page * pageSize < total;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setPage(1); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" title="Ver histórico de pagamentos">
          <History className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Histórico · Pedido #{orderNumber} · {supplierName}</DialogTitle>
        </DialogHeader>
        {q.isLoading && page === 1 ? (
          <Skeleton className="h-32 w-full" />
        ) : !rows.length ? (
          <EmptyState title="Sem pagamentos" description="Nenhum pagamento registrado para este pedido." />
        ) : (
          <>
            <div className="rounded-md bg-muted/40 p-3 text-sm">
              Página: <span className="font-semibold text-emerald-500">{formatBRL(loadedTotal)}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                {rows.length} de {total} lançamento(s)
              </span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Observação</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-16 text-right">Comprovante</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{formatDate(p.paid_at)}</TableCell>
                    <TableCell className="text-muted-foreground">{p.method ? txMethodLabel(p.method) : "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{p.notes ?? "—"}</TableCell>
                    <TableCell className="text-right font-semibold text-destructive">
                      - {formatBRL(p.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <ReceiptLink path={p.receipt_url} source="payment" id={p.id} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {hasMore ? (
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={q.isFetching}
                >
                  {q.isFetching ? "Carregando…" : "Carregar mais"}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}


function ReceiptLink({
  path,
  source,
  id,
}: {
  path: string | null | undefined;
  source?: "expense" | "transaction" | "payment";
  id?: string;
}) {
  const [loading, setLoading] = useState(false);
  if (!path) return <span className="text-xs text-muted-foreground">—</span>;
  async function open() {
    setLoading(true);
    try {
      const url = await getReceiptUrl(path!);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      else toast.error("Não foi possível abrir o comprovante");
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="inline-flex items-center gap-0.5">
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={open} disabled={loading} title="Ver comprovante">
        <Eye className="h-3.5 w-3.5" />
      </Button>
      {source && id ? (
        <Button asChild size="icon" variant="ghost" className="h-7 w-7" title="Abrir na tela de anexos">
          <a href={`/anexos?ref_source=${source}&ref_id=${id}`} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Button>
      ) : null}
    </div>
  );
}

