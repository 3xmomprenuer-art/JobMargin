import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactNode } from "react";
import { sql } from "~/db";
import { getCurrentUser } from "~/lib/auth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DashboardStats {
  activeJobs: number;
  overBudget: number;
  monthlyProfit: number;
}

interface ActiveJob {
  id: string;
  job_number: string;
  status: string;
  estimated_total: number | null;
  actual_materials_cost: number;
  actual_labor_cost: number;
  actual_total: number;
  client_name: string;
  created_at: string;
}

interface ActivityEvent {
  id: string;
  type: "job_completed" | "material_added" | "time_logged" | "estimate_accepted" | "job_created";
  description: string;
  timestamp: string;
}

interface DashboardData {
  stats: DashboardStats;
  activeJobs: ActiveJob[];
  activity: ActivityEvent[];
}

// ---------------------------------------------------------------------------
// Server function
// ---------------------------------------------------------------------------

const getDashboardData = createServerFn({ method: "GET" }).handler(async () => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  const userId = user.id;
  try {
    // 1. Stats
    const statsRows = await sql`
      WITH monthly_jobs AS (
        SELECT
          j.id,
          j.status,
          j.estimated_total,
          COALESCE(
            (SELECT SUM(cost) FROM job_materials WHERE job_id = j.id), 0
          ) AS materials_sum,
          COALESCE(
            (SELECT SUM(total_cost) FROM job_time_entries WHERE job_id = j.id), 0
          ) AS labor_sum
        FROM jobs j
        WHERE j.user_id = ${userId}
          AND j.created_at >= date_trunc('month', CURRENT_DATE)
      ),
      completed_month AS (
        SELECT
          j.estimated_total,
          COALESCE(
            (SELECT SUM(cost) FROM job_materials WHERE job_id = j.id), 0
          ) AS materials_sum,
          COALESCE(
            (SELECT SUM(total_cost) FROM job_time_entries WHERE job_id = j.id), 0
          ) AS labor_sum
        FROM jobs j
        WHERE j.user_id = ${userId}
          AND j.status = 'complete'
          AND j.updated_at >= date_trunc('month', CURRENT_DATE)
          AND j.updated_at < date_trunc('month', CURRENT_DATE) + interval '1 month'
      )
      SELECT
        (SELECT COUNT(*) FROM monthly_jobs WHERE status IN ('not_started', 'in_progress')) AS active_jobs,
        (SELECT COUNT(*) FROM monthly_jobs WHERE estimated_total IS NOT NULL AND (materials_sum + labor_sum) > estimated_total) AS over_budget,
        COALESCE(
          (SELECT SUM(COALESCE(estimated_total, 0) - (materials_sum + labor_sum)) FROM completed_month),
          0
        ) + COALESCE(
          (SELECT SUM(COALESCE(estimated_total, 0) - (materials_sum + labor_sum)) FROM monthly_jobs WHERE status = 'in_progress'),
          0
        ) AS monthly_profit
    `;

    const stats: DashboardStats = {
      activeJobs: Number(statsRows[0].active_jobs),
      overBudget: Number(statsRows[0].over_budget),
      monthlyProfit: Number(statsRows[0].monthly_profit),
    };

    // 2. Active jobs (most recent 5)
    const jobRows = await sql`
      SELECT
        j.id,
        j.job_number,
        j.status,
        j.estimated_total,
        j.created_at,
        c.name AS client_name,
        COALESCE(
          (SELECT SUM(cost) FROM job_materials WHERE job_id = j.id), 0
        ) AS materials_sum,
        COALESCE(
          (SELECT SUM(total_cost) FROM job_time_entries WHERE job_id = j.id), 0
        ) AS labor_sum
      FROM jobs j
      JOIN clients c ON j.client_id = c.id
      WHERE j.user_id = ${userId}
        AND j.status IN ('not_started', 'in_progress')
      ORDER BY j.created_at DESC
      LIMIT 5
    `;

    const activeJobs: ActiveJob[] = jobRows.map((r) => ({
      id: String(r.id),
      job_number: String(r.job_number),
      status: String(r.status),
      estimated_total: r.estimated_total ? Number(r.estimated_total) : null,
      actual_materials_cost: Number(r.materials_sum),
      actual_labor_cost: Number(r.labor_sum),
      actual_total: Number(r.materials_sum) + Number(r.labor_sum),
      client_name: String(r.client_name),
      created_at: String(r.created_at),
    }));

    // 3. Recent activity (union of multiple sources, 10 most recent)
    const activityRows = await sql`
      SELECT * FROM (
        -- Jobs completed
        SELECT
          j.id::text,
          'job_completed'::text AS type,
          ('Job ' || j.job_number || ' marked complete')::text AS description,
          j.updated_at AS event_time
        FROM jobs j
        WHERE j.user_id = ${userId}
          AND j.status = 'complete'

        UNION ALL

        -- Jobs created
        SELECT
          j.id::text,
          'job_created'::text AS type,
          ('Job ' || j.job_number || ' created')::text AS description,
          j.created_at AS event_time
        FROM jobs j
        WHERE j.user_id = ${userId}

        UNION ALL

        -- Materials added
        SELECT
          jm.id::text,
          'material_added'::text AS type,
          ('Material "' || jm.description || '" added to ' || j.job_number)::text AS description,
          jm.purchased_at AS event_time
        FROM job_materials jm
        JOIN jobs j ON jm.job_id = j.id
        WHERE j.user_id = ${userId}

        UNION ALL

        -- Time logged
        SELECT
          jte.id::text,
          'time_logged'::text AS type,
          (jte.hours::text || ' hrs logged on ' || j.job_number)::text AS description,
          jte.logged_at AS event_time
        FROM job_time_entries jte
        JOIN jobs j ON jte.job_id = j.id
        WHERE j.user_id = ${userId}

        UNION ALL

        -- Estimates accepted
        SELECT
          e.id::text,
          'estimate_accepted'::text AS type,
          ('Estimate ' || e.estimate_number || ' accepted')::text AS description,
          e.updated_at AS event_time
        FROM estimates e
        WHERE e.user_id = ${userId}
          AND e.status = 'accepted'
      ) AS events
      ORDER BY event_time DESC
      LIMIT 10
    `;

    const activity: ActivityEvent[] = activityRows.map((r) => ({
      id: String(r.id),
      type: r.type as ActivityEvent["type"],
      description: String(r.description),
      timestamp: String(r.event_time),
    }));

    return { stats, activeJobs, activity } as DashboardData;
  } catch {
    return {
      stats: { activeJobs: 0, overBudget: 0, monthlyProfit: 0 },
      activeJobs: [],
      activity: [],
    } as DashboardData;
  }
});

export const Route = createFileRoute("/")({
  loader: async () => {
    const user = await getCurrentUser();
    if (!user) return { user: null, dashboard: null };
    return { user, dashboard: await getDashboardData() };
  },
  component: HomePage,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCurrencyCompact(n: number): string {
  if (n >= 1000) {
    return `$${(n / 1000).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}k`;
  }
  return formatCurrency(n);
}

function timeAgo(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function activityIcon(type: ActivityEvent["type"]) {
  switch (type) {
    case "job_completed":
      return (
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
          <svg className="h-4 w-4 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
      );
    case "material_added":
      return (
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100">
          <svg className="h-4 w-4 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <rect x="2" y="2" width="20" height="20" rx="3" />
            <line x1="8" y1="12" x2="16" y2="12" />
            <line x1="12" y1="8" x2="12" y2="16" />
          </svg>
        </span>
      );
    case "time_logged":
      return (
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
          <svg className="h-4 w-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </span>
      );
    case "estimate_accepted":
      return (
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100">
          <svg className="h-4 w-4 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </span>
      );
    case "job_created":
      return (
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100">
          <svg className="h-4 w-4 text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
          </svg>
        </span>
      );
  }
}

// ---------------------------------------------------------------------------
// Page components
// ---------------------------------------------------------------------------

function HomePage() {
  const { user, dashboard } = Route.useLoaderData();
  if (!user || !dashboard) return <LandingPage />;
  return <Dashboard data={dashboard} />;
}

function LandingPage() {
  return (
    <div className="bg-white text-gray-900">
      <section className="relative overflow-hidden bg-slate-950 px-4 pb-16 pt-10 text-white sm:pb-24 sm:pt-16">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-600/20 blur-3xl" />
        <div className="relative mx-auto max-w-5xl">
          <div className="mb-14 flex items-center justify-between">
            <Link to="/" className="text-lg font-bold tracking-tight">Job<span className="text-blue-400">Margin</span></Link>
            <div className="flex items-center gap-1">
              <Link to="/blog" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white">Blog</Link>
              <Link to="/profit-calculator" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white">Calculator</Link>
              <Link to="/pricing" search={{ success: undefined, canceled: undefined, trial_expired: undefined }} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white">Pricing</Link>
              <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white">Log in</Link>
              <Link to="/contact" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white">Contact</Link>
            </div>
          </div>
          <div className="max-w-3xl">
            <p className="mb-5 text-sm font-semibold uppercase tracking-[0.18em] text-blue-300">Profit clarity for every job</p>
            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-6xl">Know Exactly How Much Every Job Makes You</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">The mobile-first tool for contractors who want to stop guessing and start knowing their real profit on every job.</p>
            <div className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <div className="flex flex-col items-start gap-2">
                <Link to="/signup" className="inline-flex min-h-[52px] items-center justify-center rounded-xl bg-blue-500 px-7 text-base font-semibold text-white shadow-lg shadow-blue-950/40 transition hover:bg-blue-400">Start Free Trial</Link>
                <p className="text-xs text-slate-400">7 days free, then $15/month</p>
              </div>
              <Link to="/login" className="text-sm font-medium text-slate-300 underline-offset-4 hover:text-white hover:underline">Already have an account? Log in</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
        <div className="mb-10 max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">Everything in one place</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Run the job. Know the numbers.</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          <FeatureCard number="01" title="Create Estimates in Minutes" description="Build professional estimates with line items, labor, materials, and markup. Share with clients via a link." />
          <FeatureCard number="02" title="Track Real Costs" description="Log materials and time as you work. See your profit/loss update live — no more end-of-month surprises." />
          <FeatureCard number="03" title="Get Paid Faster" description="Generate invoices with Stripe payment links. Clients pay with one click." />
        </div>
      </section>

      <HowItWorks />

      <section className="border-y border-slate-200 bg-slate-50 px-4 py-14 text-center sm:py-20">
        <div className="mx-auto max-w-2xl">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
            <span className="text-xl font-bold">$</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Built for solo contractors</h2>
          <p className="mt-4 text-base leading-7 text-slate-600">Plumbers, electricians, landscapers, handymen, and more. JobMargin keeps the important numbers close at hand, whether you’re on a job site or back at the shop.</p>
        </div>
      </section>
      <section className="px-4 py-14 text-center"><h2 className="text-2xl font-bold text-slate-900">Stop guessing. Start knowing.</h2><Link to="/signup" className="mt-6 inline-flex min-h-[52px] items-center rounded-xl bg-indigo-600 px-7 font-semibold text-white hover:bg-indigo-500">Start Free Trial</Link><p className="mt-3 text-xs text-gray-400">7 days free, then $15/month</p></section>
    </div>
  );
}

function FeatureCard({ number, title, description }: { number: string; title: string; description: string }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><span className="text-sm font-bold text-blue-600">{number}</span><h3 className="mt-5 text-lg font-bold text-slate-900">{title}</h3><p className="mt-3 text-sm leading-6 text-slate-600">{description}</p></article>;
}

// ---------------------------------------------------------------------------
// How It Works (landing page)
// ---------------------------------------------------------------------------

function HowItWorks() {
  const steps: { number: string; title: string; description: string; phone: ReactNode }[] = [
    {
      number: "01",
      title: "Create an Estimate",
      description:
        "Build professional estimates with line items for labor, materials, and markup. Share with clients via a link.",
      phone: <EstimatePhone />,
    },
    {
      number: "02",
      title: "Track Real Costs",
      description: "Log materials and time as you work. Watch your profit update in real time.",
      phone: <CostsPhone />,
    },
    {
      number: "03",
      title: "Invoice & Get Paid",
      description:
        "Generate invoices with Stripe payment links. Clients pay with one click from any device.",
      phone: <InvoicePhone />,
    },
    {
      number: "04",
      title: "Know Your Profit",
      description:
        "JobMargin answers the one question every contractor asks: Did I actually make what I thought I would?",
      phone: <ProfitPhone />,
    },
  ];

  return (
    <section className="border-t border-slate-200 bg-slate-50 px-4 py-16 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto mb-12 max-w-2xl text-center sm:mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">See How It Works</h2>
          <p className="mt-3 text-base leading-7 text-slate-600">
            From estimate to payment in four steps — all from your phone.
          </p>
        </div>
        <div className="space-y-6 sm:space-y-10">
          {steps.map((step, i) => (
            <HowItWorksStep
              key={step.number}
              number={step.number}
              title={step.title}
              description={step.description}
              reversed={i % 2 === 1}
            >
              {step.phone}
            </HowItWorksStep>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorksStep({
  number,
  title,
  description,
  reversed,
  children,
}: {
  number: string;
  title: string;
  description: string;
  reversed: boolean;
  children: ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-col items-center gap-7 md:grid md:grid-cols-2 md:items-center md:gap-12">
        <div className={reversed ? "md:order-2" : "md:order-1"}>{children}</div>
        <div
          className={`flex flex-col items-center text-center md:items-start md:text-left ${
            reversed ? "md:order-1" : "md:order-2"
          }`}
        >
          <span className="text-sm font-bold text-blue-600">{number}</span>
          <h3 className="mt-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h3>
          <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">{description}</p>
        </div>
      </div>
    </article>
  );
}

function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="w-60 max-w-full overflow-hidden rounded-3xl border-8 border-gray-800 bg-slate-950 shadow-2xl shadow-slate-900/25">
      {children}
    </div>
  );
}

function ScreenHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between bg-slate-950 px-3 py-2">
      <p className="text-[11px] font-semibold tracking-wide text-white">{title}</p>
      {right}
    </div>
  );
}

function ScreenLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-0.5 text-[8px] font-semibold uppercase tracking-wider text-gray-500">{children}</p>
  );
}

function ScreenInput({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div
      className={`flex h-5 items-center rounded-md border border-gray-200 bg-white px-1.5 text-[10px] text-gray-800 ${
        wide ? "col-span-2" : ""
      }`}
    >
      {children}
    </div>
  );
}

function EstimatePhone() {
  return (
    <PhoneFrame>
      <ScreenHeader title="New Estimate" />
      <div className="space-y-2 bg-slate-100 p-2.5">
        <div>
          <ScreenLabel>Client Name</ScreenLabel>
          <ScreenInput>John Homeowner</ScreenInput>
        </div>
        <div>
          <ScreenLabel>Line Item</ScreenLabel>
          <div className="grid grid-cols-4 gap-1">
            <ScreenInput wide>Supply line</ScreenInput>
            <div className="flex h-5 items-center justify-center rounded-md border border-gray-200 bg-white text-[10px] text-gray-800">2</div>
            <div className="flex h-5 items-center justify-center rounded-md border border-gray-200 bg-white text-[10px] text-gray-800">$185</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <ScreenLabel>Labor Hours</ScreenLabel>
            <ScreenInput>8 hrs</ScreenInput>
          </div>
          <div>
            <ScreenLabel>Materials</ScreenLabel>
            <ScreenInput>$850</ScreenInput>
          </div>
        </div>
        <div className="flex items-center justify-between pt-0.5">
          <span className="text-[10px] font-medium text-gray-500">Total</span>
          <span className="text-[13px] font-bold text-slate-900">$2,450</span>
        </div>
        <div className="flex h-6 items-center justify-center gap-1 rounded-md bg-blue-500 text-[10px] font-semibold text-white">
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Save Estimate
        </div>
      </div>
    </PhoneFrame>
  );
}

function CostsPhone() {
  return (
    <PhoneFrame>
      <ScreenHeader
        title="JOB-001"
        right={
          <span className="rounded-full bg-blue-500/20 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-blue-300">
            In Progress
          </span>
        }
      />
      <div className="space-y-2.5 bg-slate-100 p-2.5">
        <div>
          <ScreenLabel>Materials</ScreenLabel>
          <div className="space-y-1">
            <div className="flex items-center justify-between rounded-md bg-white px-2 py-1">
              <span className="text-[10px] text-gray-700">PVC Pipe</span>
              <span className="text-[10px] font-semibold text-slate-900">$42.50</span>
            </div>
            <div className="flex items-center justify-between rounded-md bg-white px-2 py-1">
              <span className="text-[10px] text-gray-700">Fittings</span>
              <span className="text-[10px] font-semibold text-slate-900">$18.75</span>
            </div>
          </div>
        </div>
        <div>
          <ScreenLabel>Time</ScreenLabel>
          <div className="flex items-center justify-between rounded-md bg-white px-2 py-1">
            <span className="flex items-center gap-1 text-[10px] text-gray-700">
              <svg className="h-2.5 w-2.5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              2.5 hrs @ $75/hr
            </span>
            <span className="text-[10px] font-semibold text-slate-900">$187.50</span>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-md bg-slate-900 px-2 py-1.5">
          <span className="text-[9px] font-medium text-slate-300">Actual Costs</span>
          <span className="text-[12px] font-bold text-white">$248.75</span>
        </div>
      </div>
    </PhoneFrame>
  );
}

function InvoicePhone() {
  return (
    <PhoneFrame>
      <ScreenHeader
        title="Invoice INV-001"
        right={
          <span className="rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-amber-300">
            Unpaid
          </span>
        }
      />
      <div className="space-y-2 bg-slate-100 p-2.5">
        <div className="rounded-md bg-white p-2 text-center">
          <ScreenLabel>Amount Due</ScreenLabel>
          <p className="mt-0.5 text-[16px] font-bold tracking-tight text-slate-900">$2,450.00</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-md bg-white px-2 py-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[8px] font-bold text-blue-700">JH</span>
          <div>
            <p className="text-[8px] text-gray-500">Client</p>
            <p className="text-[10px] font-semibold text-slate-900">John Homeowner</p>
          </div>
        </div>
        <div className="flex h-7 items-center justify-center gap-1 rounded-md bg-blue-500 text-[11px] font-semibold text-white">
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <rect x="1" y="4" width="22" height="16" rx="2" />
            <line x1="1" y1="10" x2="23" y2="10" />
          </svg>
          Pay Now
        </div>
      </div>
    </PhoneFrame>
  );
}

function ProfitPhone() {
  return (
    <PhoneFrame>
      <ScreenHeader title="Dashboard" />
      <div className="space-y-2 bg-slate-100 p-2.5">
        <div className="grid grid-cols-3 gap-1">
          <div className="rounded-md bg-white p-1 text-center">
            <p className="text-[11px] font-bold text-slate-900">3</p>
            <p className="text-[7px] leading-tight text-gray-500">Active</p>
          </div>
          <div className="rounded-md bg-white p-1 text-center">
            <p className="text-[10px] font-bold text-green-600">$1,240</p>
            <p className="text-[7px] leading-tight text-gray-500">Est. Profit</p>
          </div>
          <div className="rounded-md bg-white p-1 text-center">
            <p className="text-[11px] font-bold text-red-500">1</p>
            <p className="text-[7px] leading-tight text-gray-500">Over Budget</p>
          </div>
        </div>
        <div className="rounded-md bg-white p-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold text-slate-900">JOB-001</p>
              <p className="text-[8px] text-gray-500">John Homeowner</p>
            </div>
            <span className="text-[10px] font-bold text-green-600">+$380</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[8px] text-gray-500">
            <span>Est. $2,450</span>
            <span>Costs $2,070</span>
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-gray-200">
            <div className="h-full w-[85%] rounded-full bg-blue-500" />
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}

function Dashboard({ data }: { data: DashboardData }) {
  const { stats, activeJobs, activity } = data;

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {stats.activeJobs > 0
            ? `${stats.activeJobs} active job${stats.activeJobs !== 1 ? "s" : ""}`
            : "Welcome to JobMargin"}
        </p>
      </div>

      {/* Stats cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          label="Active Jobs"
          value={String(stats.activeJobs)}
          color="blue"
        />
        <StatCard
          label="Over Budget"
          value={String(stats.overBudget)}
          color={stats.overBudget > 0 ? "red" : "green"}
        />
        <StatCard
          label="Month Profit (Est.)"
          value={formatCurrencyCompact(stats.monthlyProfit)}
          color={stats.monthlyProfit >= 0 ? "green" : "red"}
          spanFull
        />
      </div>

      {/* Quick actions */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <Link
          to="/estimates/new"
          className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 active:bg-indigo-700 transition-colors"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Estimate
        </Link>
        <Link
          to="/clients/new"
          className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl border-2 border-indigo-600 px-4 py-3 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 active:bg-indigo-100 transition-colors"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            <line x1="18" y1="19" x2="18" y2="23" />
            <line x1="16" y1="21" x2="20" y2="21" />
          </svg>
          Add Client
        </Link>
      </div>

      {/* Active jobs section */}
      {activeJobs.length > 0 && (
        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">
              Active Jobs
            </h2>
            <Link
              to="/jobs"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              View all
            </Link>
          </div>
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100 bg-white">
            {activeJobs.map((job) => (
              <ActiveJobItem key={job.id} job={job} />
            ))}
          </ul>
        </section>
      )}

      {/* Recent activity section */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-gray-900">
          Recent Activity
        </h2>
        {activity.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center">
            <p className="text-sm text-gray-500">No recent activity</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100 bg-white">
            {activity.map((event) => (
              <li
                key={event.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                {activityIcon(event.type)}
                <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                  <p className="text-sm text-gray-900 truncate">
                    {event.description}
                  </p>
                  <p className="text-xs text-gray-500">
                    {timeAgo(event.timestamp)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  color,
  spanFull = false,
}: {
  label: string;
  value: string;
  color: "blue" | "green" | "red";
  spanFull?: boolean;
}) {
  const bgColor = {
    blue: "bg-blue-50 border-blue-100",
    green: "bg-green-50 border-green-100",
    red: "bg-red-50 border-red-100",
  }[color];

  const textColor = {
    blue: "text-blue-700",
    green: "text-green-700",
    red: "text-red-700",
  }[color];

  const labelColor = {
    blue: "text-blue-600",
    green: "text-green-600",
    red: "text-red-600",
  }[color];

  return (
    <div
      className={`rounded-xl border px-4 py-3 ${bgColor} ${
        spanFull ? "col-span-2 sm:col-span-1" : ""
      }`}
    >
      <p className={`text-2xl font-bold tracking-tight ${textColor}`}>
        {value}
      </p>
      <p className={`text-xs font-medium ${labelColor}`}>{label}</p>
    </div>
  );
}

function ActiveJobItem({ job }: { job: ActiveJob }) {
  const estimated = job.estimated_total;
  const actual = job.actual_total;
  const diff = estimated !== null ? estimated - actual : -actual;
  const isProfitable = diff >= 0;

  return (
    <li>
      <Link
        to="/jobs/$jobId"
        params={{ jobId: job.id }}
        className="flex min-h-[56px] items-center justify-between gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors"
      >
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-sm font-semibold text-gray-900">
            {job.job_number}
          </span>
          <span className="text-xs text-gray-500 truncate">
            {job.client_name}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex flex-col items-end gap-0.5">
            {actual > 0 && estimated !== null && (
              <span
                className={`text-xs font-semibold ${
                  isProfitable ? "text-green-600" : "text-red-600"
                }`}
              >
                {isProfitable ? "+" : "−"}
                {formatCurrency(Math.abs(diff))}
              </span>
            )}
          </div>
          <StatusBadge status={job.status} />
        </div>
      </Link>
    </li>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    not_started: "bg-gray-100 text-gray-700",
    in_progress: "bg-blue-100 text-blue-800",
    complete: "bg-green-100 text-green-800",
  };
  const color = colors[status] || "bg-gray-100 text-gray-800";
  const label =
    status === "not_started"
      ? "Not Started"
      : status === "in_progress"
        ? "In Progress"
        : "Complete";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${color}`}
    >
      {label}
    </span>
  );
}
