import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
// xlsx / jspdf are lazy-loaded inside the export handlers to keep the initial bundle small.
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  DollarSign,
  FileSpreadsheet,
  FileText,
  Package,
  ShoppingBag,
  TrendingUp,
  Truck,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatBRL, formatNumber, formatDate } from "@/lib/format";
import { getReports, type ReportData } from "@/features/reports/reports.functions";
import { STATUS_LABEL, STATUS_TONE, type OrderStatus } from "@/features/orders/schemas";

export const Route = createFileRoute("/_authenticated/relatorios")({
  component: ReportsPage,
});

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, 210 90% 60%))",
  "hsl(var(--chart-3, 30 90% 60%))",
  "hsl(var(--chart-4, 340 82% 62%))",
  "hsl(var(--chart-5, 160 70% 45%))",
  "hsl(var(--chart-6, 260 70% 65%))",
  "hsl(var(--muted-foreground))",
  "hsl(var(--destructive))",
];

function ReportsPage() {
  const [from, setFrom] = useState(() => format(startOfMonth(subMonths(new Date(), 5)), "yyyy-MM-dd"));
  const [to, setTo] = useState(() => format(endOfMonth(new Date()), "yyyy-MM-dd"));

  const reportsFn = useServerFn(getReports);
  const { data, isLoading } = useQuery({
    queryKey: ["reports", from, to],
    queryFn: () => reportsFn({ data: { from, to } }),
  });

  function setPreset(kind: "month" | "quarter" | "half" | "year") {
    const now = new Date();
    if (kind === "month") {
      setFrom(format(startOfMonth(now), "yyyy-MM-dd"));
      setTo(format(endOfMonth(now), "yyyy-MM-dd"));
    } else if (kind === "quarter") {
      setFrom(format(startOfMonth(subMonths(now, 2)), "yyyy-MM-dd"));
      setTo(format(endOfMonth(now), "yyyy-MM-dd"));
    } else if (kind === "half") {
      setFrom(format(startOfMonth(subMonths(now, 5)), "yyyy-MM-dd"));
      setTo(format(endOfMonth(now), "yyyy-MM-dd"));
    } else {
      setFrom(format(new Date(now.getFullYear(), 0, 1), "yyyy-MM-dd"));
      setTo(format(endOfMonth(now), "yyyy-MM-dd"));
    }
  }

  async function exportExcel() {
    if (!data) return;
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const summary = [
      ["Relatório executivo"],
      ["Período", `${formatDate(from)} - ${formatDate(to)}`],
      [],
      ["Receita", data.totals.revenue],
      ["Custo", data.totals.cost],
      ["Lucro bruto", data.totals.grossProfit],
      ["Despesas", data.totals.totalExpenses],
      ["Lucro líquido", data.totals.netProfit],
      ["Ticket médio", data.totals.ticket],
      ["Pedidos", data.totals.orders],
      ["Clientes ativos", data.totals.clients],
      ["Fornecedores ativos", data.totals.suppliers],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Resumo");
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(data.monthly.map((m) => ({ Mês: m.key, Receita: m.revenue, Lucro: m.profit, Pedidos: m.orders }))),
      "Evolução",
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(data.topClients.map((c) => ({ Cliente: c.name, Pedidos: c.orders, Receita: c.revenue, Lucro: c.profit }))),
      "Clientes",
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(data.topSuppliers.map((s) => ({ Fornecedor: s.name, Pedidos: s.orders, Custo: s.cost }))),
      "Fornecedores",
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(data.topProducts.map((p) => ({ Produto: p.name, Qtd: p.qty, Receita: p.revenue, Lucro: p.profit }))),
      "Produtos",
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        data.orders.map((o) => ({
          Pedido: o.order_number,
          Data: formatDate(o.created_at),
          Status: STATUS_LABEL[o.status as OrderStatus] ?? o.status,
          Cliente: o.client,
          Fornecedor: o.supplier,
          Marca: o.brand,
          Modelo: o.model,
          Referência: o.reference,
          Venda: o.sale_price,
          Custo: o.cost_price,
          Lucro: o.profit,
        })),
      ),
      "Pedidos",
    );
    XLSX.writeFile(wb, `relatorio_${from}_a_${to}.xlsx`);
    toast.success("Excel exportado");
  }

  async function exportPDF() {
    if (!data) return;
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Relatório executivo", 40, 40);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(`Período: ${formatDate(from)} — ${formatDate(to)}`, 40, 58);
    doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")}`, pageW - 40, 58, { align: "right" });
    doc.setTextColor(0);

    autoTable(doc, {
      startY: 80,
      head: [["Indicador", "Valor"]],
      body: [
        ["Receita", formatBRL(data.totals.revenue)],
        ["Custo", formatBRL(data.totals.cost)],
        ["Lucro bruto", formatBRL(data.totals.grossProfit)],
        ["Despesas", formatBRL(data.totals.totalExpenses)],
        ["Lucro líquido", formatBRL(data.totals.netProfit)],
        ["Ticket médio", formatBRL(data.totals.ticket)],
        ["Pedidos", String(data.totals.orders)],
        ["Clientes ativos", String(data.totals.clients)],
        ["Fornecedores ativos", String(data.totals.suppliers)],
      ],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 30, 30] },
    });

    autoTable(doc, {
      head: [["Cliente", "Pedidos", "Receita", "Lucro"]],
      body: data.topClients.slice(0, 15).map((c) => [c.name, c.orders, formatBRL(c.revenue), formatBRL(c.profit)]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 30, 30] },
      didDrawPage: () => {
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
      },
    });

    autoTable(doc, {
      head: [["Fornecedor", "Pedidos", "Custo"]],
      body: data.topSuppliers.slice(0, 15).map((s) => [s.name, s.orders, formatBRL(s.cost)]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 30, 30] },
    });

    autoTable(doc, {
      head: [["Produto", "Qtd", "Receita", "Lucro"]],
      body: data.topProducts.slice(0, 15).map((p) => [p.name, p.qty, formatBRL(p.revenue), formatBRL(p.profit)]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 30, 30] },
    });

    doc.save(`relatorio_${from}_a_${to}.pdf`);
    toast.success("PDF exportado");
  }

  const monthly = data?.monthly ?? [];
  const status = useMemo(
    () =>
      (data?.statusDist ?? []).map((s) => ({
        name: STATUS_LABEL[s.status as OrderStatus] ?? s.status,
        value: s.count,
        raw: s.status,
      })),
    [data],
  );

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <PageHeader
        eyebrow="Gestão"
        title="Relatórios"
        description="Análises executivas de receita, lucro, clientes, fornecedores, pedidos e produtos."
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => setPreset("month")}>Mês</Button>
              <Button size="sm" variant="outline" onClick={() => setPreset("quarter")}>Trim.</Button>
              <Button size="sm" variant="outline" onClick={() => setPreset("half")}>6m</Button>
              <Button size="sm" variant="outline" onClick={() => setPreset("year")}>Ano</Button>
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
            <Button size="sm" variant="outline" onClick={exportExcel} disabled={!data}>
              <FileSpreadsheet className="mr-1 h-4 w-4" /> Excel
            </Button>
            <Button size="sm" onClick={exportPDF} disabled={!data}>
              <FileText className="mr-1 h-4 w-4" /> PDF
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Receita" value={formatBRL(data?.totals.revenue ?? 0)} icon={DollarSign} accent="gold" />
        <StatCard label="Lucro líquido" value={formatBRL(data?.totals.netProfit ?? 0)} icon={TrendingUp} accent={(data?.totals.netProfit ?? 0) >= 0 ? "success" : "warning"} />
        <StatCard label="Pedidos" value={formatNumber(data?.totals.orders ?? 0)} icon={ShoppingBag} />
        <StatCard label="Ticket médio" value={formatBRL(data?.totals.ticket ?? 0)} icon={Package} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Receita e lucro por mês</CardTitle></CardHeader>
          <CardContent className="h-80">
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : !monthly.length ? (
              <EmptyState title="Sem dados" description="Nenhum pedido no período." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthly}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                  <XAxis dataKey="key" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(v)} />
                  <Tooltip formatter={(v: number) => formatBRL(v)} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Legend />
                  <Area type="monotone" dataKey="revenue" name="Receita" stroke="hsl(var(--primary))" fill="url(#rev)" strokeWidth={2} />
                  <Line type="monotone" dataKey="profit" name="Lucro" stroke="hsl(var(--chart-5, 160 70% 45%))" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Pedidos por status</CardTitle></CardHeader>
          <CardContent className="h-80">
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : !status.length ? (
              <EmptyState title="Sem dados" description="Nenhum pedido." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={status} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {status.map((s, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="clients">
        <TabsList className="flex-wrap">
          <TabsTrigger value="clients"><Users className="mr-1 h-4 w-4" /> Clientes</TabsTrigger>
          <TabsTrigger value="suppliers"><Truck className="mr-1 h-4 w-4" /> Fornecedores</TabsTrigger>
          <TabsTrigger value="products"><Package className="mr-1 h-4 w-4" /> Produtos</TabsTrigger>
          <TabsTrigger value="orders"><ShoppingBag className="mr-1 h-4 w-4" /> Pedidos</TabsTrigger>
        </TabsList>

        <TabsContent value="clients">
          <RankingTable
            loading={isLoading}
            columns={["Cliente", "Pedidos", "Receita", "Lucro"]}
            rows={(data?.topClients ?? []).map((c) => [c.name, formatNumber(c.orders), formatBRL(c.revenue), formatBRL(c.profit)])}
          />
        </TabsContent>
        <TabsContent value="suppliers">
          <RankingTable
            loading={isLoading}
            columns={["Fornecedor", "Pedidos", "Custo"]}
            rows={(data?.topSuppliers ?? []).map((s) => [s.name, formatNumber(s.orders), formatBRL(s.cost)])}
          />
        </TabsContent>
        <TabsContent value="products">
          <RankingTable
            loading={isLoading}
            columns={["Produto", "Qtd", "Receita", "Lucro"]}
            rows={(data?.topProducts ?? []).map((p) => [p.name, formatNumber(p.qty), formatBRL(p.revenue), formatBRL(p.profit)])}
          />
        </TabsContent>
        <TabsContent value="orders">
          <OrdersReport data={data} loading={isLoading} />
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader><CardTitle>Volume de pedidos por mês</CardTitle></CardHeader>
        <CardContent className="h-72">
          {isLoading ? (
            <Skeleton className="h-full w-full" />
          ) : monthly.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                <XAxis
                  dataKey="key"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: string) => {
                    const [y, m] = v.split("-");
                    const d = new Date(Number(y), Number(m) - 1, 1);
                    return format(d, "MMM/yy", { locale: ptBR });
                  }}
                />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  formatter={(v: number) => [formatNumber(v), "Pedidos"]}
                  labelFormatter={(v: string) => {
                    const [y, m] = v.split("-");
                    const d = new Date(Number(y), Number(m) - 1, 1);
                    return format(d, "MMMM 'de' yyyy", { locale: ptBR });
                  }}
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="orders" name="Pedidos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState title="Sem dados" description="Nenhum pedido no período." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RankingTable({
  columns,
  rows,
  loading,
}: {
  columns: string[];
  rows: (string | number)[][];
  loading: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        {loading ? (
          <Skeleton className="m-4 h-40" />
        ) : !rows.length ? (
          <div className="p-6">
            <EmptyState title="Sem dados" description="Nada para o período selecionado." />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((c, i) => (
                  <TableHead key={c} className={i === 0 ? "" : "text-right"}>{c}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={i}>
                  {r.map((cell, j) => (
                    <TableCell key={j} className={j === 0 ? "font-medium" : "text-right"}>{cell}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function OrdersReport({ data, loading }: { data: ReportData | undefined; loading: boolean }) {
  return (
    <Card>
      <CardContent className="p-0">
        {loading ? (
          <Skeleton className="m-4 h-40" />
        ) : !data?.orders.length ? (
          <div className="p-6">
            <EmptyState title="Sem pedidos" description="Nenhum pedido no período." />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Venda</TableHead>
                <TableHead className="text-right">Lucro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.orders.slice(0, 100).map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">#{o.order_number}</TableCell>
                  <TableCell>{formatDate(o.created_at)}</TableCell>
                  <TableCell>{o.client}</TableCell>
                  <TableCell className="text-muted-foreground">{[o.brand, o.model].filter(Boolean).join(" ")}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_TONE[o.status as OrderStatus]}>
                      {STATUS_LABEL[o.status as OrderStatus] ?? o.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{formatBRL(o.sale_price)}</TableCell>
                  <TableCell className="text-right font-semibold text-emerald-500">{formatBRL(o.profit)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
