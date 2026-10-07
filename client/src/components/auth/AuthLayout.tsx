import type { ReactNode } from "react";
import { t } from "@/i18n";

/** The design's "Login" board: dark brand panel on the left, the form on the right. Full screen from `lg`; a card on mobile. */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas p-4 lg:items-stretch lg:p-0">
      <div className="flex w-full max-w-[1320px] overflow-hidden rounded-[28px] bg-card shadow-[0_24px_60px_rgba(17,17,17,0.10)] lg:max-w-none lg:rounded-none lg:shadow-none">
        <aside className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-foreground p-14 text-background lg:flex">
          <div aria-hidden="true" className="absolute -bottom-16 -left-5 font-mono text-[320px] font-medium leading-none text-white/5">
            01
          </div>
          <div className="relative text-base font-bold tracking-[-0.01em]">Proof</div>
          <div className="relative">
            <h1 className="mb-5 whitespace-pre-line text-[44px] font-extrabold leading-[1.15] tracking-[-0.02em]">
              {t.auth.heroTitle}
            </h1>
            <p className="max-w-[340px] text-[15px] leading-relaxed text-white/60">{t.auth.heroText}</p>
          </div>
          <div className="relative font-mono text-[11px] uppercase tracking-[0.1em] text-white/40">{t.auth.heroTags}</div>
        </aside>
        <main className="flex flex-1 items-center justify-center p-8 lg:p-14">
          <div className="flex w-full max-w-[340px] flex-col">
            <div className="mb-[18px] text-center text-sm font-bold text-subtle">Proof</div>
            <h2 className="mb-1.5 text-center text-2xl font-bold">{title}</h2>
            <p className="mb-8 text-center text-[13px] text-muted-foreground">{subtitle}</p>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
