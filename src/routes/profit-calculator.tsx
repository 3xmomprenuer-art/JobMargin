import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/profit-calculator")({
  head: () => ({
    meta: [
      { title: "Free Contractor Profit Calculator | JobMargin" },
      {
        name: "description",
        content:
          "Calculate your real profit on any job. Include materials, labor, subs, overhead, and hidden costs to see what you actually made.",
      },
    ],
  }),
  component: ProfitCalculatorPage,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toNum(v: string): number {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtMoney(n: number): string {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? "-" : "";
  return `${sign}$${Math.abs(rounded).toLocaleString("en-US")}`;
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// Input state
// ---------------------------------------------------------------------------

interface CalcInputs {
  quoted: string;
  materials: string;
  hours: string;
  rate: string;
  subs: string;
  travel: string;
  disposal: string;
  overhead: string;
  fee: string;
}

const INITIAL_INPUTS: CalcInputs = {
  quoted: "",
  materials: "",
  hours: "",
  rate: "",
  subs: "",
  travel: "",
  disposal: "",
  overhead: "10",
  fee: "2.9",
};

type VerdictTone = "neutral" | "green" | "yellow" | "red";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function ProfitCalculatorPage() {
  const [values, setValues] = useState<CalcInputs>(INITIAL_INPUTS);

  const set =
    (key: keyof CalcInputs) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setValues((v) => ({ ...v, [key]: e.target.value }));

  // --- calculations -------------------------------------------------------
  const quoted = toNum(values.quoted);
  const laborCost = toNum(values.hours) * toNum(values.rate);
  const directCosts =
    toNum(values.materials) +
    laborCost +
    toNum(values.subs) +
    toNum(values.travel) +
    toNum(values.disposal);
  const overhead = (toNum(values.overhead) / 100) * quoted;
  const fee = (toNum(values.fee) / 100) * quoted;
  const totalCosts = directCosts + overhead + fee;
  const grossProfit = quoted - totalCosts;
  const margin = quoted > 0 ? (grossProfit / quoted) * 100 : null;

  // --- verdict -------------------------------------------------------------
  let tone: VerdictTone = "neutral";
  let verdictTitle = "Enter your numbers to see the verdict";
  let verdictBody =
    "Fill in the quoted price and your costs — the verdict updates as you type.";

  if (quoted > 0) {
    if (margin! >= 15) {
      tone = "green";
      verdictTitle = `You're making ${fmtPct(margin!)} margin on this job`;
      verdictBody = "Healthy margin. Quote more jobs like this one.";
    } else if (margin! >= 5) {
      tone = "yellow";
      verdictTitle = `Thin margin — ${fmtPct(margin!)} on this job`;
      verdictBody = `You'd keep ${fmtMoney(grossProfit)}, but one surprise cost could wipe it out.`;
    } else if (margin! >= 0) {
      tone = "red";
      verdictTitle = `Barely breaking even (${fmtPct(margin!)})`;
      verdictBody = `You'd keep only ${fmtMoney(grossProfit)} after every cost.`;
    } else {
      tone = "red";
      verdictTitle = `This job is underwater — you'd lose ${fmtMoney(-grossProfit)}`;
      verdictBody =
        "Your costs run past the quote. Raise your price or cut costs before you take the job.";
    }
  }

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <header className="bg-slate-950 text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-6 sm:px-6">
          <Link to="/" className="text-lg font-bold tracking-tight">
            Job<span className="text-blue-400">Margin</span>
          </Link>
          <nav className="flex items-center gap-1">
            <Link
              to="/blog/"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              Blog
            </Link>
            <Link
              to="/pricing"
              search={{ success: undefined, canceled: undefined, trial_expired: undefined }}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              Pricing
            </Link>
            <Link
              to="/login"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              Log in
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-24 pt-10 sm:px-6 sm:pt-14">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
            Free tool
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Contractor Profit Calculator
          </h1>
          <p className="mt-4 text-lg leading-7 text-slate-600">
            See what a job actually makes before you take it. Add your quote
            and costs — the numbers update as you type.
          </p>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-5 lg:items-start">
          {/* ------------------------------- Inputs ------------------------ */}
          <form
            className="lg:col-span-3"
            aria-label="Job numbers"
            onSubmit={(e) => e.preventDefault()}
          >
            <div className="space-y-6">
              <MoneyField
                id="quoted"
                label="Quoted Price"
                value={values.quoted}
                onChange={set("quoted")}
                helper="The amount you bid or quoted the customer for this job."
              />

              <MoneyField
                id="materials"
                label="Material Costs"
                value={values.materials}
                onChange={set("materials")}
                helper="All parts, supplies, and materials you bought for this job."
              />

              <fieldset>
                <legend className="text-sm font-semibold text-slate-700">
                  Labor
                </legend>
                <div className="mt-1.5 grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="hours"
                      className="mb-1.5 block text-xs font-medium text-slate-500"
                    >
                      Hours worked
                    </label>
                    <input
                      id="hours"
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value={values.hours}
                      onChange={set("hours")}
                      placeholder="0"
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-lg font-medium text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="rate"
                      className="mb-1.5 block text-xs font-medium text-slate-500"
                    >
                      Hourly rate ($/hr)
                    </label>
                    <input
                      id="rate"
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value={values.rate}
                      onChange={set("rate")}
                      placeholder="0"
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-lg font-medium text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                </div>
                <p className="mt-1.5 text-sm leading-5 text-slate-500">
                  {laborCost > 0 ? (
                    <>
                      Your labor cost:{" "}
                      <span className="font-semibold text-slate-700">
                        {fmtMoney(laborCost)}
                      </span>
                    </>
                  ) : (
                    "Hours × your hourly rate. Include prep and cleanup time."
                  )}
                </p>
              </fieldset>

              <MoneyField
                id="subs"
                label="Subcontractor Costs"
                value={values.subs}
                onChange={set("subs")}
                helper="Anything you paid subs, helpers, or day labor."
              />

              <MoneyField
                id="travel"
                label="Travel / Fuel"
                value={values.travel}
                onChange={set("travel")}
                helper="Trips to the site, supply runs, parking, and tolls."
              />

              <MoneyField
                id="disposal"
                label="Disposal / Dump Fees"
                value={values.disposal}
                onChange={set("disposal")}
                helper="Dump fees and waste removal for this job."
              />

              <PercentField
                id="overhead"
                label="Overhead %"
                value={values.overhead}
                onChange={set("overhead")}
                helper="Insurance, tools, truck, phone, licensing — as a % of the quoted price."
              />

              <PercentField
                id="fee"
                label="Payment Processing Fee %"
                value={values.fee}
                onChange={set("fee")}
                helper="What you pay on card payments — typically 2.9%."
              />
            </div>
          </form>

          {/* ------------------------------- Results ------------------------ */}
          <aside
            className="lg:col-span-2 lg:sticky lg:top-6"
            aria-label="Profit results"
          >
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div
                aria-live="polite"
                className={`border-b px-5 py-5 ${
                  tone === "neutral"
                    ? "border-slate-200 bg-slate-100 text-slate-700"
                    : tone === "green"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : tone === "yellow"
                        ? "border-amber-200 bg-amber-50 text-amber-800"
                        : "border-red-200 bg-red-50 text-red-800"
                }`}
              >
                <p className="text-lg font-bold leading-snug">{verdictTitle}</p>
                <p className="mt-1 text-sm leading-5">{verdictBody}</p>
              </div>
              <dl className="divide-y divide-slate-100 px-5">
                <StatRow label="Total Costs" value={fmtMoney(totalCosts)} />
                <StatRow
                  label="Gross Profit"
                  value={fmtMoney(grossProfit)}
                  toneValue={
                    grossProfit > 0
                      ? "text-emerald-600"
                      : grossProfit < 0
                        ? "text-red-600"
                        : undefined
                  }
                />
                <StatRow
                  label="Profit Margin"
                  value={margin === null ? "—" : fmtPct(margin)}
                />
                <StatRow
                  label="Break-even Price"
                  value={fmtMoney(totalCosts)}
                  hint="What you'd need to charge to not lose money"
                />
              </dl>
            </div>
            <p className="mt-3 px-2 text-xs leading-5 text-slate-400">
              Estimates only — actual costs vary by job. This is a planning
              tool, not accounting advice.
            </p>
          </aside>
        </div>

        {/* ------------------------------- Pitch ---------------------------- */}
        <section className="mt-16 rounded-2xl bg-slate-950 px-6 py-10 text-center text-white sm:px-10 sm:py-14">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            What if you could track this automatically on every job?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-300">
            JobMargin turns your estimates into live job trackers — log
            materials and hours as you spend them, and watch your real profit
            while the job is still in progress. No more guessing whether a job
            actually paid off.
          </p>
          <Link
            to="/signup"
            className="mt-8 inline-flex min-h-12 items-center justify-center rounded-xl bg-blue-500 px-8 py-3 text-base font-bold text-white shadow-lg transition-colors hover:bg-blue-400"
          >
            Try JobMargin Free <span aria-hidden="true" className="ml-2">→</span>
          </Link>
          <p className="mt-4 text-sm text-slate-400">
            7-day free trial, then $15/month
          </p>
          <p className="mt-5 text-sm text-slate-300">
            Prefer a spreadsheet? <Link to="/tools/estimate-vs-actual-spreadsheet" className="font-semibold text-blue-300 underline underline-offset-2 hover:text-blue-200">Download the free estimate vs. actual template</Link>.
          </p>
        </section>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Field components
// ---------------------------------------------------------------------------

function MoneyField({
  id,
  label,
  value,
  onChange,
  helper,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  helper: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-slate-700">
        {label}
      </label>
      <div className="relative mt-1.5">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-slate-400"
        >
          $
        </span>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={onChange}
          placeholder="0"
          className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-8 pr-4 text-lg font-medium text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
        />
      </div>
      <p className="mt-1.5 text-sm leading-5 text-slate-500">{helper}</p>
    </div>
  );
}

function PercentField({
  id,
  label,
  value,
  onChange,
  helper,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  helper: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-slate-700">
        {label}
      </label>
      <div className="relative mt-1.5">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={onChange}
          placeholder="0"
          className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-4 pr-9 text-lg font-medium text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-lg text-slate-400"
        >
          %
        </span>
      </div>
      <p className="mt-1.5 text-sm leading-5 text-slate-500">{helper}</p>
    </div>
  );
}

function StatRow({
  label,
  value,
  hint,
  toneValue,
}: {
  label: string;
  value: string;
  hint?: string;
  toneValue?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-4">
      <div>
        <dt className="text-sm font-medium text-slate-500">{label}</dt>
        {hint && <dd className="mt-0.5 text-xs text-slate-400">{hint}</dd>}
      </div>
      <dd
        className={`text-xl font-bold tabular-nums ${
          toneValue ?? "text-slate-900"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
