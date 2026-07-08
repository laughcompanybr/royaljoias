import logo from "@/assets/royal-logo.jpg";
import { cn } from "@/lib/utils";

interface RoyalLogoProps {
  size?: number;
  className?: string;
  showWordmark?: boolean;
}

export function RoyalLogo({ size = 36, className, showWordmark = true }: RoyalLogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <img
        src={logo}
        alt="Royal Joias"
        width={size}
        height={size}
        className="rounded-lg ring-1 ring-border object-cover"
        style={{ width: size, height: size }}
      />
      {showWordmark ? (
        <div className="flex flex-col leading-none">
          <span className="font-display text-lg tracking-wide text-foreground">Royal</span>
          <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            Joias
          </span>
        </div>
      ) : null}
    </div>
  );
}
