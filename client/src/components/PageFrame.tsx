import type { ReactNode } from "react";

export function PageFrame(props: { title: string; subtitle?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col px-4 py-6 lg:px-14 lg:py-12">
      <header className="mb-7 flex items-start justify-between gap-4 lg:mb-8">
        <div>
          <h1 className="text-[28px] font-bold leading-[1.15] tracking-[-0.015em] lg:text-[32px]">{props.title}</h1>
          {props.subtitle && <p className="mt-2 max-w-[440px] text-sm leading-normal text-muted-foreground">{props.subtitle}</p>}
        </div>
        {props.actions}
      </header>
      {props.children}
    </div>
  );
}
