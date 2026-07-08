import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { AuthHero } from "@/components/auth/AuthHero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetSchema, type ResetInput } from "@/features/auth/schemas";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const form = useForm<ResetInput>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "", confirm: "" },
  });

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setReady(true);
      } else {
        toast.error("Link inválido ou expirado");
        navigate({ to: "/auth", replace: true });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const onSubmit = async ({ password }: ResetInput) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error("Não foi possível redefinir", { description: error.message });
      return;
    }
    toast.success("Senha atualizada");
    navigate({ to: "/dashboard", replace: true });
  };

  return (
    <AuthHero
      eyebrow="Segurança"
      title="Uma nova chave para"
      highlight="seu tempo."
      tagline="Escolha uma senha forte e única. Ela protege o acesso ao painel executivo Royal Joias."
    >
      <div className="bento-tile p-7 sm:p-8">
        <div className="mb-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-gold">
            Redefinir senha
          </p>
          <h2 className="mt-1 font-display text-2xl leading-tight">Definir nova senha</h2>
        </div>

        {!ready ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-gold" />
            Validando link seguro…
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <PasswordField
              id="password"
              label="Nova senha"
              autoComplete="new-password"
              {...form.register("password")}
              error={form.formState.errors.password?.message}
            />
            <PasswordField
              id="confirm"
              label="Confirmar senha"
              autoComplete="new-password"
              {...form.register("confirm")}
              error={form.formState.errors.confirm?.message}
            />
            <Button type="submit" className="h-11 w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Salvar nova senha"
              )}
            </Button>
          </form>
        )}
      </div>
    </AuthHero>
  );
}

interface PasswordFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

const PasswordField = Object.assign(
  (props: PasswordFieldProps) => {
    const { label, error, id, className, ...rest } = props;
    return (
      <div className="space-y-1.5">
        <Label
          htmlFor={id}
          className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
        >
          {label}
        </Label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={id}
            type="password"
            className={`h-11 bg-secondary/30 pl-10 ${className ?? ""}`}
            {...rest}
          />
        </div>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    );
  },
  { displayName: "PasswordField" },
);
