import { ChevronDown, ChevronRight, Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { Link } from "react-router";
import { toast } from "sonner";
import type { DocumentSummary } from "../../../shared/types";
import { useShell } from "@/components/AppShell";
import { ConfirmAction } from "@/components/ConfirmAction";
import { PageFrame } from "@/components/PageFrame";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { t } from "@/i18n";
import { errorMessage, useApi } from "@/lib/api";
import { dayGroup, formatShortDate, formatTime, type DayGroup } from "@/lib/format";
import { paths } from "@/routes";

const RANGES = ["all", "today", "week", "month"] as const;
type Range = (typeof RANGES)[number];
const GROUPS: DayGroup[] = ["today", "yesterday", "earlier"];

function rangeStart(range: Range, now = new Date()): string | undefined {
  if (range === "all") return undefined;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === "week") start.setDate(start.getDate() - 6);
  if (range === "month") start.setDate(start.getDate() - 29);
  return start.toISOString();
}

export function HistoryPage() {
  const api = useApi();
  const { refreshRecent } = useShell();
  const [range, setRange] = useState<Range>("all");
  const [query, setQuery] = useState("");
  const [docs, setDocs] = useState<DocumentSummary[]>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    setDocs(undefined);
    setError(undefined);
    api.listDocuments({ from: rangeStart(range) }).then(
      (d) => !cancelled && setDocs(d),
      (err) => !cancelled && setError(errorMessage(err)),
    );
    return () => {
      cancelled = true;
    };
  }, [api, range]);

  async function remove(doc: DocumentSummary) {
    await api.deleteDocument(doc.id);
    const drop = () => setDocs((current) => current?.filter((d) => d.id !== doc.id));
    if (document.startViewTransition) document.startViewTransition(() => flushSync(drop));
    else drop();
    refreshRecent();
    toast(t.history.deleted);
  }

  // text is encrypted at rest and the list has summaries only, so search matches titles in the browser.
  const needle = query.trim().toLocaleLowerCase("lv");
  const visible = (docs ?? []).filter((d) => d.title.toLocaleLowerCase("lv").includes(needle));
  const groups = GROUPS.map((g) => [g, visible.filter((d) => dayGroup(d.createdAt) === g)] as const).filter(
    ([, items]) => items.length > 0,
  );

  return (
    <PageFrame title={t.history.title} subtitle={t.history.subtitle}>
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <div className="flex max-w-[360px] flex-1 basis-56 items-center gap-2 rounded-[10px] bg-secondary px-3.5">
          <Search className="size-4 shrink-0 text-faint" aria-hidden="true" />
          <label htmlFor="history-search" className="sr-only">
            {t.history.searchLabel}
          </label>
          <input
            id="history-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.history.search}
            className="w-full bg-transparent py-[11px] text-[13px] outline-none"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" className="h-auto rounded-full border-input px-3.5 py-2 text-[13px] font-medium" />}
          >
            {t.history.ranges[range]} <ChevronDown className="size-3.5 text-faint" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuRadioGroup value={range} onValueChange={(v) => setRange(v as Range)}>
              {RANGES.map((r) => (
                <DropdownMenuRadioItem key={r} value={r}>
                  {t.history.ranges[r]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {!error && !docs && <p className="text-sm text-muted-foreground">{t.common.loading}</p>}
      {docs && groups.length === 0 && <p className="text-sm text-muted-foreground">{t.history.empty}</p>}

      {groups.map(([group, items]) => (
        <section key={group} className="mb-5">
          <h2 className="mx-3 mb-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-faint">{t.history.groups[group]}</h2>
          <ul className="flex flex-col">
            {items.map((doc) => (
              <li key={doc.id} className="group flex items-center gap-1" style={{ viewTransitionName: `doc-${doc.id}` }}>
                <Link
                  to={paths.document(doc.id)}
                  className="flex min-w-0 flex-1 items-center gap-3.5 rounded-xl px-3 py-3.5 transition-colors hover:bg-[#f7f7f4]"
                >
                  <span className="size-[34px] shrink-0 rounded-[9px] bg-secondary" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{doc.title}</span>
                    <span className="mt-[3px] block font-mono text-[11px] text-faint">
                      {group === "earlier" ? formatShortDate(doc.createdAt) : formatTime(doc.createdAt)} · {t.history.words(doc.wordCount)}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 opacity-35 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                </Link>
                <ConfirmAction
                  trigger={
                    <Button variant="ghost" size="icon" aria-label={t.history.deleteOne(doc.title)} className="text-faint hover:text-destructive" />
                  }
                  triggerContent={<Trash2 />}
                  title={t.history.deleteTitle}
                  description={t.history.deleteText}
                  confirmLabel={t.history.delete}
                  onConfirm={() => remove(doc)}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </PageFrame>
  );
}
