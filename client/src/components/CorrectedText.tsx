import type { ReactNode } from "react";
import type { Correction } from "../../../shared/types";
import { cn } from "@/lib/utils";

export function CorrectedText(props: {
  text: string;
  corrections: Correction[];
  active: number | null;
  onSelect: (index: number) => void;
  showChanges: boolean;
}) {
  const parts: ReactNode[] = [];
  let cursor = 0;
  props.corrections.forEach((c, i) => {
    parts.push(props.text.slice(cursor, c.start));
    if (props.showChanges) {
      parts.push(
        <del key={`del-${i}`} className="mr-0.5 text-muted-foreground">
          {c.original}
        </del>,
      );
    }
    parts.push(
      <mark
        key={i}
        id={`span-${i}`}
        onClick={() => {
          props.onSelect(i);
          document.getElementById(`correction-${i}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }}
        className={cn(
          "cursor-pointer rounded-[4px] bg-secondary px-0.5 text-inherit underline decoration-2 underline-offset-4 transition-colors",
          props.active === i && "bg-foreground text-background",
        )}
      >
        {/* A deletion has an empty range; show a dot so it can still be clicked. */}
        {props.text.slice(c.start, c.end) || "·"}
      </mark>,
    );
    cursor = c.end;
  });
  parts.push(props.text.slice(cursor));

  return <div className="flex-1 whitespace-pre-wrap break-words text-base leading-[1.7]">{parts}</div>;
}
