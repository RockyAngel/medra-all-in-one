import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { Logo } from "./Logo";
import logo from "@/assets/medra-logo.png.asset.json";

export function AuthLayout({
  heading,
  blurb,
  highlights,
  children,
}: {
  heading: string;
  blurb: string;
  highlights: string[];
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-2">
      <aside className="hero-surface flex flex-col justify-between gap-10 px-8 py-10 lg:px-12">
        <Logo tone="dark" size={44} />
        <div>
          <h2 className="max-w-sm text-3xl font-extrabold leading-tight md:text-4xl">
            {heading}
          </h2>
          <p className="mt-3 max-w-sm text-sm text-ink-foreground/75">{blurb}</p>
          <ul className="mt-7 space-y-3">
            {highlights.map((h) => (
              <li key={h} className="flex items-center gap-3 text-sm">
                <span className="grid size-6 place-items-center rounded-full bg-leaf/20 text-leaf">
                  <Check className="size-3.5" />
                </span>
                {h}
              </li>
            ))}
          </ul>
        </div>
        <img
          src={logo.url}
          alt=""
          aria-hidden="true"
          className="hidden w-56 opacity-90 lg:block"
        />
      </aside>

      <main className="flex items-center justify-center px-5 py-10 lg:px-12">
        <div className="w-full max-w-lg">{children}</div>
      </main>
    </div>
  );
}
