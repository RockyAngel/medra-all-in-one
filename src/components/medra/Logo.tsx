import { Link } from "@tanstack/react-router";
import logo from "@/assets/medra-logo.png.asset.json";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  size = 44,
  tone = "light",
  showTagline = true,
  stacked = false,
}: {
  className?: string;
  size?: number;
  tone?: "light" | "dark";
  showTagline?: boolean;
  stacked?: boolean;
}) {
  return (
    <Link
      to="/"
      className={cn(
        "flex items-center gap-3",
        stacked && "flex-col gap-2 text-center",
        className,
      )}
    >
      <img
        src={logo.url}
        alt="Medra logo"
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
      <span className={stacked ? "block" : "leading-tight"}>
        <span
          className={cn(
            "block text-2xl font-extrabold tracking-tight",
            tone === "dark" ? "text-ink-foreground" : "text-foreground",
          )}
        >
          medra
        </span>
        {showTagline && (
          <span className="block text-[11px] font-semibold">
            <span className="text-leaf">Shop Better.</span>{" "}
            <span className="text-sky">Live Better.</span>
          </span>
        )}
      </span>
    </Link>
  );
}
