import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import { toast } from "sonner";
import type { DocumentDetail } from "../../../shared/types";
import { CorrectedText } from "@/components/CorrectedText";
import { CorrectionCard } from "@/components/CorrectionCard";
import { PageFrame } from "@/components/PageFrame";
import { Button, buttonVariants } from "@/components/ui/button";
import { t } from "@/i18n";
import { errorMessage, useApi } from "@/lib/api";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { paths } from "@/routes";

export function DocumentPage() {
  const { id = "" } = useParams();
  const location = useLocation();
  const api = useApi();
  const passed = (location.state as { document?: DocumentDetail } | null)?.document;
  const [doc, setDoc] = useState<DocumentDetail | undefined>(passed?.id === id ? passed : undefined);
  const [error, setError] = useState<string>();
  const [active, setActive] = useState<number | null>(null);
  const [showChanges, setShowChanges] = useState(false);

  useEffect(() => {
    if (doc?.id === id) return;
    let cancelled = false;
    setDoc(undefined);
    setError(undefined);
    setActive(null);
    api.getDocument(id).then(
      (d) => !cancelled && setDoc(d),
      (err) => !cancelled && setError(errorMessage(err)),
    );
    return () => {
      cancelled = true;
    };
  }, [api, id]);

  if (error || !doc) {
    return (
      <PageFrame title={t.document.title}>
        <p role={error ? "alert" : undefined} className={error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
          {error ?? t.common.loading}
        </p>
      </PageFrame>
    );
  }

  async function copy() {
    await navigator.clipboard.writeText(doc!.correctedText);
    toast(t.document.copied);
  }

  return (
    <PageFrame title={t.document.title} subtitle={formatShortDate(doc.createdAt)}>
      <div className="flex flex-1 flex-col gap-6 lg:flex-row lg:items-start">
        <section className="surface flex min-w-0 flex-1 flex-col px-5 py-6 lg:px-8 lg:py-7">
          <CorrectedText
            text={doc.correctedText}
            corrections={doc.corrections}
            active={active}
            onSelect={setActive}
            showChanges={showChanges}
          />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
            <span className="font-mono text-[11px] text-faint">{t.checker.counts(doc.wordCount, doc.correctedText.length)}</span>
            <div className="flex flex-wrap gap-2">
              {doc.corrections.length > 0 && (
                <Button
                  variant="ghost"
                  aria-pressed={showChanges}
                  onClick={() => setShowChanges((on) => !on)}
                  className="h-[42px] rounded-full px-[18px] text-[13px] font-semibold"
                >
                  {showChanges ? t.document.hideChanges : t.document.showChanges}
                </Button>
              )}
              <Button variant="outline" onClick={copy} className="h-[42px] rounded-full border-input px-[18px] text-[13px] font-semibold">
                {t.document.copy}
              </Button>
              <Link to={paths.checker} className={cn(buttonVariants(), "h-[42px] rounded-full px-[22px] text-[13px] font-semibold")}>
                {t.nav.newCheck}
              </Link>
            </div>
          </div>
        </section>

        <aside className="w-full shrink-0 lg:sticky lg:top-0 lg:w-[360px]">
          <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
            {t.document.corrections(doc.corrections.length)}
          </h2>
          {doc.corrections.length === 0 ? (
            <p className="surface p-5 text-sm text-muted-foreground">{t.document.noErrors}</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {doc.corrections.map((c, i) => (
                <li key={i}>
                  <CorrectionCard correction={c} index={i} active={active === i} onSelect={() => setActive(i)} />
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
    </PageFrame>
  );
}
