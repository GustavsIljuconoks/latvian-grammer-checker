import type { ReactNode } from "react";
import { t } from "@/i18n";

/** The design's "Login" board: dark brand panel on the left, the form on the right. Full screen from `lg`; a card on mobile. */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas p-4 lg:items-stretch lg:p-0">
      <div className="flex w-full max-w-[1320px] overflow-hidden rounded-[28px] bg-card shadow-[0_24px_60px_rgba(17,17,17,0.10)] lg:max-w-none lg:rounded-none lg:shadow-none">
        <aside className="hidden flex-1 flex-col bg-foreground p-14 text-background lg:flex">
          <div className="text-base font-bold tracking-[-0.01em]">LV</div>
          <div className="my-auto">
            <h1 className="mb-5 whitespace-pre-line text-[44px] font-extrabold leading-[1.15] tracking-[-0.02em]">
              {t.auth.heroTitle}
            </h1>
            <p className="max-w-[340px] text-[15px] leading-relaxed text-white/60">{t.auth.heroText}</p>
          </div>
        </aside>
        <main className="flex flex-1 items-center justify-center p-8 lg:p-14">
          <div className="flex w-full max-w-[340px] flex-col">
            <div className="mb-[18px] text-center text-sm font-bold text-subtle">LV</div>
            <h2 className="mb-1.5 text-center text-2xl font-bold">{title}</h2>
            <p className="mb-8 text-center text-[13px] text-muted-foreground">{subtitle}</p>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
