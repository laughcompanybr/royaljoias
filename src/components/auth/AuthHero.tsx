import { motion } from "framer-motion";
import { RoyalJoias } from "@/components/brand/RoyalJoias";

interface AuthHeroProps {
  eyebrow: string;
  title: string;
  highlight?: string;
  tagline: string;
  children: React.ReactNode;
}

/**
 * Split-screen Noir & Gold auth shell.
 * - Left: cinematic hero with drifting aurora + Sora display.
 * - Right: interactive panel (form).
 * Collapses to single column on mobile.
 */
export function AuthHero({ eyebrow, title, highlight, tagline, children }: AuthHeroProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Global film grain */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, oklch(1 0 0 / 0.6) 1px, transparent 0)",
          backgroundSize: "22px 22px",
        }}
      />

      <div className="relative z-10 grid min-h-screen w-full grid-cols-1 lg:grid-cols-[1.25fr_1fr] xl:grid-cols-[1.35fr_1fr]">
        {/* HERO — Noir & Gold cinematic */}
        <section className="relative isolate hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-16 xl:p-20">
          <div aria-hidden className="noir-aurora animate-aurora absolute inset-0 -z-10" />
          <div
            aria-hidden
            className="absolute inset-0 -z-10"
            style={{
              backgroundImage:
                "linear-gradient(180deg, transparent 0%, oklch(0.115 0.003 260 / 0.75) 100%)",
            }}
          />
          <div
            aria-hidden
            className="absolute inset-y-0 right-0 -z-10 w-px gold-hairline opacity-60"
          />

          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <RoyalJoias size={44} />
          </motion.div>

          <div className="max-w-xl">
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.05 }}
              className="mb-6 text-[11px] font-semibold uppercase tracking-[0.35em] text-gold"
            >
              {eyebrow}
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="font-display text-[clamp(2.75rem,4.5vw,4.5rem)] font-semibold leading-[0.98] tracking-[-0.035em] text-foreground"
            >
              {title}
              {highlight ? (
                <>
                  <br />
                  <span className="text-gold-shine">{highlight}</span>
                </>
              ) : null}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.35 }}
              className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground"
            >
              {tagline}
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="flex items-center justify-between text-[10px] uppercase tracking-[0.3em] text-muted-foreground"
          >
            <span>Royal Joias · {new Date().getFullYear()}</span>
            <span className="hidden items-center gap-2 xl:flex">
              <span className="size-1.5 rounded-full bg-gold" />
              Painel executivo
            </span>
          </motion.div>
        </section>

        {/* FORM PANEL */}
        <section className="relative flex flex-col items-center justify-center px-6 py-14 sm:px-12 lg:px-16 xl:px-24">
          {/* Mobile-only compact hero */}
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8 flex flex-col items-center gap-4 text-center lg:hidden"
          >
            <RoyalJoias size={44} />
            <h1 className="font-display text-3xl leading-tight">
              {title}
              {highlight ? <span className="ml-2 text-gold-shine">{highlight}</span> : null}
            </h1>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-md lg:max-w-lg xl:max-w-xl"
          >
            {children}
          </motion.div>

          <div className="mt-10 flex w-full max-w-md flex-col items-center gap-1 text-center lg:max-w-lg xl:max-w-xl">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Acesso restrito. Novos usuários são provisionados exclusivamente pelo administrador.
            </p>
            <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground/70">
              Developed by Laugh Company
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
