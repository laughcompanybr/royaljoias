import { Suspense, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { logPermissionDenied } from "@/lib/audit.functions";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Landmark,
  Package,
  ReceiptText,
  Truck,
  TrendingUp,
  Users,
  Wallet,
  Activity,
  Sparkles,
} from "lucide-react";


import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { formatBRL, formatNumber } from "@/lib/format";
import { getDashboardStats, type DashboardStats } from "@/lib/dashboard.functions";
import { cn } from "@/lib/utils";

const dashboardQueryOptions = (fn: () => Promise<DashboardStats>) =>
  queryOptions({
    queryKey: ["dashboard-stats"],
    queryFn: fn,
    staleTime: 30_000,
  });

/**
 * Open a print-optimized window with the monthly profit breakdown, then
 * trigger the browser's print dialog so the user can save it as PDF.
 * Uses only DOM APIs — no extra dependency required.
 */
function exportBreakdownPdf(data: DashboardStats) {
  const fmt = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const now = new Date();
  const monthLabel = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const taxLabel = data.taxRate.toFixed(2).replace(/\.?0+$/, "");
  const clampedNote = data.taxRateClamped
    ? `<p class="warn">Aviso: a alíquota configurada${
        data.taxRateRaw !== null ? ` (${data.taxRateRaw}%)` : ""
      } estava fora de 0%–100% e foi ajustada para ${taxLabel}%.</p>`
    : "";
  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"/>
<title>Detalhamento do lucro — ${monthLabel}</title>
<style>
  * { box-sizing: border-box; }
  body { font: 14px/1.5 -apple-system, Segoe UI, Roboto, sans-serif; color: #0f172a; margin: 32px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { color: #64748b; margin: 0 0 24px; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: left; }
  td.n { text-align: right; font-variant-numeric: tabular-nums; }
  tr.total td { border-top: 2px solid #0f172a; border-bottom: none; font-weight: 700; }
  .warn { background: #fef3c7; border: 1px solid #f59e0b; color: #92400e; padding: 8px 12px; border-radius: 6px; font-size: 12px; margin: 12px 0; }
  .foot { margin-top: 24px; color: #64748b; font-size: 11px; }
</style></head>
<body>
  <h1>Detalhamento do lucro — ${monthLabel}</h1>
  <p class="sub">Gerado em ${now.toLocaleString("pt-BR")}</p>
  ${clampedNote}
  <table>
    <tbody>
      <tr><td>Lucro bruto</td><td class="n">${fmt(data.profitGrossMonth)}</td></tr>
      <tr><td>− Despesas do mês</td><td class="n">−${fmt(data.expensesMonth)}</td></tr>
      <tr><td>− Imposto (${taxLabel}% sobre o lucro bruto)</td><td class="n">−${fmt(data.taxAmountMonth)}</td></tr>
      <tr class="total"><td>= Lucro líquido</td><td class="n">${fmt(data.profitMonth)}</td></tr>
    </tbody>
  </table>
  <p class="foot">Fórmula: Lucro líquido = Lucro bruto − Despesas − max(Lucro bruto, 0) × alíquota.</p>
  <script>window.addEventListener('load', () => setTimeout(() => window.print(), 200));</script>
</body></html>`;
  const w = window.open("", "_blank", "noopener,noreferrer,width=800,height=900");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}


export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
  errorComponent: ({ error }) => <DashboardErrorBoundary error={error} />,
});

function DashboardErrorBoundary({ error }: { error: Error }) {
  const raw = error?.message ?? "";
  const isPermission =
    /permission denied|is_staff_or_admin|has_role|not authorized|forbidden|42501/i.test(
      raw,
    );
  const navigate = useNavigate();
  const logDenied = useServerFn(logPermissionDenied);

  useEffect(() => {
    if (!isPermission) return;
    const fnMatch = raw.match(/(is_staff_or_admin|has_role)/i);
    // Best-effort: registra na trilha e redireciona para /access-denied.
    logDenied({
      data: {
        route: "/dashboard",
        functionName: fnMatch?.[1],
        message: raw.slice(0, 500),
      },
    }).catch(() => undefined);
    navigate({
      to: "/access-denied",
      search: { from: "/dashboard", reason: fnMatch?.[1] ?? "rls" },
      replace: true,
    });
  }, [isPermission, logDenied, navigate, raw]);

  return (
    <div className="p-8" data-testid="dashboard-error">
      {isPermission ? (
        <EmptyState
          title="Acesso restrito"
          description="Redirecionando para a área segura…"
        />
      ) : (
        <EmptyState
          title="Não foi possível carregar o dashboard"
          description={raw || "Erro inesperado ao carregar os dados."}
        />
      )}
    </div>
  );
}


function DashboardPage() {
  return (
    <>
      <PageHeader
        eyebrow="Visão geral"
        title="Bom trabalho, hoje."
        description="Painel executivo com o pulso da operação Royal Joias em tempo real."
      />
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </>
  );
}

function DashboardContent() {
  const fetchStats = useServerFn(getDashboardStats);
  const { data } = useSuspenseQuery(dashboardQueryOptions(fetchStats));

  const margin =
    data.revenueMonth > 0 ? (data.profitMonth / data.revenueMonth) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* HERO KPIs — dense bento row */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile
          eyebrow="Receita · mês"
          value={formatBRL(data.revenueMonth)}
          icon={TrendingUp}
          accent="gold"
          delay={0}
          featured
        />
        <KpiTile
          eyebrow="Lucro · mês"
          value={formatBRL(data.profitMonth)}
          hint={`Margem ${margin.toFixed(1)}% · líquido após despesas e imposto`}
          icon={CircleDollarSign}
          accent="success"
          delay={0.04}
        />
        <KpiTile
          eyebrow={`Imposto · ${data.taxRate.toFixed(2).replace(/\.?0+$/, "")}%`}
          value={formatBRL(data.taxAmountMonth)}
          hint="Calculado sobre o lucro bruto"
          icon={Landmark}
          accent="warning"
          delay={0.08}
        />
        <KpiTile
          eyebrow="Despesas · mês"
          value={formatBRL(data.expensesMonth)}
          hint="Abatido do lucro"
          icon={ReceiptText}
          delay={0.12}
        />
      </section>

      {/* Detalhamento do mês — auditoria rápida do cálculo do lucro líquido */}
      <section
        data-testid="profit-breakdown"
        className="rounded-xl border border-border bg-card/40 p-4"
      >
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-medium">Detalhamento do lucro · mês</h2>
          <div className="flex items-center gap-3">
            <p className="text-[11px] text-muted-foreground">
              Lucro bruto − Despesas − Imposto ({data.taxRate.toFixed(2).replace(/\.?0+$/, "")}%) = Lucro líquido
            </p>
            <button
              type="button"
              data-testid="export-breakdown-pdf"
              onClick={() => exportBreakdownPdf(data)}
              className="rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium hover:bg-accent"
            >
              Exportar PDF
            </button>
          </div>
        </div>
        {data.taxRateClamped ? (
          <div
            role="alert"
            data-testid="tax-clamp-warning"
            className="mb-3 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300"
          >
            A alíquota de imposto configurada
            {data.taxRateRaw !== null ? ` (${data.taxRateRaw}%)` : ""}
            {" "}estava fora do intervalo válido de 0% a 100% e foi ajustada automaticamente para {data.taxRate}%.
            Atualize o valor em Configurações para evitar este aviso.
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <div className="rounded-md border border-border/70 bg-background/60 p-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Lucro bruto</p>
            <p data-testid="pb-gross" className="mt-1 font-display text-lg">{formatBRL(data.profitGrossMonth)}</p>
          </div>
          <div className="rounded-md border border-border/70 bg-background/60 p-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">− Despesas</p>
            <p data-testid="pb-expenses" className="mt-1 font-display text-lg text-destructive">−{formatBRL(data.expensesMonth)}</p>
          </div>
          <div className="rounded-md border border-border/70 bg-background/60 p-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              − Imposto ({data.taxRate.toFixed(2).replace(/\.?0+$/, "")}%)
            </p>
            <p data-testid="pb-tax" className="mt-1 font-display text-lg text-destructive">−{formatBRL(data.taxAmountMonth)}</p>
          </div>
          <div className="rounded-md border border-primary/60 bg-primary/5 p-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">= Lucro líquido</p>
            <p
              data-testid="pb-net"
              className={`mt-1 font-display text-lg ${data.profitMonth >= 0 ? "text-emerald-500" : "text-destructive"}`}
            >
              {formatBRL(data.profitMonth)}
            </p>
          </div>
        </div>
      </section>


      {/* Financeiro consolidado */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <MiniKpi label="A receber" value={formatBRL(data.receivable)} icon={Wallet} />
        <MiniKpi label="Comissão · mês" value={formatBRL(data.commissionMonth)} icon={CircleDollarSign} />
        <MiniKpi label="Taxas cartão · mês" value={formatBRL(data.cardFeesMonth)} icon={ReceiptText} />
        <MiniKpi label="Frete · mês" value={formatBRL(data.shippingMonth)} icon={Truck} />
        <MiniKpi label="Recebido · mês" value={formatBRL(data.receivedMonth)} icon={ArrowUpRight} />
        <MiniKpi label="Pendente · mês" value={formatBRL(data.pendingMonth)} icon={ArrowDownRight} />

      </section>


      {/* Row 2: main chart + secondary KPIs */}
      <section className="grid grid-cols-1 gap-3 lg:grid-cols-6">
        <RevenueChart data={data.monthly} className="lg:col-span-4" />
        <div className="grid grid-cols-2 gap-3 lg:col-span-2 lg:grid-cols-1">
          <MiniKpi label="Clientes" value={formatNumber(data.clientsTotal)} icon={Users} />
          <MiniKpi label="Pedidos · mês" value={formatNumber(data.ordersMonth)} icon={Package} />
          <MiniKpi label="Relógios · mês" value={formatNumber(data.watchesSoldMonth)} icon={Package} />
          <MiniKpi label="Ticket médio" value={formatBRL(data.avgTicket)} icon={Sparkles} />
          <MiniKpi label="Lucro médio" value={formatBRL(data.avgProfit)} icon={CircleDollarSign} />
        </div>

      </section>

      {/* Controle mensal: comparativo + top produtos */}
      <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <MonthlyComparison
          revenueMonth={data.revenueMonth}
          profitMonth={data.profitMonth}
          revenuePrev={data.monthComparison.revenuePrev}
          profitPrev={data.monthComparison.profitPrev}
          revenueDelta={data.monthComparison.revenueDelta}
          profitDelta={data.monthComparison.profitDelta}
        />
        <TopProducts items={data.topProducts} className="lg:col-span-2" />
      </section>

      {/* Row 3: orders chart + pipeline */}
      <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <OrdersChart data={data.monthly} className="lg:col-span-2" />
        <PipelineStack pipeline={data.pipeline} />
      </section>

      {/* Row 4: activity full width */}
      <section>
        <RecentActivity items={data.activity} />
      </section>
    </div>
  );
}

function MonthlyComparison({
  revenueMonth,
  profitMonth,
  revenuePrev,
  profitPrev,
  revenueDelta,
  profitDelta,
}: {
  revenueMonth: number;
  profitMonth: number;
  revenuePrev: number;
  profitPrev: number;
  revenueDelta: number;
  profitDelta: number;
}) {
  const Row = ({ label, current, prev, delta }: { label: string; current: number; prev: number; delta: number }) => (
    <li className="rounded-xl border border-border/60 bg-secondary/20 p-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn("text-xs font-medium", delta >= 0 ? "text-[color:var(--color-success)]" : "text-destructive")}>
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
        </span>
      </div>
      <div className="mt-1 flex items-baseline justify-between">
        <span className="font-display text-lg">{formatBRL(current)}</span>
        <span className="text-xs text-muted-foreground">Ant.: {formatBRL(prev)}</span>
      </div>
    </li>
  );
  return (
    <div className="bento-tile p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Comparação mensal</p>
      <h3 className="font-display text-lg">Mês atual vs anterior</h3>
      <ul className="mt-4 space-y-2.5">
        <Row label="Receita" current={revenueMonth} prev={revenuePrev} delta={revenueDelta} />
        <Row label="Lucro" current={profitMonth} prev={profitPrev} delta={profitDelta} />
      </ul>
    </div>
  );
}

function TopProducts({ items, className }: { items: DashboardStats["topProducts"]; className?: string }) {
  return (
    <div className={cn("bento-tile p-5", className)}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Ranking</p>
      <h3 className="font-display text-lg">Produtos mais vendidos · mês</h3>
      {items.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Sem vendas no mês"
          description="Os relógios mais vendidos aparecerão aqui."
        />
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((p, i) => (
            <li key={p.label} className="flex items-center gap-3 rounded-lg border border-border/50 bg-secondary/20 px-3 py-2 text-sm">
              <span className="grid size-7 shrink-0 place-items-center rounded-md bg-background/60 font-mono text-xs">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate">{p.label}</span>
              <span className="text-xs text-muted-foreground">{p.quantity} un</span>
              <span className="font-display text-sm">{formatBRL(p.revenue)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


/* ------------ KPI TILES ------------ */

function KpiTile({
  eyebrow,
  value,
  hint,
  icon: Icon,
  accent = "default",
  delay = 0,
  featured = false,
}: {
  eyebrow: string;
  value: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  accent?: "default" | "gold" | "success" | "warning";
  delay?: number;
  featured?: boolean;
}) {
  const accentText =
    accent === "gold"
      ? "text-gold"
      : accent === "success"
        ? "text-[color:var(--color-success)]"
        : accent === "warning"
          ? "text-[color:var(--color-warning)]"
          : "text-foreground";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn("bento-tile group p-4 sm:p-5", featured && "sm:row-span-1")}
    >
      {featured ? (
        <div className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full bg-[color:var(--color-gold)]/10 blur-3xl transition-opacity duration-500 group-hover:opacity-80" />
      ) : null}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {eyebrow}
        </span>
        {Icon ? (
          <span className="grid size-8 place-items-center rounded-lg border border-border bg-secondary/40">
            <Icon className={cn("size-4", accentText)} />
          </span>
        ) : null}
      </div>
      <p
        className={cn(
          "mt-5 font-display leading-none tracking-tight",
          featured ? "text-3xl sm:text-[2.1rem]" : "text-2xl sm:text-[1.7rem]",
          featured && accent === "gold" ? "text-gold-shine" : accentText,
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-2 text-[11px] text-muted-foreground">{hint}</p>
      ) : (
        <div className="mt-2 h-[11px]" />
      )}
    </motion.div>
  );
}

function MiniKpi({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="bento-tile flex items-center justify-between gap-3 p-4"
    >
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </p>
        <p className="mt-1.5 truncate font-display text-lg leading-tight">{value}</p>
      </div>
      <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-secondary/40">
        <Icon className="size-4 text-gold" />
      </span>
    </motion.div>
  );
}

/* ------------ PIPELINE ------------ */

function PipelineStack({ pipeline }: { pipeline: DashboardStats["pipeline"] }) {
  const items = [
    { title: "Aguardando pagamento", count: pipeline.awaitingPayment, icon: Clock, tone: "text-[color:var(--color-warning)]" },
    { title: "Em transporte", count: pipeline.inTransit, icon: Truck, tone: "text-gold" },
    { title: "Entregues", count: pipeline.delivered, icon: CheckCircle2, tone: "text-[color:var(--color-success)]" },
  ];
  const total = items.reduce((a, b) => a + b.count, 0);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bento-tile p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Pipeline
          </p>
          <h3 className="font-display text-lg">Status atual</h3>
        </div>
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {total} totais
        </span>
      </div>
      <ul className="space-y-2.5">
        {items.map((it) => {
          const pct = total ? Math.max(4, Math.round((it.count / total) * 100)) : 0;
          return (
            <li key={it.title} className="rounded-xl border border-border/60 bg-secondary/20 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <it.icon className={cn("size-4", it.tone)} />
                  <span className="text-sm">{it.title}</span>
                </div>
                <span className="font-display text-lg">{it.count}</span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-background/60">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                  className={cn(
                    "h-full rounded-full",
                    it.tone.includes("success")
                      ? "bg-[color:var(--color-success)]"
                      : it.tone.includes("warning")
                        ? "bg-[color:var(--color-warning)]"
                        : "bg-gold",
                  )}
                  style={{ backgroundColor: undefined }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </motion.div>
  );
}

/* ------------ CHARTS ------------ */

function ChartShell({
  title,
  eyebrow,
  className,
  children,
}: {
  title: string;
  eyebrow: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn("bento-tile p-5 sm:p-6", className)}
    >
      <div className="mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {eyebrow}
        </p>
        <h3 className="font-display text-lg sm:text-xl">{title}</h3>
      </div>
      <div className="h-60 w-full sm:h-64">{children}</div>
    </motion.div>
  );
}

function RevenueChart({ data, className }: { data: DashboardStats["monthly"]; className?: string }) {
  return (
    <ChartShell eyebrow="Últimos 6 meses" title="Receita e lucro" className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-gold)" stopOpacity={0.45} />
              <stop offset="100%" stopColor="var(--color-gold)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradProfit" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-success)" stopOpacity={0.38} />
              <stop offset="100%" stopColor="var(--color-success)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 6" vertical={false} />
          <XAxis dataKey="month" tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
          />
          <Tooltip content={<ChartTooltip currency />} cursor={{ stroke: "var(--color-border)" }} />
          <Area type="monotone" dataKey="revenue" name="Receita" stroke="var(--color-gold)" strokeWidth={2} fill="url(#gradRevenue)" />
          <Area type="monotone" dataKey="profit" name="Lucro" stroke="var(--color-success)" strokeWidth={2} fill="url(#gradProfit)" />
        </AreaChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

function OrdersChart({ data, className }: { data: DashboardStats["monthly"]; className?: string }) {
  return (
    <ChartShell eyebrow="Volume" title="Pedidos por mês" className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 6" vertical={false} />
          <XAxis dataKey="month" tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--color-accent)", opacity: 0.4 }} />
          <Bar dataKey="orders" name="Pedidos" fill="var(--color-gold)" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

interface TooltipPayload {
  name?: string;
  value?: number;
  color?: string;
  dataKey?: string;
}
function ChartTooltip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
  currency?: boolean;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <p className="mb-1 font-medium capitalize text-muted-foreground">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium text-foreground">
            {currency ? formatBRL(entry.value ?? 0) : formatNumber(entry.value ?? 0)}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ------------ ACTIVITY ------------ */

const EVENT_ICON: Record<string, { icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  created: { icon: ArrowUpRight, tone: "text-gold" },
  status_changed: { icon: Activity, tone: "text-[color:var(--color-success)]" },
  payment: { icon: CircleDollarSign, tone: "text-[color:var(--color-success)]" },
  cancelled: { icon: ArrowDownRight, tone: "text-destructive" },
};

function RecentActivity({ items }: { items: DashboardStats["activity"] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bento-tile p-5 sm:p-6"
    >
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Timeline
          </p>
          <h3 className="font-display text-lg sm:text-xl">Atividades recentes</h3>
        </div>
      </div>
      {items.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="Sem atividade ainda"
          description="Os eventos dos seus pedidos aparecerão aqui em tempo real."
        />
      ) : (
        <ul className="space-y-2">
          {items.map((item, i) => {
            const conf = EVENT_ICON[item.type] ?? EVENT_ICON.status_changed;
            const Icon = conf.icon;
            return (
              <motion.li
                key={item.id}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.03 }}
                className="group flex items-start gap-3 rounded-xl border border-border/50 bg-secondary/15 px-4 py-3 transition-all hover:border-gold/30 hover:bg-secondary/30"
              >
                <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-background/60 ring-1 ring-border/60 transition-transform group-hover:scale-105">
                  <Icon className={cn("size-4", conf.tone)} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">
                    {item.message ?? item.type}
                    {item.order_number !== null ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        · Pedido #{item.order_number}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(item.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}
    </motion.div>
  );
}
