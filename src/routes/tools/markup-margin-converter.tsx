import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/tools/markup-margin-converter")({
  head: () => ({
    meta: [
      { title: "Free Markup to Margin Converter for Contractors | JobMargin" },
      { name: "description", content: "Convert markup to margin instantly. See how much you're really making on every job with our free calculator." },
    ],
  }),
  component: MarkupMarginConverter,
});

function numberValue(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function pct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function money(value: number): string {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function MarginResult({ margin }: { margin: number }) {
  const tone = margin >= 20
    ? { box: "border-emerald-200 bg-emerald-50", label: "text-emerald-700", value: "text-emerald-800" }
    : margin >= 10
      ? { box: "border-amber-200 bg-amber-50", label: "text-amber-700", value: "text-amber-800" }
      : { box: "border-red-200 bg-red-50", label: "text-red-700", value: "text-red-800" };
  return <div className={`mt-6 rounded-2xl border p-5 ${tone.box}`}>
    <p className={`text-sm font-semibold ${tone.label}`}>Your real margin</p>
    <p className={`mt-1 text-5xl font-bold tracking-tight ${tone.value}`}>{pct(margin)}</p>
    <p className="mt-2 text-sm text-slate-600">That’s the profit left as a percentage of what you charge.</p>
  </div>;
}

function MarkupMarginConverter() {
  const [markupInput, setMarkupInput] = useState("20");
  const [marginInput, setMarginInput] = useState("20");
  const markup = numberValue(markupInput);
  const targetMargin = Math.min(numberValue(marginInput), 99.9);
  const realMargin = markup / (100 + markup) * 100;
  const requiredMarkup = targetMargin / (100 - targetMargin) * 100;
  const cost = 1000;
  const markupCharge = cost * (1 + markup / 100);
  const markupProfit = markupCharge - cost;
  const targetCharge = cost / (1 - targetMargin / 100);
  const targetProfit = targetCharge - cost;

  return <div className="min-h-dvh bg-slate-50 text-slate-900">
    <header className="bg-slate-950 text-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-6 sm:px-6">
        <Link to="/" className="text-lg font-bold tracking-tight">Job<span className="text-blue-400">Margin</span></Link>
        <nav className="flex items-center gap-1"><Link to="/blog/" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white">Blog</Link><Link to="/profit-calculator" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white">Calculator</Link><Link to="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white">Log in</Link></nav>
      </div>
    </header>
    <main className="mx-auto max-w-5xl px-4 pb-24 pt-10 sm:px-6 sm:pt-14">
      <div className="max-w-3xl"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">Free contractor tool</p><h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Markup ↔ Margin Converter</h1><p className="mt-4 text-lg leading-7 text-slate-600">Markup and margin are not the same number. Translate between them instantly so you can price jobs with confidence.</p></div>
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8" aria-labelledby="markup-heading">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Start with markup</p><h2 id="markup-heading" className="mt-2 text-2xl font-bold">I use X% markup → what’s my margin?</h2>
          <label htmlFor="markup" className="mt-7 block text-sm font-semibold text-slate-700">Markup percentage</label><div className="relative mt-2"><input id="markup" type="number" min="0" step="0.1" inputMode="decimal" value={markupInput} onChange={(e) => setMarkupInput(e.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-4 pr-12 text-2xl font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" /><span className="absolute right-4 top-4 text-2xl text-slate-400">%</span></div>
          <MarginResult margin={realMargin} />
          <div className="mt-5 rounded-xl bg-slate-100 p-4 text-sm leading-6 text-slate-600"><strong className="text-slate-800">The math:</strong> margin = markup ÷ (1 + markup). A {pct(markup)} markup becomes {pct(realMargin)} of your selling price.</div>
          <div className="mt-5 border-t border-slate-200 pt-5"><p className="text-sm font-semibold text-slate-800">On a $1,000 materials cost</p><p className="mt-2 text-sm leading-6 text-slate-600">{pct(markup)} markup = charge <strong className="text-slate-900">{money(markupCharge)}</strong> = <strong className="text-slate-900">{money(markupProfit)}</strong> profit = {pct(realMargin)} margin</p></div>
        </section>
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8" aria-labelledby="margin-heading">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Start with margin</p><h2 id="margin-heading" className="mt-2 text-2xl font-bold">I want Y% margin → what markup do I need?</h2>
          <label htmlFor="target-margin" className="mt-7 block text-sm font-semibold text-slate-700">Target margin percentage</label><div className="relative mt-2"><input id="target-margin" type="number" min="0" max="99.9" step="0.1" inputMode="decimal" value={marginInput} onChange={(e) => setMarginInput(e.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-4 pr-12 text-2xl font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" /><span className="absolute right-4 top-4 text-2xl text-slate-400">%</span></div>
          <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5"><p className="text-sm font-semibold text-blue-700">Required markup</p><p className="mt-1 text-5xl font-bold tracking-tight text-blue-800">{pct(requiredMarkup)}</p><p className="mt-2 text-sm text-slate-600">Use this markup to keep {pct(targetMargin)} of your charge as profit.</p></div>
          <div className="mt-5 rounded-xl bg-slate-100 p-4 text-sm leading-6 text-slate-600"><strong className="text-slate-800">The math:</strong> markup = margin ÷ (1 − margin). To keep {pct(targetMargin)} margin, divide by the remaining {pct(100 - targetMargin)}.</div>
          <div className="mt-5 border-t border-slate-200 pt-5"><p className="text-sm font-semibold text-slate-800">On a $1,000 materials cost</p><p className="mt-2 text-sm leading-6 text-slate-600">{pct(targetMargin)} margin = charge <strong className="text-slate-900">{money(targetCharge)}</strong> = <strong className="text-slate-900">{money(targetProfit)}</strong> profit = {pct(requiredMarkup)} markup</p></div>
        </section>
      </div>
      <section className="mt-12 rounded-2xl bg-slate-950 px-6 py-10 text-center text-white sm:px-10"><h2 className="text-2xl font-bold sm:text-3xl">Track your real margins on every job with JobMargin</h2><p className="mx-auto mt-3 max-w-2xl text-slate-300">Turn estimates into live job trackers and see what you’re actually making as costs come in.</p><Link to="/signup" className="mt-7 inline-flex min-h-12 items-center justify-center rounded-xl bg-blue-500 px-7 py-3 font-bold hover:bg-blue-400">Try JobMargin free <span className="ml-2" aria-hidden="true">→</span></Link><p className="mt-6 text-sm text-slate-300"><Link to="/tools/labor-burden-calculator" className="font-semibold text-blue-300 underline underline-offset-2 hover:text-blue-200">Also try: Labor Burden Calculator</Link><span className="mx-2 text-slate-500">·</span><Link to="/blog/markup-vs-margin-contractors" className="font-semibold text-blue-300 underline underline-offset-2 hover:text-blue-200">Read our guide: Markup vs. Margin for Contractors</Link><span className="mx-2 text-slate-500">·</span><Link to="/tools/change-order-generator" className="font-semibold text-blue-300 underline underline-offset-2 hover:text-blue-200">Change Order Generator</Link><span className="mx-2 text-slate-500">·</span><Link to="/tools/service-call-pricing" className="font-semibold text-blue-300 underline underline-offset-2 hover:text-blue-200">Service Call Pricing</Link><span className="mx-2 text-slate-500">·</span><Link to="/tools/material-price-book" className="font-semibold text-blue-300 underline underline-offset-2 hover:text-blue-200">Material Price Book</Link></p></section>
    </main>
  </div>;
}
