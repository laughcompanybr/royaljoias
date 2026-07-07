/**
 * Pure server-side validation for receipt uploads. Extracted so it can be
 * unit-tested without hitting Supabase storage.
 */

export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;
export const RECEIPT_ALLOWED_MIME = /^(image\/(png|jpe?g|webp|gif|heic)|application\/pdf)$/i;
export const RECEIPT_ALLOWED_EXT = /\.(png|jpe?g|webp|gif|heic|pdf)$/i;
export const RECEIPT_ALLOWED_DESCRIPTION =
  "Aceitos: PNG, JPG, WEBP, GIF, HEIC ou PDF, até 10MB.";

export type ReceiptValidationError =
  | "invalid_path"
  | "invalid_extension"
  | "not_found"
  | "empty_file"
  | "too_large"
  | "invalid_mime";

export class ReceiptValidationException extends Error {
  code: ReceiptValidationError;
  constructor(code: ReceiptValidationError, message: string) {
    super(message);
    this.code = code;
    this.name = "ReceiptValidationException";
  }
}

export function sanitizeReceiptPath(path: string | null | undefined): string | null {
  if (!path) return null;
  const clean = String(path).trim();
  if (!clean) return null;
  if (clean.length > 500 || clean.includes("..") || clean.startsWith("/")) {
    throw new ReceiptValidationException("invalid_path", "Caminho de comprovante inválido");
  }
  if (!RECEIPT_ALLOWED_EXT.test(clean)) {
    throw new ReceiptValidationException(
      "invalid_extension",
      "Extensão de comprovante não permitida (use imagem ou PDF)",
    );
  }
  return clean;
}

/**
 * Validate metadata reported by the storage backend for a stored receipt.
 * Mime is preferred; when absent (some storage providers omit it) we fall
 * back to the file extension.
 */
export function validateReceiptMetadata(
  fileName: string,
  meta: { size: number | null | undefined; mime: string | null | undefined },
): void {
  const size = Number(meta.size ?? 0);
  if (!size) {
    throw new ReceiptValidationException("empty_file", "Comprovante está vazio");
  }
  if (size > RECEIPT_MAX_BYTES) {
    throw new ReceiptValidationException("too_large", "Comprovante excede 10MB");
  }
  const mime = String(meta.mime ?? "").trim();
  if (mime) {
    if (!RECEIPT_ALLOWED_MIME.test(mime)) {
      throw new ReceiptValidationException(
        "invalid_mime",
        "Tipo de arquivo do comprovante não permitido",
      );
    }
  } else if (!RECEIPT_ALLOWED_EXT.test(fileName)) {
    throw new ReceiptValidationException(
      "invalid_mime",
      "Tipo de arquivo do comprovante não permitido",
    );
  }
}

/**
 * Map a MIME type to a canonical file extension. Falls back to the passed
 * file name's extension when the mime is unknown/empty. Returns "bin" when
 * neither is usable so callers still get a deterministic string.
 */
const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "application/pdf": "pdf",
};

export function normalizeReceiptExt(fileName: string, mime: string | null | undefined): string {
  const m = (mime ?? "").toLowerCase().trim();
  if (m && MIME_TO_EXT[m]) return MIME_TO_EXT[m];
  const match = fileName.match(/\.([a-zA-Z0-9]{1,8})$/);
  const ext = (match?.[1] ?? "").toLowerCase();
  if (ext === "jpeg") return "jpg";
  if (RECEIPT_ALLOWED_EXT.test(`.${ext}`)) return ext;
  return "bin";
}

/**
 * Client-side pre-upload validation. Mirrors the server-side checks so we
 * fail fast before touching Supabase Storage.
 */
export function validateReceiptFile(file: { name: string; size: number; type: string }): void {
  if (!file.size) {
    throw new ReceiptValidationException("empty_file", `Arquivo vazio. ${RECEIPT_ALLOWED_DESCRIPTION}`);
  }
  if (file.size > RECEIPT_MAX_BYTES) {
    throw new ReceiptValidationException(
      "too_large",
      `Arquivo excede 10MB (${(file.size / 1024 / 1024).toFixed(1)}MB). ${RECEIPT_ALLOWED_DESCRIPTION}`,
    );
  }
  const type = (file.type ?? "").trim();
  if (type) {
    if (!RECEIPT_ALLOWED_MIME.test(type)) {
      throw new ReceiptValidationException(
        "invalid_mime",
        `Tipo "${type}" não aceito. ${RECEIPT_ALLOWED_DESCRIPTION}`,
      );
    }
  } else if (!RECEIPT_ALLOWED_EXT.test(file.name)) {
    throw new ReceiptValidationException(
      "invalid_extension",
      `Extensão não aceita. ${RECEIPT_ALLOWED_DESCRIPTION}`,
    );
  }
}
