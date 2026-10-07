import type { Correction } from "../../../shared/types";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

export function CorrectionCard(props: { correction: Correction; index: number; active: boolean; onSelect: () => void }) {
  const { correction: c, index } = props;
  return (
    <button
      type="button"
      id={`correction-${index}`}
      onMouseEnter={props.onSelect}
      onFocus={props.onSelect}
      onClick={() => {
        props.onSelect();
        document.getElementById(`span-${index}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }}
      className={cn(
        "surface block w-full p-5 text-left transition-colors hover:border-[#d8d8d1]",
        props.active && "border-foreground hover:border-foreground",
      )}
    >
      <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
        {t.categories[c.category]}
      </span>
      <span className="block text-[15px] leading-snug">
        <del className="text-muted-foreground">{c.original}</del> <span aria-hidden="true">→</span>
        <span className="sr-only"> {t.document.replacedWith} </span>{" "}
        <ins className="font-semibold no-underline">{c.replacement || t.document.removed}</ins>
      </span>
      <span className="mt-2 block text-[13px] leading-normal text-muted-foreground">{c.explanation}</span>
    </button>
  );
}
