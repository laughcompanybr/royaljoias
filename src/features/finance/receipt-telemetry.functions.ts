import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Log a receipt-upload storage failure to audit_log so we can diagnose
 * bucket/RLS issues without exposing details to end users. We intentionally
 * strip anything that could contain sensitive content (file bytes, tokens,
 * full URLs) — only coarse metadata is persisted.
 */
const inputSchema = z.object({
  bucket: z.string().max(64),
  path_prefix: z.string().max(120).optional().nullable(),
  file_ext: z.string().max(10).optional().nullable(),
  mime: z.string().max(80).optional().nullable(),
  size_bytes: z.number().int().nonnegative().optional().nullable(),
  error_code: z.string().max(80).optional().nullable(),
  error_message: z.string().max(300).optional().nullable(),
  route: z.string().max(120).optional().nullable(),
});

export const logReceiptUploadError = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => inputSchema.parse(v))
  .handler(async ({ data, context }) => {
    // Redact any values that look like secrets or long URLs.
    const safeMessage = (data.error_message ?? "")
      .replace(/https?:\/\/\S+/gi, "[url]")
      .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, "[jwt]")
      .replace(/sb_(?:publishable|secret)_[\w-]+/gi, "[key]")
      .slice(0, 300);

    await context.supabase.from("audit_log").insert({
      table_name: "storage.objects",
      record_id: data.bucket,
      operation: "RECEIPT_UPLOAD_ERROR",
      actor: context.userId,
      new_data: {
        bucket: data.bucket,
        path_prefix: data.path_prefix ?? null,
        file_ext: data.file_ext ?? null,
        mime: data.mime ?? null,
        size_bytes: data.size_bytes ?? null,
        error_code: data.error_code ?? null,
        error_message: safeMessage || null,
        route: data.route ?? null,
      },
    });
    return { ok: true };
  });
