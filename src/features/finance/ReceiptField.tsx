import { useEffect, useRef, useState } from "react";
import { Loader2, Upload, X, Paperclip, FileText, Eye, Check, AlertCircle, Ban } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Props {
  value: string | null | undefined;
  onChange: (path: string | null) => void;
  label?: string;
}

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = /^(image\/(png|jpe?g|webp|gif|heic)|application\/pdf)$/i;
const ACCEPTED_EXT = /\.(png|jpe?g|webp|gif|heic|pdf)$/i;

const ALLOWED_DESC = "Aceitos: PNG, JPG, WEBP, GIF, HEIC ou PDF, até 10MB.";

interface Preview {
  url: string;
  mime: string;
  name: string;
  size: number;
}

/**
 * Upload via the Supabase JS SDK. The SDK's fetch wrapper already knows how
 * to handle the new-format publishable keys (`sb_publishable_*`) — a hand
 * rolled XHR that also sets `Authorization: Bearer` was causing the Storage
 * service to reject the request with a misleading "Bucket not found" error.
 *
 * Progress is simulated in coarse steps because the SDK doesn't expose upload
 * progress events. Cancel triggers via AbortController.
 */
function uploadWithProgress(
  path: string,
  file: File,
  onProgress: (pct: number) => void,
): { promise: Promise<void>; abort: () => void } {
  const ctrl = new AbortController();
  let ticker: ReturnType<typeof setInterval> | null = null;

  const promise = (async () => {
    // Fake progress so the UI doesn't feel frozen on large files.
    let pct = 5;
    onProgress(pct);
    ticker = setInterval(() => {
      pct = Math.min(pct + 5, 90);
      onProgress(pct);
    }, 250);

    try {
      const { error } = await supabase.storage
        .from("finance-receipts")
        .upload(path, file, {
          contentType: file.type || undefined,
          cacheControl: "3600",
          upsert: true,
        });

      if (ctrl.signal.aborted) {
        throw new DOMException("Upload cancelado", "AbortError");
      }
      if (error) {
        // Map common storage errors to actionable Portuguese messages.
        const raw = (error as { message?: string }).message ?? "Falha ao enviar comprovante";
        if (/bucket not found/i.test(raw)) {
          throw new Error(
            "Armazenamento indisponível: bucket de comprovantes não encontrado. Contate o suporte.",
          );
        }
        if (/row-level security|unauthorized|jwt/i.test(raw)) {
          throw new Error("Sem permissão para anexar comprovante. Verifique seu acesso.");
        }
        throw new Error(raw);
      }
      onProgress(100);
    } finally {
      if (ticker) clearInterval(ticker);
    }
  })();

  return {
    promise,
    abort: () => ctrl.abort(),
  };
}




function formatError(file: File): string | null {
  if (file.size > MAX_BYTES) {
    return `Arquivo excede 10MB (${(file.size / 1024 / 1024).toFixed(1)}MB). ${ALLOWED_DESC}`;
  }
  if (file.size === 0) {
    return `Arquivo vazio não permitido. ${ALLOWED_DESC}`;
  }
  if (file.type) {
    if (!ACCEPTED_TYPES.test(file.type)) {
      return `Tipo "${file.type}" não aceito. ${ALLOWED_DESC}`;
    }
  } else if (!ACCEPTED_EXT.test(file.name)) {
    return `Extensão não aceita. ${ALLOWED_DESC}`;
  }
  return null;
}

export function ReceiptField({ value, onChange, label = "Comprovante" }: Props) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const abortRef = useRef<(() => void) | null>(null);

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

  async function handleFile(file: File) {
    // Reset error so user can retry without reload
    setError(null);
    setSavedAt(null);
    setProgress(0);

    const invalid = formatError(file);
    if (invalid) {
      setError(invalid);
      toast.error(invalid);
      if (ref.current) ref.current.value = "";
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreview({ url: objectUrl, mime: file.type, name: file.name, size: file.size });

    setUploading(true);
    try {
      // Path deve casar com o bucket `finance-receipts` e as RLS de
      // storage.objects. Convenção Supabase: prefixo com o user id para que
      // políticas baseadas em `auth.uid()::text = (storage.foldername(name))[1]`
      // funcionem. Também sanitiza o nome do arquivo — Storage rejeita chaves
      // com caracteres fora do conjunto seguro (espaços, acentos, `#`, `?`, `%`,
      // `\`, etc.) devolvendo erros pouco claros como "Bucket not found".
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) {
        throw new Error("Sessão expirada. Faça login novamente para anexar comprovantes.");
      }

      const extMatch = file.name.match(/\.([a-zA-Z0-9]{1,8})$/);
      const ext = (extMatch?.[1] ?? "bin").toLowerCase();
      const uid =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      // Somente ASCII seguro: letras, números, hífen, ponto, underscore, barra.
      const path = `${userId}/receipts/${Date.now()}-${uid}.${ext}`;

      const { promise, abort } = uploadWithProgress(path, file, setProgress);
      abortRef.current = abort;
      await promise;
      onChange(path);
      setSavedAt(Date.now());
      toast.success("Comprovante anexado");
    } catch (e) {
      const err = e as Error;
      if (err.name === "AbortError") {
        setError("Upload cancelado");
        toast.info("Upload cancelado");
      } else {
        const msg = err.message ?? "Falha ao enviar comprovante";
        setError(msg);
        toast.error(msg);
      }
      URL.revokeObjectURL(objectUrl);
      setPreview(null);
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
    if (file) handleFile(file);
  }

  const displayUrl = preview?.url ?? remoteUrl;
  const displayMime = preview?.mime ?? "";
  const displayName = preview?.name ?? value?.split("/").pop() ?? "";
  const isPdf = displayMime.includes("pdf") || displayName.toLowerCase().endsWith(".pdf");
  const isImage =
    displayMime.startsWith("image/") || /\.(png|jpe?g|webp|gif|heic)$/i.test(displayName);

  // Show dropzone if no value/preview OR there was an error (allow retry)
  const showDropzone = (!value && !preview) || error;

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
          if (f) handleFile(f);
        }}
      />
      {value || preview ? (
        <div
          className={cn(
            "rounded-md border border-border bg-muted/30 p-2 text-xs transition-colors",
            dragOver && "border-primary bg-primary/5",
          )}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <div className="flex items-center gap-2">
            {isPdf ? (
              <FileText className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Paperclip className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="flex-1 truncate">{displayName || "comprovante"}</span>
            {savedAt ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : null}
            {displayUrl ? (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-6 w-6"
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
                className="h-6 w-6 text-destructive"
                onClick={cancelUpload}
                title="Cancelar upload"
              >
                <Ban className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={clear}
                title="Remover"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          {uploading ? (
            <div className="mt-2 space-y-1">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-[width] duration-150 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Enviando… {progress}%
              </p>
            </div>
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
          {error ? (
            <div className="mt-1 flex flex-col gap-1 text-[11px] text-destructive">
              <p className="flex items-center gap-1">
                <AlertCircle className="h-3 w-3 shrink-0" /> {error}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={retry}
                className="h-6 w-fit px-2 text-[11px]"
              >
                Tentar novamente
              </Button>
            </div>
          ) : null}
        </div>
      ) : showDropzone ? (
        <>
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
              "flex w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-border bg-muted/20 py-4 text-center transition-colors hover:border-primary/60 hover:bg-primary/5",
              dragOver && "border-primary bg-primary/10",
              uploading && "pointer-events-none opacity-60",
            )}
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <Upload className="h-5 w-5 text-muted-foreground" />
            )}
            <p className="text-xs font-medium">
              {dragOver ? "Solte para anexar" : "Arraste um arquivo ou clique para selecionar"}
            </p>
            <p className="text-[10px] text-muted-foreground">Imagem ou PDF, até 10MB</p>
          </div>
          {error ? (
            <div className="flex flex-col gap-1 text-[11px] text-destructive">
              <p className="flex items-center gap-1">
                <AlertCircle className="h-3 w-3 shrink-0" /> {error}
              </p>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export async function getReceiptUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from("finance-receipts")
    .createSignedUrl(path, 60 * 10);
  if (error) return null;
  return data.signedUrl;
}
