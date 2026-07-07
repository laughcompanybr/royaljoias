import { createFileRoute } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format, startOfMonth } from "date-fns";
import { toast } from "sonner";
import {
  Download,
  Eye,
  Filter,
  Loader2,
  Paperclip,
  Receipt as ReceiptIcon,
  Search,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatBRL, formatDate } from "@/lib/format";
import {
  listReceipts,
  getReceiptSignedUrl,
  deleteReceipt,
  type ReceiptRow,
} from "@/features/finance/receipts.functions";

const searchSchema = z.object({
  from: fallback(z.string(), "").default(""),
  to: fallback(z.string(), "").default(""),
  source: fallback(z.string(), "all").default("all"),
  q: fallback(z.string(), "").default(""),
  ref_source: fallback(z.string(), "").default(""),
  ref_id: fallback(z.string(), "").default(""),
  order_id: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/_authenticated/anexos")({
  validateSearch: zodValidator(searchSchema),
  component: AnexosPage,
});

type SourceFilter = "all" | "expense" | "transaction" | "payment";

const SOURCE_TONE: Record<ReceiptRow["source"], string> = {
  expense: "bg-rose-500/10 text-rose-600 border-rose-500/30",
  transaction: "bg-sky-500/10 text-sky-600 border-sky-500/30",
  payment: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
};

const PAGE_SIZE = 20;

function isPdf(path: string) {
  return /\.pdf(\?|$)/i.test(path);
}

function AnexosPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();

  const [from, setFrom] = useState(search.from || format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [to, setTo] = useState(search.to || format(new Date(), "yyyy-MM-dd"));
  const [source, setSource] = useState<SourceFilter>(
    (["all", "expense", "transaction", "payment"].includes(search.source)
      ? search.source
      : "all") as SourceFilter,
  );
  const [searchText, setSearchText] = useState(search.q || "");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [preview, setPreview] = useState<{ row: ReceiptRow; url: string } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<ReceiptRow | null>(null);

  const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);
  const validRefSource = ["expense", "transaction", "payment"].includes(search.ref_source)
    ? (search.ref_source as "expense" | "transaction" | "payment")
    : null;
  const validRefId = isUuid(search.ref_id) ? search.ref_id : null;
  const validOrderId = isUuid(search.order_id) ? search.order_id : null;
  const hasRef = (validRefSource && validRefId) || validOrderId;

  const fetchList = useServerFn(listReceipts);
  const fetchSigned = useServerFn(getReceiptSignedUrl);
  const removeReceipt = useServerFn(deleteReceipt);

  const listQ = useQuery({
    queryKey: [
      "receipts",
      { from, to, source, search: searchText, validRefSource, validRefId, validOrderId },
    ],
    queryFn: () =>
      fetchList({
        data: {
          from,
          to,
          source,
          search: searchText.trim() || null,
          ref_source: validRefSource,
          ref_id: validRefId,
          order_id: validOrderId,
        },
      }),
  });

  // reset pagination whenever filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [from, to, source, searchText, validRefSource, validRefId, validOrderId]);

  const rows = listQ.data ?? [];
  const visibleRows = rows.slice(0, visibleCount);
  const hasMore = visibleCount < rows.length;

  const totals = useMemo(() => {
    const t = { count: rows.length, sum: 0 };
    for (const r of rows) t.sum += Number(r.amount ?? 0);
    return t;
  }, [rows]);

  const deleteMut = useMutation({
    mutationFn: (r: ReceiptRow) => removeReceipt({ data: { source: r.source, id: r.id, path: r.path } }),
    onSuccess: () => {
      toast.success("Comprovante excluído");
      qc.invalidateQueries({ queryKey: ["receipts"] });
      setPendingDelete(null);
    },
    onError: (e) => toast.error((e as Error).message ?? "Falha ao excluir"),
  });

  async function openReceipt(row: ReceiptRow, mode: "preview" | "tab" | "download") {
    setBusyId(row.id);
    try {
      const { url } = await fetchSigned({ data: { path: row.path, expires_in: 300 } });
      if (mode === "download") {
        const a = document.createElement("a");
        a.href = url;
        a.download = row.path.split("/").pop() ?? "comprovante";
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else if (mode === "tab") {
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        setZoom(1);
        setPreview({ row, url });
      }
    } catch (e) {
      toast.error((e as Error).message ?? "Não foi possível abrir o comprovante");
    } finally {
      setBusyId(null);
    }
  }

  function clearRef() {
    navigate({
      search: (prev: z.infer<typeof searchSchema>) => ({
        ...prev,
        ref_source: "",
        ref_id: "",
        order_id: "",
      }),
      replace: true,
    });
  }

  return (
    <>
      <PageHeader
        eyebrow="Financeiro"
        title="Anexos"
        description="Comprovantes de despesas, movimentos e pagamentos. Visíveis apenas para você e para a equipe autorizada."
      />

      {hasRef ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
          <span>
            Exibindo apenas comprovantes do registro selecionado
            {validOrderId ? " (pedido)" : ""}.
          </span>
          <Button size="sm" variant="ghost" onClick={clearRef} className="h-7">
            <X className="mr-1 h-3 w-3" /> Limpar filtro
          </Button>
        </div>
      ) : null}

      <Card className="mb-4">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs">De</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              max={to || undefined}
              disabled={!!hasRef}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Até</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              min={from || undefined}
              disabled={!!hasRef}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tipo</Label>
            <Select value={source} onValueChange={(v) => setSource(v as SourceFilter)} disabled={!!hasRef}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="expense">Despesas</SelectItem>
                <SelectItem value="transaction">Movimentos</SelectItem>
                <SelectItem value="payment">Pagamentos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Buscar</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Descrição, categoria…"
                className="pl-8"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Filter className="h-3.5 w-3.5" />
        <span>
          Exibindo {Math.min(visibleCount, rows.length)} de {totals.count} anexo
          {totals.count === 1 ? "" : "s"} · Total{" "}
          <strong className="text-foreground">{formatBRL(totals.sum)}</strong>
        </span>
      </div>

      <Card>
        <CardContent className="p-0">
          {listQ.isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={ReceiptIcon}
              title="Nenhum comprovante encontrado"
              description="Ajuste os filtros ou anexe comprovantes em uma despesa, movimento ou pagamento."
            />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="w-40 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleRows.map((r) => (
                      <TableRow key={`${r.source}-${r.id}`}>
                        <TableCell>
                          <Badge variant="outline" className={SOURCE_TONE[r.source]}>
                            {r.source_label}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[420px]">
                          <div className="truncate font-medium">{r.description}</div>
                          {r.extra ? (
                            <div className="truncate text-xs text-muted-foreground">{r.extra}</div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {r.date ? formatDate(r.date) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatBRL(r.amount ?? 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => openReceipt(r, "preview")}
                              disabled={busyId === r.id}
                              title="Visualizar"
                            >
                              {busyId === r.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => openReceipt(r, "download")}
                              disabled={busyId === r.id}
                              title="Baixar"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setPendingDelete(r)}
                              disabled={busyId === r.id || deleteMut.isPending}
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <ul className="divide-y divide-border md:hidden">
                {visibleRows.map((r) => (
                  <li key={`${r.source}-${r.id}`} className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <Badge variant="outline" className={SOURCE_TONE[r.source]}>
                            {r.source_label}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground">
                            {r.date ? formatDate(r.date) : "—"}
                          </span>
                        </div>
                        <p className="truncate text-sm font-medium">{r.description}</p>
                        {r.extra ? (
                          <p className="truncate text-xs text-muted-foreground">{r.extra}</p>
                        ) : null}
                        <p className="mt-1 font-mono text-sm">{formatBRL(r.amount ?? 0)}</p>
                      </div>
                      <div className="flex shrink-0 flex-col gap-1">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          onClick={() => openReceipt(r, "preview")}
                          disabled={busyId === r.id}
                          aria-label="Visualizar comprovante"
                        >
                          {busyId === r.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          onClick={() => openReceipt(r, "download")}
                          disabled={busyId === r.id}
                          aria-label="Baixar comprovante"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setPendingDelete(r)}
                          disabled={busyId === r.id || deleteMut.isPending}
                          aria-label="Excluir comprovante"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              {hasMore ? (
                <div className="flex justify-center p-4">
                  <Button
                    variant="outline"
                    onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  >
                    Carregar mais ({rows.length - visibleCount} restantes)
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <p className="mt-4 flex items-start gap-1.5 text-[11px] text-muted-foreground">
        <Paperclip className="mt-0.5 h-3 w-3 shrink-0" />
        Os arquivos são acessados por URLs assinadas de curta duração e restritos por regras de segurança do banco de dados.
      </p>

      {/* Preview modal */}
      <Dialog
        open={!!preview}
        onOpenChange={(o) => {
          if (!o) setPreview(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden p-0">
          <DialogHeader className="border-b px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <DialogTitle className="truncate text-sm">
                {preview?.row.description ?? "Comprovante"}
              </DialogTitle>
              <div className="flex items-center gap-1">
                {preview && !isPdf(preview.row.path) ? (
                  <>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
                      aria-label="Diminuir zoom"
                    >
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <span className="w-12 text-center text-xs tabular-nums">
                      {Math.round(zoom * 100)}%
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
                      aria-label="Aumentar zoom"
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                  </>
                ) : null}
                {preview ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openReceipt(preview.row, "download")}
                  >
                    <Download className="mr-1 h-3.5 w-3.5" /> Baixar
                  </Button>
                ) : null}
              </div>
            </div>
          </DialogHeader>
          <div className="max-h-[75vh] overflow-auto bg-muted/40">
            {preview ? (
              isPdf(preview.row.path) ? (
                <iframe
                  src={preview.url}
                  title="Pré-visualização de PDF"
                  className="h-[75vh] w-full border-0"
                />
              ) : (
                <div className="flex min-h-[50vh] items-center justify-center p-4">
                  <img
                    src={preview.url}
                    alt={preview.row.description}
                    style={{ transform: `scale(${zoom})`, transformOrigin: "center top" }}
                    className="max-w-full origin-top transition-transform"
                  />
                </div>
              )
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => {
          if (!o) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir comprovante?</AlertDialogTitle>
            <AlertDialogDescription>
              O arquivo será removido permanentemente do armazenamento e a referência
              no registro <strong>{pendingDelete?.source_label.toLowerCase()}</strong> será limpa.
              Esta ação é registrada no log de auditoria e não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMut.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (pendingDelete) deleteMut.mutate(pendingDelete);
              }}
              disabled={deleteMut.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMut.isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-1 h-4 w-4" />
              )}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
