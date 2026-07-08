import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { z } from "zod";

const searchSchema = z.object({
  from: z.string().optional(),
  reason: z.string().optional(),
});

export const Route = createFileRoute("/access-denied")({
  validateSearch: searchSchema,
  component: AccessDeniedPage,
  head: () => ({
    meta: [
      { title: "Acesso restrito — Royal Joias" },
      {
        name: "description",
        content:
          "Sua conta não tem permissão para acessar este recurso do Royal Joias.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

function AccessDeniedPage() {
  const { from, reason } = useSearch({ from: "/access-denied" });

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="max-w-lg text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full border border-gold/30 bg-gold/10 text-gold">
          <ShieldAlert className="size-8" aria-hidden="true" />
        </div>
        <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight text-foreground">
          Acesso restrito
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Sua conta não possui as permissões necessárias
          {from ? (
            <>
              {" "}para acessar <span className="text-foreground">{from}</span>
            </>
          ) : null}
          . Solicite acesso de <strong className="text-foreground">staff</strong> ou{" "}
          <strong className="text-foreground">admin</strong> ao responsável pelo workspace.
        </p>
        {reason ? (
          <p className="mt-2 text-xs text-muted-foreground/80">
            Detalhe técnico: <code>{reason}</code>
          </p>
        ) : null}
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button asChild variant="secondary">
            <Link to="/">
              <ArrowLeft className="mr-2 size-4" aria-hidden="true" />
              Voltar à navegação segura
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/auth">Trocar de conta</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
