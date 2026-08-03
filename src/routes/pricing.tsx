import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { getCurrentUser, SUBSCRIPTION_ATTENTION_STATUSES, TRIAL_DURATION_MS } from "~/lib/auth";
import { stripe } from "~/lib/stripe";

// ---------------------------------------------------------------------------
// Server function: create a Stripe Checkout session for the Pro subscription
// ---------------------------------------------------------------------------

const createCheckoutSession = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ url: string | null; error?: string }> => {
    const user = await getCurrentUser();
    if (!user) return { url: null, error: "Please log in to subscribe." };

    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId) {
      return { url: null, error: "STRIPE_PRICE_ID not configured yet — check back soon!" };
    }

    // Calculate remaining trial days so Stripe doesn't charge until the trial ends
    const trialEnd =
      new Date(user.trialStartedAt).getTime() + TRIAL_DURATION_MS;
    const remainingDays = Math.max(
      0,
      Math.ceil((trialEnd - Date.now()) / (24 * 60 * 60 * 1000)),
    );

    try {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        ...(remainingDays > 0 && {
          subscription_data: { trial_period_days: remainingDays },
        }),
        success_url: `${process.env.APP_URL || "https://job-margin.com"}/pricing?success=true`,
        cancel_url: `${process.env.APP_URL || "https://job-margin.com"}/pricing?canceled=true`,
        customer_email: user.email,
      });
      if (!session.url) {
        return { url: null, error: "Could not start checkout. Please try again." };
      }
      return { url: session.url };
    } catch {
      return { url: null, error: "Could not start checkout. Please try again." };
    }
  },
);

// ---------------------------------------------------------------------------
// Query params: ?success=true | ?canceled=true | ?trial_expired=true
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Server function: open Stripe Customer Portal for subscription management
// ---------------------------------------------------------------------------

const createPortalSession = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ url: string | null; error?: string }> => {
    const user = await getCurrentUser();
    if (!user || !user.stripeCustomerId) {
      return { url: null, error: "No subscription found." };
    }

    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${process.env.APP_URL || "https://job-margin.com"}/pricing`,
      });
      return { url: session.url };
    } catch {
      return { url: null, error: "Could not open subscription management. Please try again." };
    }
  },
);

const searchValidator = (search: Record<string, unknown>) => ({
  success: typeof search.success === "string" ? search.success : undefined,
  canceled: typeof search.canceled === "string" ? search.canceled : undefined,
  trial_expired:
    typeof search.trial_expired === "string" ? search.trial_expired : undefined,
});

export const Route = createFileRoute("/pricing")({
  validateSearch: searchValidator,
  loader: async () => {
    const user = await getCurrentUser();
    let trialDaysRemaining = 7;
    if (user && user.trialStartedAt) {
      const trialEnd = new Date(user.trialStartedAt).getTime() + TRIAL_DURATION_MS;
      trialDaysRemaining = Math.max(
        0,
        Math.ceil((trialEnd - Date.now()) / (24 * 60 * 60 * 1000)),
      );
    }
    return { user, trialDaysRemaining };
  },
  component: PricingPage,
});

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function PricingPage() {
  const { user, trialDaysRemaining } = Route.useLoaderData();
  const search = Route.useSearch();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = async () => {
    setLoading(true);
    setError(null);
    const res = await createCheckoutSession();
    if (res.url) {
      window.location.href = res.url;
    } else {
      setError(res.error || "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const handleManage = async () => {
    setLoading(true);
    setError(null);
    const res = await createPortalSession();
    if (res.url) {
      window.location.href = res.url;
    } else {
      setError(res.error || "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const needsAttention = user
    ? (SUBSCRIPTION_ATTENTION_STATUSES as readonly string[]).includes(
        user.subscriptionStatus,
      )
    : false;

  return (
    <div className="bg-white text-gray-900">
      {/* Hero */}
      <section className="bg-slate-950 px-4 pb-12 pt-8 text-white sm:pb-16 sm:pt-10">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 flex items-center justify-between">
            <Link to="/" className="text-lg font-bold tracking-tight">
              Job<span className="text-blue-400">Margin</span>
            </Link>
            {user ? (
              <span className="text-sm font-medium text-slate-300">
                {user.name}
              </span>
            ) : (
              <Link
                to="/login"
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white"
              >
                Log in
              </Link>
            )}
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Start Your 7-Day Free Trial
          </h1>
          <p className="mt-3 text-lg text-slate-300">
            Full access. No limits. Cancel anytime.
          </p>
        </div>
      </section>

      {/* Query-param banners */}
      {search.success && (
        <Banner tone="green" message="You're subscribed — thank you! Your Pro account is active." />
      )}
      {search.canceled && (
        <Banner tone="gray" message="Checkout canceled — no changes were made. You can subscribe any time." />
      )}
      {search.trial_expired && (
        <Banner tone="amber" message="Your free trial has ended. Subscribe to keep using JobMargin." />
      )}

      {/* Plan card */}
      <section className="mx-auto max-w-lg px-4 py-10">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-bold text-gray-900">Pro</h2>
            <div className="text-right">
              <span className="text-3xl font-bold tracking-tight text-gray-900">
                $15
              </span>
              <span className="text-sm text-gray-500">/month</span>
            </div>
          </div>
          <ul className="mt-5 space-y-3 text-sm text-gray-700">
            <Feature text="Unlimited clients & estimates" />
            <Feature text="Job cost tracking" />
            <Feature text="Invoicing with Stripe payments" />
            <Feature text="Live profit/loss dashboard" />
          </ul>

          <div className="mt-7">{renderCta()}</div>

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          <p className="mt-5 text-center text-xs text-gray-400">
            7-day free trial, then $15/month. Cancel anytime.
          </p>
        </div>
      </section>

      {/* Signup nudge for visitors */}
      {!user && (
        <section className="pb-14 text-center">
          <p className="text-sm text-gray-500">
            New to JobMargin? Create a free account and start your trial today.
          </p>
        </section>
      )}
    </div>
  );

  function renderCta() {
    if (!user) {
      return (
        <Link
          to="/signup"
          className="flex min-h-[52px] w-full items-center justify-center rounded-xl bg-blue-600 px-6 text-base font-semibold text-white shadow-sm hover:bg-blue-500 active:bg-blue-700 transition-colors"
        >
          Start Free Trial
        </Link>
      );
    }

    if (user.subscriptionStatus === "active") {
      return (
        <div className="space-y-3">
          <div className="rounded-xl bg-green-50 px-4 py-4 text-center">
            <p className="text-sm font-semibold text-green-800">
              You're subscribed — thank you!
            </p>
          </div>
          <button
            type="button"
            onClick={handleManage}
            disabled={loading}
            className="flex min-h-[48px] w-full items-center justify-center rounded-xl border border-gray-300 bg-white px-6 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          >
            {loading ? "Opening..." : "Manage Subscription"}
          </button>
        </div>
      );
    }

    if (needsAttention) {
      return (
        <div className="space-y-3">
          <div className="rounded-xl bg-amber-50 px-4 py-3 text-center">
            <p className="text-sm font-semibold text-amber-800">
              Your subscription needs attention
            </p>
            <p className="mt-1 text-xs text-amber-700">
              Re-subscribe to keep full access to JobMargin.
            </p>
          </div>
          <SubscribeButton />
        </div>
      );
    }

    // Trialing (or any other state) — show remaining days + subscribe
    return (
      <div className="space-y-3">
        <p className="text-center text-sm text-gray-600">
          <span className="font-semibold text-gray-900">
            {trialDaysRemaining > 1
              ? `${trialDaysRemaining} days remaining`
              : trialDaysRemaining === 1
                ? "1 day remaining"
                : "Your trial ends today"}
          </span>{" "}
          in your trial
        </p>
        <SubscribeButton />
      </div>
    );
  }

  function SubscribeButton() {
    return (
      <button
        type="button"
        onClick={handleSubscribe}
        disabled={loading}
        className="flex min-h-[52px] w-full items-center justify-center rounded-xl bg-indigo-600 px-6 text-base font-semibold text-white shadow-sm hover:bg-indigo-500 active:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
      >
        {loading ? "Starting checkout..." : "Subscribe Now"}
      </button>
    );
  }
}

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------

function Feature({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <svg
        className="mt-0.5 h-4 w-4 shrink-0 text-green-600"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
      <span>{text}</span>
    </li>
  );
}

function Banner({
  tone,
  message,
}: {
  tone: "green" | "amber" | "gray";
  message: string;
}) {
  const styles = {
    green: "bg-green-50 text-green-800 border-green-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    gray: "bg-gray-50 text-gray-700 border-gray-200",
  }[tone];
  return (
    <div className="mx-auto max-w-lg px-4 pt-6">
      <div
        className={`rounded-xl border px-4 py-3 text-sm font-medium ${styles}`}
      >
        {message}
      </div>
    </div>
  );
}
