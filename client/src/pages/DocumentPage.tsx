import { Check, CircleCheck, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
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
  const navigate = useNavigate();
  const api = useApi();
  const passed = (location.state as { document?: DocumentDetail } | null)?.document;
  const [doc, setDoc] = useState<DocumentDetail | undefined>(passed?.id === id ? passed : undefined);
  const [error, setError] = useState<string>();
  const [active, setActive] = useState<number | null>(null);
  const [showChanges, setShowChanges] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // only a just-checked document plays its entrance; reopening from history stays instant.
  const [freshId] = useState(passed?.id);

  // history state outlives deletes and sign-outs, so drop it once read;
  useEffect(() => {
    if (location.state) navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);

  useEffect(() => () => clearTimeout(copiedTimer.current), []);

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

  const fresh = doc.id === freshId;

  async function copy() {
    await navigator.clipboard.writeText(doc!.correctedText);
    setCopied(true);
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 2000);
  }

  const iconSwap =
    "col-start-1 row-start-1 size-4 transition-[opacity,scale,filter] duration-300 ease-out motion-reduce:transition-opacity";
  const iconHidden = "scale-25 opacity-0 blur-[4px] motion-reduce:scale-100 motion-reduce:blur-none";

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
                <span aria-hidden="true" className="grid">
                  <Copy className={cn(iconSwap, copied && iconHidden)} />
                  <Check className={cn(iconSwap, !copied && iconHidden)} />
                </span>
                {t.document.copy}
                <span role="status" className="sr-only">
                  {copied ? t.document.copied : ""}
                </span>
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
            <p className="surface flex items-center gap-3 p-5 text-sm text-muted-foreground">
              <CircleCheck
                aria-hidden="true"
                className={cn(
                  "size-5 shrink-0 text-foreground",
                  fresh &&
                    "transition-[opacity,scale] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] starting:scale-90 starting:opacity-0 motion-reduce:starting:scale-100",
                )}
              />
              {t.document.noErrors}
            </p>
          ) : (
            <ol className="flex flex-col gap-3">
              {doc.corrections.map((c, i) => (
                <li
                  key={i}
                  className={cn(
                    fresh &&
                      "transition-[opacity,translate] duration-200 ease-out starting:translate-y-1 starting:opacity-0 motion-reduce:starting:translate-y-0",
                  )}
                  style={fresh ? { transitionDelay: `${Math.min(i, 5) * 40}ms` } : undefined}
                >
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
