import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Mail, Lock } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { AuthHero } from "@/components/auth/AuthHero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  signInSchema,
  forgotSchema,
  type SignInInput,
  type ForgotInput,
} from "@/features/auth/schemas";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "forgot">("signin");

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  return (
    <AuthHero
      eyebrow="Painel restrito"
      title={mode === "forgot" ? "Recupere seu" : "Especialista em"}
      highlight={mode === "forgot" ? "acesso." : "Joias Exclusivas."}
      tagline={
        mode === "forgot"
          ? "Enviaremos um link seguro para seu e-mail para redefinir sua senha em segundos."
          : "Bem-vindo de volta ao painel executivo Royal Joias. Sua operação, com sofisticação."
      }
    >
      <div className="bento-tile p-7 sm:p-8">
        <div className="mb-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-gold">
            {mode === "forgot" ? "Recuperar senha" : "Entrar"}
          </p>
          <h2 className="mt-1 font-display text-2xl leading-tight">
            {mode === "forgot" ? "Enviaremos um link seguro" : "Bem-vindo de volta"}
          </h2>
        </div>

        {mode === "forgot" ? (
          <ForgotForm onDone={() => setMode("signin")} />
        ) : (
          <SignInForm onForgot={() => setMode("forgot")} />
        )}
      </div>
    </AuthHero>
  );
}

function SignInForm({ onForgot }: { onForgot: () => void }) {
  const navigate = useNavigate();
  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: SignInInput) => {
    const { error } = await supabase.auth.signInWithPassword(values);
    if (error) {
      toast.error("Não foi possível entrar", { description: error.message });
      return;
    }
    // If the account has an enrolled TOTP factor, prompt for the OTP before
    // landing on the dashboard. AAL2 upgrade happens on /mfa-verify.
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      navigate({ to: "/mfa-verify", replace: true });
      return;
    }
    toast.success("Bem-vindo!");
    navigate({ to: "/dashboard", replace: true });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <Field
        icon={<Mail className="size-4" />}
        label="E-mail"
        id="email"
        type="email"
        autoComplete="email"
        {...form.register("email")}
        error={form.formState.errors.email?.message}
      />
      <Field
        icon={<Lock className="size-4" />}
        label="Senha"
        id="password"
        type="password"
        autoComplete="current-password"
        {...form.register("password")}
        error={form.formState.errors.password?.message}
      />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onForgot}
          className="text-xs text-muted-foreground transition-colors hover:text-gold"
        >
          Esqueci minha senha
        </button>
      </div>
      <Button type="submit" className="h-11 w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? <Loader2 className="size-4 animate-spin" /> : "Entrar"}
      </Button>
    </form>
  );
}

function ForgotForm({ onDone }: { onDone: () => void }) {
  const form = useForm<ForgotInput>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async ({ email }: ForgotInput) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast.error("Erro ao enviar", { description: error.message });
      return;
    }
    toast.success("E-mail enviado", { description: "Verifique sua caixa de entrada." });
    onDone();
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <Field
        icon={<Mail className="size-4" />}
        label="E-mail"
        id="email"
        type="email"
        {...form.register("email")}
        error={form.formState.errors.email?.message}
      />
      <div className="flex gap-2">
        <Button type="button" variant="secondary" className="h-11 flex-1" onClick={onDone}>
          Voltar
        </Button>
        <Button type="submit" className="h-11 flex-1" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            "Enviar link"
          )}
        </Button>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Lembrou?{" "}
        <Link to="/auth" className="text-gold hover:underline">
          Voltar ao login
        </Link>
      </p>
    </form>
  );
}

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  icon?: React.ReactNode;
}

const Field = Object.assign(
  (props: FieldProps) => {
    const { label, error, icon, id, className, ...rest } = props;
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id} className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </Label>
        <div className="relative">
          {icon ? (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors">
              {icon}
            </span>
          ) : null}
          <Input
            id={id}
            className={`h-11 bg-secondary/30 ${icon ? "pl-10" : ""} ${className ?? ""}`}
            {...rest}
          />
        </div>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    );
  },
  { displayName: "Field" },
);
