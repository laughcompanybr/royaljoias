import { useCallback, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getClient,
  addClientAttachment,
  deleteClientAttachment,
  signAttachmentUrl,
  updateClient,
} from "./clients.functions";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Paperclip,
  Upload,
  Download,
  Trash2,
  History,
  Package,
  Pencil,
} from "lucide-react";
import { ClientForm } from "./ClientForm";
import { formatBRL, formatDate } from "@/lib/format";
import type { ClientPayload } from "./schemas";
import { STATUS_LABEL, STATUS_TONE, type OrderStatus } from "@/features/orders/schemas";


interface Props {
  clientId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

function formatBytes(n: number | null | undefined) {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const operationLabel: Record<string, string> = {
  INSERT: "Criado",
  UPDATE: "Atualizado",
  DELETE: "Removido",
};

export function ClientDetailSheet({ clientId, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const getFn = useServerFn(getClient);
  const updateFn = useServerFn(updateClient);
  const addAttachFn = useServerFn(addClientAttachment);
  const delAttachFn = useServerFn(deleteClientAttachment);
  const signFn = useServerFn(signAttachmentUrl);

  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const query = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => getFn({ data: { id: clientId! } }),
    enabled: !!clientId && open,
  });

  const updateMut = useMutation({
    mutationFn: (v: ClientPayload) => updateFn({ data: { id: clientId!, ...v } as never }),
    onSuccess: () => {
      toast.success("Cliente atualizado");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["client", clientId] });
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delAttachMut = useMutation({
    mutationFn: (v: { id: string; storage_path: string }) => delAttachFn({ data: v }),
    onSuccess: () => {
      toast.success("Anexo removido");
      qc.invalidateQueries({ queryKey: ["client", clientId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleUpload = useCallback(
    async (file: File) => {
      if (!clientId) return;
      if (file.size > 15 * 1024 * 1024) {
        toast.error("Arquivo excede 15MB");
        return;
      }
      setUploading(true);
      try {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${clientId}/${Date.now()}-${safe}`;
        const { error: upErr } = await supabase.storage
          .from("client-files")
          .upload(path, file, { upsert: false, contentType: file.type });
        if (upErr) throw upErr;
        await addAttachFn({
          data: {
            client_id: clientId,
            storage_path: path,
            filename: file.name,
            mime: file.type || null,
            size: file.size,
            kind: null,
          },
        });
        toast.success("Documento enviado");
        qc.invalidateQueries({ queryKey: ["client", clientId] });
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setUploading(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    [clientId, addAttachFn, qc],
  );

  const handleDownload = async (storage_path: string, filename: string | null) => {
    try {
      const { url } = await signFn({ data: { storage_path } });
      const a = document.createElement("a");
      a.href = url;
      a.download = filename ?? "arquivo";
      a.target = "_blank";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const client = query.data?.client;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl">
            {query.isLoading ? "Carregando..." : client?.name ?? "Cliente"}
          </SheetTitle>
        </SheetHeader>

        {query.isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-6 animate-spin text-gold" />
          </div>
        ) : client ? (
          <Tabs defaultValue="info" className="mt-6">
            <TabsList className="w-full">
              <TabsTrigger value="info" className="flex-1">Dados</TabsTrigger>
              <TabsTrigger value="attachments" className="flex-1">
                <Paperclip className="mr-1 size-3.5" /> Documentos ({query.data?.attachments.length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="orders" className="flex-1">
                <Package className="mr-1 size-3.5" /> Pedidos ({query.data?.orders.length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="history" className="flex-1">
                <History className="mr-1 size-3.5" /> Histórico
              </TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="mt-4">
              {editing ? (
                <ClientForm
                  defaultValues={{
                    name: client.name,
                    cpf: client.cpf ?? "",
                    phone: client.phone ?? "",
                    whatsapp: client.whatsapp ?? "",
                    instagram: client.instagram ?? "",
                    zip: client.zip ?? "",
                    street: client.street ?? "",
                    number: client.number ?? "",
                    complement: client.complement ?? "",
                    district: client.district ?? "",
                    reference: client.reference ?? "",
                    city: client.city ?? "",
                    state: client.state ?? "",
                    notes: client.notes ?? "",
                  }}
                  submitLabel="Salvar alterações"
                  onSubmit={async (v) => { await updateMut.mutateAsync(v); }}
                  onCancel={() => setEditing(false)}
                />

              ) : (
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                      <Pencil className="mr-2 size-3.5" /> Editar
                    </Button>
                  </div>
                  <dl className="grid grid-cols-2 gap-4 text-sm">
                    <Info label="CPF" value={client.cpf} />
                    <Info label="Telefone" value={client.phone} />
                    <Info label="WhatsApp" value={client.whatsapp} />
                    <Info label="Instagram" value={client.instagram ? `@${client.instagram}` : null} />
                    <Info label="CEP" value={client.zip} />
                    <Info
                      label="Endereço"
                      value={[client.street, client.number, client.complement].filter(Boolean).join(", ") || null}
                    />
                    <Info label="Bairro" value={client.district} />
                    <Info label="Referência" value={client.reference} />
                    <Info label="Cidade" value={client.city} />
                    <Info label="UF" value={client.state} />
                    <Info label="Criado em" value={formatDate(client.created_at)} />
                    <Info label="Atualizado em" value={formatDate(client.updated_at)} />
                  </dl>
                  {client.notes ? (
                    <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Observações</p>
                      <p className="mt-1 whitespace-pre-wrap">{client.notes}</p>
                    </div>
                  ) : null}

                </div>
              )}
            </TabsContent>

            <TabsContent value="attachments" className="mt-4 space-y-3">
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                }}
              />
              <Button onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full">
                {uploading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Upload className="mr-2 size-4" />}
                Enviar documento
              </Button>

              {query.data?.attachments.length ? (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {query.data.attachments.map((a) => (
                    <li key={a.id} className="flex items-center gap-3 p-3">
                      <Paperclip className="size-4 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{a.filename ?? "arquivo"}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatBytes(a.size)} · {formatDate(a.created_at)}
                        </p>
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => handleDownload(a.storage_path, a.filename)}>
                        <Download className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm("Remover este documento?")) {
                            delAttachMut.mutate({ id: a.id, storage_path: a.storage_path });
                          }
                        }}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">Nenhum documento enviado.</p>
              )}
            </TabsContent>

            <TabsContent value="orders" className="mt-4">
              {query.data?.orders.length ? (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {query.data.orders.map((o) => {
                    const photo = query.data?.orderPhotos?.[o.id];
                    const label = STATUS_LABEL[o.status as OrderStatus] ?? o.status;
                    const tone = STATUS_TONE[o.status as OrderStatus] ?? "";
                    const desc = [o.brand, o.model].filter(Boolean).join(" ") || "Relógio";
                    return (
                      <li key={o.id} className="flex items-center gap-3 p-3 text-sm">
                        <div className="size-14 shrink-0 overflow-hidden rounded-lg border border-border bg-muted/30">
                          {photo ? (
                            <img src={photo} alt={desc} className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <div className="grid h-full w-full place-items-center text-muted-foreground">
                              <Package className="size-5" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{desc}</p>
                          <p className="text-xs text-muted-foreground">
                            Pedido #{o.order_number ?? "—"} · {formatDate(o.created_at)}
                            {o.quantity && o.quantity > 1 ? ` · Qtd ${o.quantity}` : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{formatBRL(o.sale_price)}</p>
                          <Badge className={`text-[10px] ${tone}`}>{label}</Badge>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">Nenhum pedido registrado.</p>

              )}
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              {query.data?.history.length ? (
                <ol className="space-y-2">
                  {query.data.history.map((h) => (
                    <li key={h.id} className="flex gap-3 rounded-lg border border-border bg-card/40 p-3 text-sm">
                      <Badge variant="outline" className="h-fit">{operationLabel[h.operation] ?? h.operation}</Badge>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground">{formatDate(h.changed_at)}</p>
                        {h.operation === "UPDATE" && h.old_data && h.new_data ? (
                          <ul className="mt-1 space-y-0.5 text-xs">
                            {diffFields(h.old_data as Record<string, unknown>, h.new_data as Record<string, unknown>).map((d) => (
                              <li key={d.field}>
                                <span className="font-medium">{d.field}:</span>{" "}
                                <span className="text-muted-foreground line-through">{String(d.old ?? "—")}</span>{" "}
                                → <span className="text-gold">{String(d.new ?? "—")}</span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">Sem histórico.</p>
              )}
            </TabsContent>
          </Tabs>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-foreground">{value || "—"}</dd>
    </div>
  );
}

const IGNORE = new Set(["updated_at", "created_at", "id", "created_by", "deleted_at"]);
function diffFields(oldD: Record<string, unknown>, newD: Record<string, unknown>) {
  const out: Array<{ field: string; old: unknown; new: unknown }> = [];
  const keys = new Set([...Object.keys(oldD), ...Object.keys(newD)]);
  for (const k of keys) {
    if (IGNORE.has(k)) continue;
    if (JSON.stringify(oldD[k]) !== JSON.stringify(newD[k])) {
      out.push({ field: k, old: oldD[k], new: newD[k] });
    }
  }
  return out;
}
