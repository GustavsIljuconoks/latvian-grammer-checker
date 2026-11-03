import Stripe from "stripe";
import type { SubscriptionStatus } from "../../shared/types";
import type { Store, SubscriptionRecord } from "./store";

/** The payment module (design doc 2.1.1): the Stripe calls the server makes. */
export interface Billing {
  /** A Stripe Checkout page for the subscription. Returns its URL. */
  createCheckout(userId: string, customerId: string | null): Promise<string>;
  /** Stripe's billing portal, where the user can update their card or cancel. Returns its URL. */
  createPortal(customerId: string): Promise<string>;
  /** Verifies the webhook signature; throws if it doesn't match. */
  parseWebhook(rawBody: Buffer, signature: string): Stripe.Event;
  getSubscription(subscriptionId: string): Promise<Stripe.Subscription>;
  getCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session>;
  cancelSubscription(subscriptionId: string): Promise<void>;
}

export interface StripeBillingOptions {
  webhookSecret: string;
  priceId: string;
  /** Where Stripe sends the user back to, e.g. http://localhost:5173. */
  appUrl: string;
}

const settingsUrl = (appUrl: string, result: string) => `${appUrl}/iestatijumi?abonements=${result}`;

export function createStripeBilling(stripe: Stripe, options: StripeBillingOptions): Billing {
  return {
    async createCheckout(userId, customerId) {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: options.priceId, quantity: 1 }],
        // Managed Payments (Stripe as reseller, handling sales tax) needs a tax code on every
        // product; a prototype doesn't need it, so this session is a plain card payment.
        managed_payments: { enabled: false },
        client_reference_id: userId,
        ...(customerId && { customer: customerId }),
        // The webhook finds the user through this, whichever event arrives.
        subscription_data: { metadata: { userId } },
        // Stripe fills in {CHECKOUT_SESSION_ID}, so the page can ask the server to sync right away.
        success_url: `${settingsUrl(options.appUrl, "veiksmigi")}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: settingsUrl(options.appUrl, "atcelts"),
      });
      if (!session.url) throw new Error("Stripe returned a Checkout session without a URL");
      return session.url;
    },
    async createPortal(customerId) {
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${options.appUrl}/iestatijumi?abonements=parvaldits`,
      });
      return session.url;
    },
    parseWebhook(rawBody, signature) {
      return stripe.webhooks.constructEvent(rawBody, signature, options.webhookSecret);
    },
    getSubscription(id) {
      return stripe.subscriptions.retrieve(id);
    },
    getCheckoutSession(id) {
      return stripe.checkout.sessions.retrieve(id);
    },
    async cancelSubscription(id) {
      await stripe.subscriptions.cancel(id);
    },
  };
}

export function isActive(status: SubscriptionStatus | null | undefined): boolean {
  return status === "active" || status === "trialing";
}

function toRecord(userId: string, sub: Stripe.Subscription): SubscriptionRecord {
  const periodEnd = sub.items.data[0]?.current_period_end;
  return {
    userId,
    stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    stripeSubscriptionId: sub.id,
    status: sub.status as SubscriptionStatus,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
  };
}

const idOf = (ref: string | { id: string }) => (typeof ref === "string" ? ref : ref.id);

/** Reads a subscription from Stripe and stores its current state for the user it belongs to. */
async function syncSubscription(subscriptionId: string, userId: string | null, billing: Billing, store: Store): Promise<void> {
  const sub = await billing.getSubscription(subscriptionId);
  userId ??= sub.metadata.userId ?? null;
  if (!userId) {
    console.warn(`Stripe subscription ${sub.id} has no userId; ignored`);
    return;
  }
  await store.saveSubscription(toRecord(userId, sub));
}

/**
 * Activates the subscription as soon as the user is back from Checkout, without waiting for the
 * webhook (which can be late, or missing when `stripe listen` isn't running). Returns false if the
 * session isn't this user's or isn't paid.
 */
export async function syncCheckoutSession(sessionId: string, userId: string, billing: Billing, store: Store): Promise<boolean> {
  const session = await billing.getCheckoutSession(sessionId);
  if (session.client_reference_id !== userId || session.mode !== "subscription" || !session.subscription) return false;
  await syncSubscription(idOf(session.subscription), userId, billing, store);
  return true;
}

/**
 * Keeps the stored subscription in step with Stripe (spec 4.1, 4.2). Events can arrive out of
 * order, so each one re-reads the subscription from Stripe instead of trusting the event's copy.
 */
export async function handleStripeEvent(event: Stripe.Event, billing: Billing, store: Store): Promise<void> {
  let subscriptionId: string | null = null;
  let userId: string | null = null;

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.mode !== "subscription" || !session.subscription) return;
      subscriptionId = idOf(session.subscription);
      userId = session.client_reference_id;
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
      subscriptionId = event.data.object.id;
      break;
    default:
      return; // A failed renewal arrives as customer.subscription.updated with status past_due.
  }

  await syncSubscription(subscriptionId, userId, billing, store);
}
