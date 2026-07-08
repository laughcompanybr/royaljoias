import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Bell,
  Download,
  Loader2,
  Lock,
  Moon,
  Palette,
  Save,
  ShieldCheck,
  Sun,
  Upload,
  UploadCloud,
  User as UserIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "@/hooks/use-theme";
import { changePasswordSchema, type ChangePasswordInput } from "@/features/auth/schemas";
import {
  exportBackup,
  getProfile,
  importClients,
  importSuppliers,
  updateProfile,
} from "@/features/settings/settings.functions";
import { getCardFeePercent, setCardFeePercent, getTaxPercent, setTaxPercent } from "@/features/settings/settings.functions";
import { CreditCard } from "lucide-react";
import { MfaCard } from "@/features/settings/MfaCard";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="space-y-6 p-4 lg:p-6">
      <PageHeader
        eyebrow="Sistema"
        title="Configurações"
        description="Perfil, segurança, tema, preferências, backup e importação de dados."
      />

      <Tabs defaultValue="profile" className="space-y-4">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList className="inline-flex w-max min-w-full flex-nowrap sm:flex sm:w-full sm:flex-wrap">
            <TabsTrigger value="profile" className="shrink-0"><UserIcon className="mr-1 h-4 w-4" /> Perfil</TabsTrigger>
            <TabsTrigger value="security" className="shrink-0"><ShieldCheck className="mr-1 h-4 w-4" /> Segurança</TabsTrigger>
            <TabsTrigger value="theme" className="shrink-0"><Palette className="mr-1 h-4 w-4" /> Tema</TabsTrigger>
            <TabsTrigger value="preferences" className="shrink-0"><Bell className="mr-1 h-4 w-4" /> Preferências</TabsTrigger>
            <TabsTrigger value="financial" className="shrink-0"><CreditCard className="mr-1 h-4 w-4" /> Financeiro</TabsTrigger>
            <TabsTrigger value="backup" className="shrink-0"><Download className="mr-1 h-4 w-4" /> Backup</TabsTrigger>
            <TabsTrigger value="import" className="shrink-0"><Upload className="mr-1 h-4 w-4" /> Importação</TabsTrigger>
          </TabsList>
        </div>


        <TabsContent value="profile"><ProfileSection /></TabsContent>
        <TabsContent value="security"><SecuritySection /></TabsContent>
        <TabsContent value="theme"><ThemeSection /></TabsContent>
        <TabsContent value="preferences"><PreferencesSection /></TabsContent>
        <TabsContent value="financial"><FinancialSection /></TabsContent>
        <TabsContent value="backup"><BackupSection /></TabsContent>
        <TabsContent value="import"><ImportSection /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------ PERFIL ------------------ */
const profileSchema = z.object({
  full_name: z.string().trim().max(120).optional().transform((v) => v ?? ""),
  avatar_url: z.string().trim().max(500).default(""),
});
type ProfileInput = z.input<typeof profileSchema>;
type ProfileOutput = z.output<typeof profileSchema>;

function ProfileSection() {
  const getFn = useServerFn(getProfile);
  const updateFn = useServerFn(updateProfile);
  const qc = useQueryClient();
  const [email, setEmail] = useState<string>("");

  const { data, isLoading } = useQuery({ queryKey: ["profile"], queryFn: () => getFn() });

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  const form = useForm<ProfileInput, unknown, ProfileOutput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: "", avatar_url: "" },
    values: { full_name: data?.full_name ?? "", avatar_url: data?.avatar_url ?? "" },
  });

  const mutation = useMutation({
    mutationFn: (v: ProfileOutput) =>
      updateFn({ data: { full_name: v.full_name, avatar_url: v.avatar_url || null } }),
    onSuccess: () => {
      toast.success("Perfil atualizado");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: unknown) => toast.error("Erro", { description: e instanceof Error ? e.message : "" }),
  });

  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card>
        <CardHeader>
          <CardTitle>Dados pessoais</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Carregando…</div>
          ) : (
            <form className="grid gap-4 md:grid-cols-2" onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
              <div className="md:col-span-2 flex items-center gap-4">
                <div className="flex size-16 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary/50 text-lg font-semibold">
                  {form.watch("avatar_url") ? (
                    <img src={form.watch("avatar_url")} alt="Avatar" className="size-full object-cover" />
                  ) : (
                    (form.watch("full_name") || email || "U").slice(0, 2).toUpperCase()
                  )}
                </div>
                <div>
                  <div className="text-sm font-medium">{email}</div>
                  <div className="text-xs text-muted-foreground">
                    Conta criada em {data?.created_at ? new Date(data.created_at).toLocaleDateString("pt-BR") : "—"}
                  </div>
                </div>
              </div>
              <div>
                <Label>Nome completo</Label>
                <Input {...form.register("full_name")} />
                {form.formState.errors.full_name && (
                  <p className="text-xs text-destructive">{form.formState.errors.full_name.message}</p>
                )}
              </div>
              <div>
                <Label>URL do avatar</Label>
                <Input placeholder="https://…" {...form.register("avatar_url")} />
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
                  Salvar
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </motion.section>
  );
}

/* ------------------ SEGURANÇA ------------------ */
function SecuritySection() {
  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", password: "", confirm: "" },
  });

  const onSubmit = async (values: ChangePasswordInput) => {
    const { data: userData } = await supabase.auth.getUser();
    const email = userData.user?.email;
    if (!email) return toast.error("Sessão expirada. Entre novamente.");
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: values.currentPassword,
    });
    if (signInError) {
      form.setError("currentPassword", { message: "Senha atual incorreta" });
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: values.password });
    if (error) return toast.error("Não foi possível alterar", { description: error.message });
    toast.success("Senha alterada com sucesso");
    form.reset();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Alterar senha</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-2">
            <PwField id="currentPassword" label="Senha atual" autoComplete="current-password" className="md:col-span-2" error={form.formState.errors.currentPassword?.message} {...form.register("currentPassword")} />
            <PwField id="password" label="Nova senha" autoComplete="new-password" error={form.formState.errors.password?.message} {...form.register("password")} />
            <PwField id="confirm" label="Confirmar nova senha" autoComplete="new-password" error={form.formState.errors.confirm?.message} {...form.register("confirm")} />
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                Salvar nova senha
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <MfaCard />
    </div>
  );
}

interface PwFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}
function PwField({ label, error, id, className, ...rest }: PwFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="relative">
        <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input id={id} type="password" className="h-10 pl-10" {...rest} />
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

/* ------------------ TEMA ------------------ */
function ThemeSection() {
  const { theme, setTheme } = useTheme();
  const opts: { key: "light" | "dark"; label: string; icon: typeof Sun; hint: string }[] = [
    { key: "light", label: "Claro", icon: Sun, hint: "Ideal para ambientes iluminados" },
    { key: "dark", label: "Escuro", icon: Moon, hint: "Reduz cansaço visual à noite" },
  ];
  return (
    <Card>
      <CardHeader><CardTitle>Aparência</CardTitle></CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2">
          {opts.map((o) => {
            const active = theme === o.key;
            const Icon = o.icon;
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => setTheme(o.key)}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-4 text-left transition hover:border-primary/60",
                  active ? "border-primary bg-primary/5" : "border-border",
                )}
              >
                <div className={cn("rounded-lg border border-border bg-secondary/50 p-2", active && "text-primary")}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-medium">{o.label}</div>
                    {active ? <Badge variant="secondary" className="text-[10px]">Ativo</Badge> : null}
                  </div>
                  <p className="text-xs text-muted-foreground">{o.hint}</p>
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------ PREFERÊNCIAS ------------------ */
const PREFS_KEY = "royal-preferences";
type Prefs = {
  emailNotifications: boolean;
  desktopNotifications: boolean;
  compactTables: boolean;
  defaultPageSize: 10 | 20 | 50 | 100;
  currency: "BRL" | "USD" | "EUR";
};
const DEFAULT_PREFS: Prefs = {
  emailNotifications: true,
  desktopNotifications: false,
  compactTables: false,
  defaultPageSize: 20,
  currency: "BRL",
};

function usePrefs() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PREFS_KEY);
      if (raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
    } catch { /* ignore */ }
  }, []);
  const update = (patch: Partial<Prefs>) => {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      try { window.localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };
  return [prefs, update] as const;
}

function PreferencesSection() {
  const [prefs, update] = usePrefs();
  return (
    <Card>
      <CardHeader><CardTitle>Preferências</CardTitle></CardHeader>
      <CardContent className="space-y-5">
        <PrefRow label="Notificações por e-mail" hint="Receber resumos e alertas.">
          <Switch checked={prefs.emailNotifications} onCheckedChange={(v) => update({ emailNotifications: v })} />
        </PrefRow>
        <Separator />
        <PrefRow label="Notificações no navegador" hint="Alertas em tempo real na área de trabalho.">
          <Switch
            checked={prefs.desktopNotifications}
            onCheckedChange={async (v) => {
              if (v && "Notification" in window && Notification.permission !== "granted") {
                const p = await Notification.requestPermission();
                if (p !== "granted") return toast.error("Permissão negada pelo navegador");
              }
              update({ desktopNotifications: v });
            }}
          />
        </PrefRow>
        <Separator />
        <PrefRow label="Tabelas compactas" hint="Aumenta a densidade da informação.">
          <Switch checked={prefs.compactTables} onCheckedChange={(v) => update({ compactTables: v })} />
        </PrefRow>
        <Separator />
        <PrefRow label="Itens por página" hint="Aplicado às listagens.">
          <select
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            value={prefs.defaultPageSize}
            onChange={(e) => update({ defaultPageSize: Number(e.target.value) as Prefs["defaultPageSize"] })}
          >
            {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </PrefRow>
        <Separator />
        <PrefRow label="Moeda padrão" hint="Formato usado em telas de valores.">
          <select
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            value={prefs.currency}
            onChange={(e) => update({ currency: e.target.value as Prefs["currency"] })}
          >
            <option value="BRL">BRL (R$)</option>
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
          </select>
        </PrefRow>
        <p className="text-xs text-muted-foreground">
          Preferências ficam salvas apenas neste dispositivo.
        </p>
      </CardContent>
    </Card>
  );
}

function PrefRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
      </div>
      {children}
    </div>
  );
}

/* ------------------ BACKUP ------------------ */
function BackupSection() {
  const exportFn = useServerFn(exportBackup);
  const [loading, setLoading] = useState(false);

  async function download() {
    setLoading(true);
    try {
      const backup = await exportFn();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `royal_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Backup gerado", {
        description: `${backup.counts.orders} pedidos, ${backup.counts.clients} clientes, ${backup.counts.suppliers} fornecedores.`,
      });
    } catch (e) {
      toast.error("Falha ao gerar backup", { description: e instanceof Error ? e.message : "" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Backup de dados</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Gere um arquivo JSON com clientes, fornecedores, pedidos, pagamentos e despesas.
          Guarde em local seguro — ele contém informações sensíveis.
        </p>
        <Button onClick={download} disabled={loading}>
          {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
          Baixar backup completo
        </Button>
      </CardContent>
    </Card>
  );
}

/* ------------------ IMPORTAÇÃO ------------------ */
type CsvKind = "clients" | "suppliers";

function ImportSection() {
  const qc = useQueryClient();
  const importClientsFn = useServerFn(importClients);
  const importSuppliersFn = useServerFn(importSuppliers);
  const [kind, setKind] = useState<CsvKind>("clients");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (kind === "clients") return importClientsFn({ data: { rows: rows as never } });
      return importSuppliersFn({ data: { rows: rows as never } });
    },
    onSuccess: (r) => {
      toast.success(`${r.inserted} registro(s) importado(s)`);
      setRows([]);
      setFileName("");
      if (inputRef.current) inputRef.current.value = "";
      qc.invalidateQueries({ queryKey: [kind] });
    },
    onError: (e: unknown) => toast.error("Erro ao importar", { description: e instanceof Error ? e.message : "" }),
  });

  async function onFile(file: File) {
    setFileName(file.name);
    const text = await file.text();
    const parsed = parseCsv(text);
    setRows(parsed);
  }

  const headers = rows[0] ? Object.keys(rows[0]) : [];

  const templates: Record<CsvKind, string[]> = {
    clients: ["name", "phone", "whatsapp", "instagram", "cpf", "city", "state", "notes"],
    suppliers: ["name", "company", "email", "phone", "whatsapp", "instagram", "notes"],
  };

  function downloadTemplate() {
    const csv = templates[kind].join(",") + "\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `modelo_${kind}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardHeader><CardTitle>Importação em massa (CSV)</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label>Tipo de dados</Label>
            <select
              className="mt-1 h-9 rounded-md border border-border bg-background px-2 text-sm"
              value={kind}
              onChange={(e) => { setKind(e.target.value as CsvKind); setRows([]); setFileName(""); }}
            >
              <option value="clients">Clientes</option>
              <option value="suppliers">Fornecedores</option>
            </select>
          </div>
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="mr-1 h-4 w-4" /> Baixar modelo
          </Button>
        </div>

        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground transition hover:border-primary/60 hover:bg-primary/5">
          <UploadCloud className="h-5 w-5" />
          {fileName ? `${fileName} · ${rows.length} linhas` : "Clique para escolher um arquivo .csv"}
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
            }}
          />
        </label>

        {rows.length > 0 ? (
          <div className="rounded-lg border border-border">
            <div className="max-h-64 overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/50">
                  <tr>
                    {headers.map((h) => <th key={h} className="px-2 py-1.5 text-left font-medium">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 10).map((r, i) => (
                    <tr key={i} className="border-t border-border">
                      {headers.map((h) => <td key={h} className="px-2 py-1">{r[h] ?? ""}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-border p-2 text-xs text-muted-foreground">
              Mostrando 10 de {rows.length} · verifique se as colunas correspondem ao modelo antes de importar.
            </div>
          </div>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => { setRows([]); setFileName(""); if (inputRef.current) inputRef.current.value = ""; }} disabled={!rows.length}>
            Limpar
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!rows.length || mutation.isPending}>
            {mutation.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
            Importar {rows.length} registro(s)
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          O arquivo deve estar em UTF-8, com vírgulas como separador e a primeira linha contendo os cabeçalhos.
          Campos não previstos no modelo são ignorados.
        </p>
      </CardContent>
    </Card>
  );
}

/* ------------------ CSV parser (RFC 4180) ------------------ */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(cur); cur = ""; }
      else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
      else if (c === "\r") { /* skip */ }
      else cur += c;
    }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim().replace(/^\uFEFF/, ""));
  return rows.slice(1)
    .filter((r) => r.some((c) => c.trim().length))
    .map((r) => {
      const o: Record<string, string> = {};
      headers.forEach((h, i) => { o[h] = (r[i] ?? "").trim(); });
      return o;
    });
}

/* ------------------ FINANCEIRO ------------------ */
function FinancialSection() {
  const getFn = useServerFn(getCardFeePercent);
  const setFn = useServerFn(setCardFeePercent);
  const getTaxFn = useServerFn(getTaxPercent);
  const setTaxFn = useServerFn(setTaxPercent);
  const qc = useQueryClient();
  const [percent, setPercent] = useState<string>("");
  const [taxPercent, setTaxPercentState] = useState<string>("");

  const q = useQuery({ queryKey: ["settings", "card-fee"], queryFn: () => getFn() });
  const qTax = useQuery({ queryKey: ["settings", "tax-percent"], queryFn: () => getTaxFn() });

  useEffect(() => {
    if (q.data && percent === "") setPercent(String(q.data.percent));
  }, [q.data, percent]);
  useEffect(() => {
    if (qTax.data && taxPercent === "") setTaxPercentState(String(qTax.data.percent));
  }, [qTax.data, taxPercent]);

  const mut = useMutation({
    mutationFn: (p: number) => setFn({ data: { percent: p } }),
    onSuccess: () => {
      toast.success("Taxa atualizada");
      qc.invalidateQueries({ queryKey: ["settings", "card-fee"] });
    },
    onError: (e: unknown) =>
      toast.error("Erro ao salvar taxa do cartão", {
        description: e instanceof Error ? e.message : "Verifique se você tem permissão de administrador.",
      }),
  });

  const mutTax = useMutation({
    mutationFn: (p: number) => setTaxFn({ data: { percent: p } }),
    onSuccess: () => {
      toast.success("Imposto atualizado");
      qc.invalidateQueries({ queryKey: ["settings", "tax-percent"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (e: unknown) =>
      toast.error("Erro ao salvar imposto", {
        description: e instanceof Error ? e.message : "Verifique se você tem permissão de administrador.",
      }),
  });

  return (
    <Card>
      <CardHeader><CardTitle>Configurações financeiras</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <div className="max-w-sm space-y-2">
          <Label>Taxa % padrão do cartão de crédito</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              disabled={q.isLoading}
              className="w-32"
            />
            <span className="text-sm text-muted-foreground">%</span>
            <Button
              onClick={() => {
                const n = Number(percent);
                if (!Number.isFinite(n) || n < 0 || n > 100)
                  return toast.error("Informe um valor entre 0 e 100");
                mut.mutate(n);
              }}
              disabled={mut.isPending || q.isLoading}
            >
              {mut.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
              Salvar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Aplicada automaticamente em novos pagamentos por cartão. Pode ser ajustada por pagamento individualmente.
          </p>
        </div>

        <div className="max-w-sm space-y-2 border-t border-border/60 pt-5">
          <Label>Alíquota % de imposto sobre o lucro</Label>
          {qTax.data?.clamped ? (
            <div
              role="alert"
              data-testid="tax-clamp-warning"
              className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300"
            >
              O valor salvo
              {qTax.data.rawPercent !== null ? ` (${qTax.data.rawPercent}%)` : ""}
              {" "}estava fora do intervalo permitido (0%–100%) e foi ajustado
              automaticamente para {qTax.data.percent}%. Salve novamente para persistir a correção.
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <Input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={taxPercent}
              onChange={(e) => setTaxPercentState(e.target.value)}
              disabled={qTax.isLoading}
              className="w-32"
            />
            <span className="text-sm text-muted-foreground">%</span>
            <Button
              onClick={() => {
                const n = Number(taxPercent);
                if (!Number.isFinite(n) || n < 0 || n > 100)
                  return toast.error("Informe um valor entre 0 e 100");
                mutTax.mutate(n);
              }}
              disabled={mutTax.isPending || qTax.isLoading}
            >
              {mutTax.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
              Salvar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Usada para calcular o card &ldquo;Imposto&rdquo; no Dashboard e abater automaticamente do lucro líquido.
            Valores fora de 0%–100% são corrigidos automaticamente na leitura.
          </p>
        </div>

      </CardContent>
    </Card>
  );
}

