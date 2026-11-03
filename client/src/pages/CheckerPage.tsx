import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { DEMO_TEXT } from "../../../shared/demo";
import { MAX_TEXT_CHARS, type SubscriptionInfo } from "../../../shared/types";
import { useShell } from "@/components/AppShell";
import { PageFrame } from "@/components/PageFrame";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";
import { ApiRequestError, errorMessage, useApi } from "@/lib/api";
import { countWords } from "@/lib/format";
import { cn } from "@/lib/utils";
import { paths } from "@/routes";

export function CheckerPage() {
  const api = useApi();
  const navigate = useNavigate();
  const { refreshRecent } = useShell();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [needsSubscription, setNeedsSubscription] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionInfo>();
  // Test mode shows a fixed text and checks it without a language model; the user's own text is kept for later.
  const [demo, setDemo] = useState(false);
  const shown = demo ? DEMO_TEXT : text;
  const tooLong = !demo && text.length > MAX_TEXT_CHARS;

  useEffect(() => {
    api.getSubscription().then(setSubscription, () => {}); // only for the free-checks hint
  }, [api]);

  async function check() {
    setBusy(true);
    setError(undefined);
    setNeedsSubscription(false);
    try {
      const document = demo ? await api.createDemoDocument() : await api.createDocument(text);
      refreshRecent();
      navigate(paths.document(document.id), { state: { document } });
    } catch (err) {
      setError(errorMessage(err)); // the text stays in the box
      setNeedsSubscription(err instanceof ApiRequestError && err.code === "SUBSCRIPTION_REQUIRED");
      setBusy(false);
    }
  }

  return (
    <PageFrame title={t.checker.title} subtitle={t.checker.subtitle}>
      <div className="surface flex min-h-[420px] flex-1 flex-col px-5 py-6 lg:px-8 lg:py-7">
        <label htmlFor="checker-input" className="sr-only">
          {t.checker.inputLabel}
        </label>
        <textarea
          id="checker-input"
          value={shown}
          onChange={(e) => setText(e.target.value)}
          readOnly={busy || demo}
          placeholder={t.checker.placeholder}
          className={cn(
            "flex-1 resize-none bg-transparent text-base leading-[1.7] text-foreground caret-foreground outline-none transition-opacity duration-200 ease-out",
            (busy || demo) && "opacity-60",
          )}
        />
        {demo && <p className="mt-3 text-xs text-muted-foreground">{t.checker.demoHint}</p>}
        {(error || tooLong) && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error ?? t.errors.TEXT_TOO_LONG}{" "}
            {needsSubscription && (
              <Link to={paths.subscription} className="font-semibold underline">
                {t.checker.subscribe} →
              </Link>
            )}
          </p>
        )}
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-hairline pt-4">
          <div className="flex flex-col gap-1">
            <span className={cn("font-mono text-[11px] text-faint", tooLong && "text-destructive")}>
              {t.checker.counts(countWords(shown), shown.length)}
            </span>
            {subscription && !subscription.active && (
              <Link to={paths.subscription} className="font-mono text-[11px] text-faint hover:underline">
                {t.checker.freeLeft(subscription.freeChecksLeft)}
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              aria-pressed={demo}
              disabled={busy}
              onClick={() => {
                setDemo((on) => !on);
                setError(undefined);
                setNeedsSubscription(false);
              }}
              className={cn("h-[42px] rounded-full px-[18px] text-[13px] font-semibold", demo && "bg-secondary")}
            >
              {t.checker.demo}
            </Button>
            <Button
              onClick={check}
              disabled={busy || !shown.trim() || tooLong}
              className="h-[42px] rounded-full px-[22px] text-[13px] font-semibold"
            >
              {busy ? (
                <>
                  <Loader2 className="size-3.5 animate-spin motion-reduce:[animation-duration:2s]" />
                  {t.checker.checking}
                </>
              ) : (
                `${t.checker.check} →`
              )}
            </Button>
          </div>
        </div>
      </div>
    </PageFrame>
  );
}
