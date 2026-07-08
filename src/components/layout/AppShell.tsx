import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AppTopbar } from "./AppTopbar";
import { supabase } from "@/integrations/supabase/client";

export function AppShell({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState("");
  const [year, setYear] = useState<number | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? "");
    });
    // Compute year on the client only to avoid SSR/CSR hydration
    // mismatch across the year boundary.
    setYear(new Date().getFullYear());
  }, []);

  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppTopbar userEmail={email} />
          <main className="flex-1 overflow-x-hidden">
            <div className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 lg:py-8">{children}</div>
          </main>
          <footer className="border-t border-border/60 bg-background/60 backdrop-blur">
            <div className="mx-auto flex w-full max-w-[1440px] flex-col items-center justify-between gap-1 px-4 py-3 text-[10px] uppercase tracking-[0.22em] text-muted-foreground sm:flex-row sm:px-6">
              <span suppressHydrationWarning>© {year ?? ""} Royal Joias</span>
              <span className="text-muted-foreground/80">Developed by Laugh Company</span>
            </div>
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
}

