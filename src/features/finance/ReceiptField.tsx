import { useEffect, useRef, useState } from "react";
import { Loader2, Upload, X, Paperclip, FileText, Eye, Check, AlertCircle, Ban, Send } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  RECEIPT_ALLOWED_DESCRIPTION,
  ReceiptValidationException,
  normalizeReceiptExt,
  validateReceiptFile,
} from "./receipt-validation";
import { logReceiptUploadError } from "./receipt-telemetry.functions";
import { getReceiptSignedUrl } from "./receipts.functions";

interface Props {
  value: string | null | undefined;
  onChange: (path: string | null) => void;
  label?: string;
}

interface Preview {
  url: string;
  mime: string;
  name: string;
  size: number;
  file: File;
}

const BUCKET = "finance-receipts";

async function reportUploadError(
  log: ReturnType<typeof useServerFn<typeof logReceiptUploadError>>,
  payload: {
    file: { name: string; size: number; type: string };
    pathPrefix: string;
    code: string;
    message: string;
  },
) {
  try {
    await log({
      data: {
        bucket: BUCKET,
        path_prefix: payload.pathPrefix,
        file_ext: normalizeReceiptExt(payload.file.name, payload.file.type),
        mime: payload.file.type || null,
        size_bytes: payload.file.size,
        error_code: payload.code,
        error_message: payload.message,
        route: typeof window !== "undefined" ? window.location.pathname : null,
      },
    });
  } catch {
    /* telemetry never blocks */
  }
}

function uploadWithProgress(
  path: string,
  file: File,
  onProgress: (pct: number) => void,
): { promise: Promise<void>; abort: () => void } {
  const ctrl = new AbortController();
  let ticker: ReturnType<typeof setInterval> | null = null;

  const promise = (async () => {
    let pct = 5;
    onProgress(pct);
    ticker = setInterval(() => {
      pct = Math.min(pct + 5, 90);
      onProgress(pct);
    }, 250);

    try {
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, {
          contentType: file.type || undefined,
          cacheControl: "3600",
          upsert: true,
        });

      if (ctrl.signal.aborted) throw new DOMException("Upload cancelado", "AbortError");
      if (error) {
        const raw = (error as { message?: string }).message ?? "Falha ao enviar comprovante";
        if (/bucket not found/i.test(raw)) {
          const err = new Error(
            "Armazenamento indisponível: bucket de comprovantes não encontrado. Contate o suporte.",
          );
          (err as Error & { code?: string }).code = "bucket_not_found";
          throw err;
        }
        if (/row-level security|unauthorized|not authorized|jwt/i.test(raw)) {
          const err = new Error("Sem permissão para anexar comprovante. Verifique seu acesso.");
          (err as Error & { code?: string }).code = "unauthorized";
          throw err;
        }
        if (/payload too large|exceeds|too large/i.test(raw)) {
          const err = new Error(`Arquivo excede o limite do armazenamento. ${RECEIPT_ALLOWED_DESCRIPTION}`);
          (err as Error & { code?: string }).code = "too_large";
          throw err;
        }
        const err = new Error(raw);
        (err as Error & { code?: string }).code = "storage_error";
        throw err;
      }
      onProgress(100);
    } finally {
      if (ticker) clearInterval(ticker);
    }
  })();

  return { promise, abort: () => ctrl.abort() };
}

export function ReceiptField({ value, onChange, label = "Comprovante" }: Props) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  // `preview` is the local staged file (before the user hits "Enviar"),
  // `remoteUrl` is the signed URL for an already-uploaded receipt.
  const [preview, setPreview] = useState<Preview | null>(null);
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const abortRef = useRef<(() => void) | null>(null);
  const logError = useServerFn(logReceiptUploadError);

  useEffect(() => {
    let cancelled = false;
    if (!value || preview) {
      setRemoteUrl(null);
      return;
    }
    getReceiptUrl(value).then((url) => {
      if (!cancelled) setRemoteUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [value, preview]);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview.url);
  }, [preview]);

  // Stage the file: validate, generate a preview, wait for user confirmation.
  function selectFile(file: File) {
    setError(null);
    setSavedAt(null);
    setProgress(0);

    try {
      validateReceiptFile(file);
    } catch (e) {
      const err = e as ReceiptValidationException;
      setError(err.message);
      toast.error(err.message);
      if (ref.current) ref.current.value = "";
      return;
    }

    if (preview) URL.revokeObjectURL(preview.url);
    const objectUrl = URL.createObjectURL(file);
    setPreview({ url: objectUrl, mime: file.type, name: file.name, size: file.size, file });
  }

  async function confirmUpload() {
    if (!preview) return;
    const { file } = preview;
    setError(null);
    setUploading(true);
    let pathPrefix = "";
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) {
        throw new Error("Sessão expirada. Faça login novamente para anexar comprovantes.");
      }

      const ext = normalizeReceiptExt(file.name, file.type);
      const uid =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      pathPrefix = `${userId}/receipts`;
      const path = `${pathPrefix}/${Date.now()}-${uid}.${ext}`;

      const { promise, abort } = uploadWithProgress(path, file, setProgress);
      abortRef.current = abort;
      await promise;
      onChange(path);
      setSavedAt(Date.now());
      toast.success("Comprovante anexado com sucesso");
    } catch (e) {
      const err = e as Error & { code?: string };
      if (err.name === "AbortError") {
        setError("Upload cancelado");
        toast.info("Upload cancelado");
      } else {
        const msg = err.message ?? "Falha ao enviar comprovante";
        setError(msg);
        toast.error(msg);
        void reportUploadError(logError, {
          file,
          pathPrefix,
          code: err.code ?? "unknown",
          message: msg,
        });
      }
    } finally {
      setUploading(false);
      abortRef.current = null;
      if (ref.current) ref.current.value = "";
    }
  }

  function cancelUpload() {
    abortRef.current?.();
  }

  function clear() {
    abortRef.current?.();
    setError(null);
    setSavedAt(null);
    setProgress(0);
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
    setRemoteUrl(null);
    onChange(null);
  }

  function discardStaged() {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
    setError(null);
    setProgress(0);
    if (ref.current) ref.current.value = "";
  }

  function retry() {
    ref.current?.click();
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    if (!uploading) setDragOver(true);
  }
  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) selectFile(file);
  }

  const displayUrl = preview?.url ?? remoteUrl;
  const displayMime = preview?.mime ?? "";
  const displayName = preview?.name ?? value?.split("/").pop() ?? "";
  const isPdf = displayMime.includes("pdf") || displayName.toLowerCase().endsWith(".pdf");
  const isImage =
    displayMime.startsWith("image/") || /\.(png|jpe?g|webp|gif|heic)$/i.test(displayName);
  const showConfirm = !!preview && !value && !uploading;
  const showDropzone = !value && !preview;

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/heic,application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) selectFile(f);
        }}
      />
      {value || preview ? (
        <div
          className={cn(
            "w-full max-w-full rounded-md border border-border bg-muted/30 p-2 text-xs transition-colors overflow-hidden",
            dragOver && "border-primary bg-primary/5",
            showConfirm && "border-primary/50 bg-primary/5",
          )}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          data-testid="receipt-card"
        >
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            {isPdf ? (
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span className="min-w-0 flex-1 truncate break-all">{displayName || "comprovante"}</span>
            <div className="ml-auto flex shrink-0 items-center gap-1">
              {savedAt ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : null}
              {displayUrl && !showConfirm ? (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => window.open(displayUrl, "_blank", "noopener,noreferrer")}
                  title="Abrir em nova aba"
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              ) : null}
              {uploading ? (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive"
                  onClick={cancelUpload}
                  title="Cancelar upload"
                  data-testid="receipt-cancel-upload"
                >
                  <Ban className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={showConfirm ? discardStaged : clear}
                  title={showConfirm ? "Descartar seleção" : "Remover"}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          {preview ? (
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {(preview.size / 1024).toFixed(0)} KB · {preview.mime || "tipo desconhecido"}
            </p>
          ) : null}

          {uploading ? (
            <div className="mt-2 space-y-1">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-[width] duration-150 ease-out"
                  style={{ width: `${progress}%` }}
                  data-testid="receipt-progress-bar"
                />
              </div>
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Enviando… {progress}%
              </p>
            </div>
          ) : null}

          {!uploading && savedAt ? (
            <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
              <Check className="h-3 w-3" /> Comprovante salvo
            </p>
          ) : null}

          {displayUrl && isImage ? (
            <div className="mt-2 overflow-hidden rounded border border-border bg-background">
              <img
                src={displayUrl}
                alt={displayName || "Prévia do comprovante"}
                className="max-h-40 w-full object-contain"
                loading="lazy"
              />
            </div>
          ) : null}
          {displayUrl && isPdf ? (
            <div className="mt-2 overflow-hidden rounded border border-border bg-background">
              <object data={displayUrl} type="application/pdf" className="h-40 w-full">
                <a href={displayUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline">
                  Abrir PDF
                </a>
              </object>
            </div>
          ) : null}

          {showConfirm ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border/60 pt-2">
              <p className="min-w-0 flex-1 text-[11px] text-muted-foreground">
                Confira o arquivo e clique em Enviar para anexar.
              </p>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={discardStaged}
                className="h-7 px-2 text-[11px]"
              >
                Descartar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={confirmUpload}
                className="h-7 px-3 text-[11px]"
                data-testid="receipt-confirm-upload"
              >
                <Send className="mr-1 h-3 w-3" /> Enviar
              </Button>
            </div>
          ) : null}

          {error ? (
            <div className="mt-1 flex flex-col gap-1 text-[11px] text-destructive">
              <p className="flex items-start gap-1 break-words">
                <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />{" "}
                <span className="min-w-0 break-words" data-testid="receipt-error">{error}</span>
              </p>
              {!preview ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={retry}
                  className="h-6 w-fit px-2 text-[11px]"
                >
                  Tentar novamente
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : showDropzone ? (
        <div
          role="button"
          tabIndex={0}
          aria-label="Anexar comprovante — arraste um arquivo ou clique"
          onClick={() => !uploading && ref.current?.click()}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !uploading) {
              e.preventDefault();
              ref.current?.click();
            }
          }}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={cn(
            "flex w-full max-w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-border bg-muted/20 px-3 py-4 text-center transition-colors hover:border-primary/60 hover:bg-primary/5",
            dragOver && "border-primary bg-primary/10",
            uploading && "pointer-events-none opacity-60",
          )}
          data-testid="receipt-dropzone"
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <Upload className="h-5 w-5 text-muted-foreground" />
          )}
          <p className="text-xs font-medium">
            {dragOver ? "Solte para anexar" : "Arraste um arquivo ou toque para selecionar"}
          </p>
          <p className="text-[10px] text-muted-foreground">Imagem ou PDF, até 10MB</p>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Fetch a short-lived signed URL for a stored receipt. Uses the secure
 * server function which enforces storage RLS and audits access.
 */
export async function getReceiptUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  try {
    const res = await getReceiptSignedUrl({ data: { path, expires_in: 600 } });
    return res.url;
  } catch {
    return null;
  }
}
