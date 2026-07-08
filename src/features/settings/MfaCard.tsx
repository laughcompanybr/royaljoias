import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Loader2, ShieldCheck, KeyRound, Copy, AlertTriangle } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  regenerateBackupCodes,
  remainingBackupCodes,
} from "@/lib/mfa.functions";

type Factor = { id: string; friendly_name?: string | null; status: string; factor_type: string };
type EnrollState =
  | { phase: "idle" }
  | { phase: "enrolling"; factorId: string; qr: string; secret: string }
  | { phase: "verifying"; factorId: string; qr: string; secret: string; code: string }
  | { phase: "backup"; codes: string[] };

/**
 * Manages TOTP enrollment, verification and disable flow for the current user.
 * Opt-in — until the user enrolls, no MFA is enforced.
 */
export function MfaCard() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<EnrollState>({ phase: "idle" });
  const [disabling, setDisabling] = useState<string | null>(null);
  const qc = useQueryClient();
  const genCodes = useServerFn(regenerateBackupCodes);
  const remainingFn = useServerFn(remainingBackupCodes);

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      toast.error("Falha ao carregar fatores", { description: error.message });
    } else {
      const list: Factor[] = [...(data?.totp ?? []), ...(data?.phone ?? [])];
      setFactors(list);
    }
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const verifiedTotp = factors.find((f) => f.factor_type === "totp" && f.status === "verified");

  const remainingQ = useQuery({
    queryKey: ["mfa", "backup-remaining"],
    queryFn: () => remainingFn(),
    enabled: !!verifiedTotp,
    staleTime: 15_000,
  });

  const regenMut = useMutation({
    mutationFn: () => genCodes(),
    onSuccess: (res) => {
      setState({ phase: "backup", codes: res.codes });
      void qc.invalidateQueries({ queryKey: ["mfa", "backup-remaining"] });
      toast.success("Novos códigos gerados");
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const startEnroll = async () => {
    // Clean up any half-enrolled TOTP factors to avoid the "friendly name already exists" error.
    for (const f of factors.filter((x) => x.factor_type === "totp" && x.status !== "verified")) {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Royal ${new Date().toISOString().slice(0, 10)}`,
    });
    if (error || !data) {
      toast.error("Não foi possível iniciar", { description: error?.message });
      return;
    }
    setState({
      phase: "enrolling",
      factorId: data.id,
      qr: data.totp.qr_code,
      secret: data.totp.secret,
    });
  };

  const verify = async () => {
    if (state.phase !== "verifying" && state.phase !== "enrolling") return;
    const factorId = state.factorId;
    const code = "code" in state ? state.code : "";
    if (code.length !== 6) return;
    const { data: c, error: cErr } = await supabase.auth.mfa.challenge({ factorId });
    if (cErr || !c) return toast.error("Falha ao desafiar", { description: cErr?.message });
    const { error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: c.id,
      code,
    });
    if (error) return toast.error("Código incorreto", { description: error.message });
    toast.success("Autenticação em duas etapas ativada");
    await refresh();
    // Immediately generate backup codes so the user has them.
    regenMut.mutate();
  };

  const disable = async (factorId: string) => {
    setDisabling(factorId);
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    setDisabling(null);
    if (error) return toast.error("Não foi possível desativar", { description: error.message });
    toast.success("2FA desativada");
    setState({ phase: "idle" });
    await refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-gold" /> Autenticação em duas etapas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Carregando…
          </div>
        ) : verifiedTotp ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="secondary" className="gap-1">
                <ShieldCheck className="size-3.5 text-[color:var(--color-success)]" /> Ativa
              </Badge>
              <span className="text-sm text-muted-foreground">
                {verifiedTotp.friendly_name ?? "Autenticador"} — protegendo sua conta.
              </span>
            </div>

            <div className="rounded-lg border border-border bg-secondary/30 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <KeyRound className="size-4 text-gold" /> Códigos de recuperação
                </span>
                <span className="text-xs text-muted-foreground">
                  {remainingQ.data?.remaining ?? "…"} restantes
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Use se perder acesso ao app autenticador. Cada código funciona uma única vez.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => regenMut.mutate()}
                  disabled={regenMut.isPending}
                >
                  {regenMut.isPending ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
                  Gerar novos códigos
                </Button>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => disable(verifiedTotp.id)}
                disabled={disabling === verifiedTotp.id}
              >
                {disabling === verifiedTotp.id ? (
                  <Loader2 className="mr-1 size-4 animate-spin" />
                ) : null}
                Desativar 2FA
              </Button>
            </div>
          </div>
        ) : state.phase === "idle" ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Adicione uma camada extra de segurança usando um aplicativo autenticador
              (Google Authenticator, Authy, 1Password). Você poderá gerar códigos de recuperação
              logo em seguida.
            </p>
            <Button onClick={startEnroll}>Ativar 2FA</Button>
          </div>
        ) : state.phase === "enrolling" || state.phase === "verifying" ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid gap-4 md:grid-cols-2"
          >
            <div className="space-y-2">
              <p className="text-sm font-medium">1. Escaneie o QR no seu autenticador</p>
              <div className="rounded-lg border border-border bg-background p-3">
                <img src={state.qr} alt="QR code para 2FA" className="mx-auto size-44" />
              </div>
              <p className="text-xs text-muted-foreground">
                Ou insira manualmente:
              </p>
              <div className="flex items-center gap-2 rounded border border-border bg-secondary/40 px-2 py-1 font-mono text-xs">
                <span className="flex-1 truncate">{state.secret}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    void navigator.clipboard.writeText(state.secret);
                    toast.success("Copiado");
                  }}
                  aria-label="Copiar segredo"
                >
                  <Copy className="size-3.5" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">2. Insira o código de 6 dígitos</p>
              <Label htmlFor="totp-code" className="sr-only">Código TOTP</Label>
              <Input
                id="totp-code"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoComplete="one-time-code"
                placeholder="000000"
                value={"code" in state ? state.code : ""}
                onChange={(e) => {
                  const code = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setState({ ...state, phase: "verifying", code });
                }}
                className="h-11 text-center font-mono text-lg tracking-[0.35em]"
              />
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setState({ phase: "idle" })}>
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  onClick={verify}
                  disabled={!("code" in state) || state.code.length !== 6}
                >
                  Verificar e ativar
                </Button>
              </div>
            </div>
          </motion.div>
        ) : state.phase === "backup" ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg border border-[color:var(--color-warning)]/40 bg-[color:var(--color-warning)]/10 p-3 text-sm">
              <AlertTriangle className="size-4 shrink-0 text-[color:var(--color-warning)]" />
              <span>
                Salve estes códigos em local seguro. Eles <strong>não serão exibidos novamente</strong>.
                Cada código funciona uma única vez.
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-secondary/30 p-3 font-mono text-sm sm:grid-cols-2">
              {state.codes.map((c) => (
                <div key={c} className="rounded bg-background/60 px-2 py-1.5 text-center tracking-wider">
                  {c}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(state.codes.join("\n"));
                  toast.success("Códigos copiados");
                }}
              >
                <Copy className="mr-1 size-4" /> Copiar todos
              </Button>
              <Button onClick={() => setState({ phase: "idle" })}>Concluir</Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
