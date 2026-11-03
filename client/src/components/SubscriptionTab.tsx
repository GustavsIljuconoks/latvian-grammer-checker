import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import type { SubscriptionInfo, SubscriptionStatus } from "../../../shared/types";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";
import { errorMessage, useApi } from "@/lib/api";

const pillClass = "h-[42px] rounded-full px-[22px] text-[13px] font-semibold";
const dateFormat = new Intl.DateTimeFormat("lv-LV", { day: "numeric", month: "long", year: "numeric" });

/** Payment went wrong but the subscription still exists: the user should fix their card (spec 4.3). */
const PAYMENT_PROBLEM: (SubscriptionStatus | null)[] = ["past_due", "unpaid", "incomplete"];

// The webhook that activates the subscription can land a moment after Stripe redirects back.
const ACTIVATION_POLLS = 10;
const POLL_MS = 2_000;

/** Stripe sends the user back with ?abonements=veiksmigi | atcelts | parvaldits, plus session_id after paying. */
const RESULT_PARAM = "abonements";
const SESSION_PARAM = "session_id";

export function SubscriptionTab() {
  const api = useApi();
  const [params, setParams] = useSearchParams();
  const [result] = useState(() => params.get(RESULT_PARAM));
  const [sessionId] = useState(() => params.get(SESSION_PARAM));
  const [info, setInfo] = useState<SubscriptionInfo>();
  const [loadError, setLoadError] = useState<string>();
  const [activating, setActivating] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!params.has(RESULT_PARAM) && !params.has(SESSION_PARAM)) return;
    params.delete(RESULT_PARAM);
    params.delete(SESSION_PARAM);
    setParams(params, { replace: true });
  }, [params, setParams]);

  useEffect(() => {
    // Toast ids keep React's dev-mode double run from showing a message twice.
    if (result === "atcelts") toast(t.subscription.cancelled, { id: "checkout-result" });

    let cancelled = false;
    async function load(pollsLeft: number, first = false) {
      if (cancelled) return;
      try {
        // Right after paying, ask the server to check with Stripe directly. If that fails, the
        // webhook still activates the subscription, and the polling below picks it up.
        const synced = first && result === "veiksmigi" && sessionId ? await api.syncCheckout(sessionId).catch(() => null) : null;
        const next = synced ?? (await api.getSubscription());
        if (cancelled) return;
        setInfo(next);
        if (result !== "veiksmigi") return;
        if (next.active) {
          setActivating(false);
          toast(t.subscription.success, { id: "checkout-result" });
        } else if (pollsLeft > 0) {
          setActivating(true);
          setTimeout(() => void load(pollsLeft - 1), POLL_MS);
        } else {
          setActivating(false);
        }
      } catch (err) {
        if (!cancelled) setLoadError(errorMessage(err));
      }
    }
    void load(ACTIVATION_POLLS, true);
    return () => {
      cancelled = true;
    };
  }, [api, result, sessionId]);

  async function goTo(getUrl: () => Promise<string>) {
    setRedirecting(true);
    try {
      window.location.assign(await getUrl());
    } catch (err) {
      toast.error(errorMessage(err));
      setRedirecting(false);
    }
  }

  if (loadError) return <p className="text-sm text-destructive">{loadError}</p>;
  if (!info) return <p className="text-sm text-muted-foreground">{t.common.loading}</p>;

  const paymentProblem = PAYMENT_PROBLEM.includes(info.status);
  const periodEnd = info.currentPeriodEnd && dateFormat.format(new Date(info.currentPeriodEnd));
  const busyIcon = redirecting && <Loader2 className="size-3.5 animate-spin motion-reduce:[animation-duration:2s]" />;

  return (
    <>
      <div className="surface mb-6 p-6 lg:p-8">
        <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
          <h2 className="text-base font-semibold">{info.active || paymentProblem ? t.subscription.paidPlan : t.subscription.freePlan}</h2>
          {info.status && (
            <span className="rounded-full bg-secondary px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              {t.subscription.status[info.status]}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {info.active || paymentProblem ? t.subscription.paidText : t.subscription.freeText(info.freeChecksLeft)}
        </p>
        {info.active && periodEnd && (
          <p className="mt-3 text-sm">{info.cancelAtPeriodEnd ? t.subscription.endsOn(periodEnd) : t.subscription.renewsOn(periodEnd)}</p>
        )}
        {paymentProblem && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {t.subscription.paymentFailed}
          </p>
        )}
        {activating && (
          <p role="status" className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin motion-reduce:[animation-duration:2s]" />
            {t.subscription.activating}
          </p>
        )}
      </div>
      <div className="flex flex-col items-end gap-3">
        {info.active || paymentProblem ? (
          <>
            <Button onClick={() => goTo(api.openBillingPortal)} disabled={redirecting} className={pillClass}>
              {busyIcon}
              {t.subscription.manage}
            </Button>
            <p className="text-xs text-muted-foreground">{t.subscription.manageText}</p>
          </>
        ) : (
          <Button onClick={() => goTo(api.startCheckout)} disabled={redirecting || activating} className={pillClass}>
            {busyIcon}
            {t.subscription.subscribe}
          </Button>
        )}
        <p className="text-xs text-faint">{t.subscription.stripeNote}</p>
      </div>
    </>
  );
}
