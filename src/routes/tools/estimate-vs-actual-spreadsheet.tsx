import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/tools/estimate-vs-actual-spreadsheet")({
  head: () => ({
    meta: [
      { title: "Free Estimate vs. Actual Job Cost Spreadsheet | JobMargin" },
      { name: "description", content: "Download our free template to track estimated costs against actual costs on every job. Catch over-budget work early." },
    ],
  }),
  component: SpreadsheetPage,
});

const columns = [
  "Job Name", "Date", "Estimated Quote", "Estimated Materials", "Estimated Labor Hours", "Estimated Labor Rate",
  "Actual Materials", "Actual Labor Hours", "Actual Labor Rate", "Estimated Subs", "Actual Subs",
  "Estimated Disposal/Travel", "Actual Disposal/Travel", "Profit (Estimated)", "Profit (Actual)", "Variance", "Notes",
];

function SpreadsheetPage() {
  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <header className="bg-slate-950 text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-6 sm:px-6">
          <Link to="/" className="text-lg font-bold tracking-tight">Job<span className="text-blue-400">Margin</span></Link>
          <nav className="flex items-center gap-1"><Link to="/blog/" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white">Blog</Link><Link to="/profit-calculator" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white">Calculator</Link><Link to="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white">Log in</Link></nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 pb-24 pt-12 sm:px-6 sm:pt-20">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">Free contractor tool</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">Estimate vs. Actual Job Cost Spreadsheet</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">Track what you thought a job would cost vs. what it actually cost. Catch hidden costs before they eat your profit.</p>
        <a href="/api/estimate-vs-actual-download" download className="mt-8 inline-flex min-h-14 w-full items-center justify-center rounded-xl bg-blue-600 px-6 py-4 text-lg font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 sm:w-auto">Download the free spreadsheet <span aria-hidden="true" className="ml-3">↓</span></a>
        <section className="mt-14 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-2xl font-bold tracking-tight">What&apos;s included</h2>
          <p className="mt-3 text-slate-600">One row per job, with the numbers you need to compare the plan with reality.</p>
          <ul className="mt-6 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
            {columns.map((column) => <li key={column} className="flex items-start gap-2"><span className="mt-0.5 text-blue-600">✓</span><span>{column}</span></li>)}
          </ul>
        </section>
        <section className="mt-8 rounded-2xl bg-slate-900 p-6 text-white sm:p-8">
          <h2 className="text-2xl font-bold tracking-tight">How to use it</h2>
          <p className="mt-4 leading-7 text-slate-300">Fill in estimates before the job, actuals during the job. The variance column shows you exactly where you&apos;re losing money.</p>
        </section>
        <section className="mt-12 text-center">
          <h2 className="text-2xl font-bold tracking-tight">Tired of updating spreadsheets?</h2>
          <p className="mx-auto mt-3 max-w-xl leading-7 text-slate-600">Want this to update automatically from your phone? <Link to="/signup" className="font-semibold text-blue-700 underline underline-offset-2">Try JobMargin free.</Link></p>
        </section>
      </main>
    </div>
  );
}
