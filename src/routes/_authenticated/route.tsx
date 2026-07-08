import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { RoyalLogo } from "@/components/brand/RoyalLogo";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // getSession() reads from localStorage synchronously (no network round-trip),
    // so the gate resolves instantly on subsequent navigations and the
    // pending component never flashes between sections.
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) throw redirect({ to: "/auth" });
    // Enforce AAL2 whenever the account has a verified TOTP factor.
    // nextLevel === "aal2" means the current session is only aal1 but the
    // account has enrolled MFA — send the user to /mfa-verify.
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      throw redirect({ to: "/mfa-verify" });
    }
    return { user: data.session.user };
  },
  pendingComponent: AuthPending,
  // Only show pending UI if the check somehow takes longer than 800ms
  // (first load with cold localStorage). Section-to-section nav stays silent.
  pendingMs: 800,
  pendingMinMs: 400,
  component: LayoutComponent,
});

function AuthPending() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background">
      <RoyalLogo size={40} showWordmark />
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin text-gold" />
        Verificando sessão…
      </div>
    </div>
  );
}


function LayoutComponent() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}


