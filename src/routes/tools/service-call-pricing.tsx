import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/tools/service-call-pricing")({
  head: () => ({
    meta: [
      { title: "Free Service Call Pricing Calculator | JobMargin" },
      { name: "description", content: "Calculate what to charge for service calls. Includes trip fee, labor, parts markup, overhead, and profit margin. Built for plumbers, electricians, and HVAC techs." },
    ],
  }),
  component: ServiceCallPricing,
});

type Trade = "Plumbing" | "Electrical" | "HVAC" | "Handyman" | "Other";
type Values = Record<"trip" | "labor" | "hours" | "markup" | "parts" | "overhead" | "margin" | "calls", string>;
const defaults: Record<Trade, Values> = {
  Plumbing: { trip: "75", labor: "110", hours: "1.5", markup: "30", parts: "40", overhead: "35", margin: "20", calls: "10" },
  Electrical: { trip: "75", labor: "105", hours: "1.5", markup: "30", parts: "35", overhead: "35", margin: "20", calls: "10" },
  HVAC: { trip: "89", labor: "115", hours: "1.5", markup: "35", parts: "60", overhead: "45", margin: "20", calls: "10" },
  Handyman: { trip: "75", labor: "65", hours: "2", markup: "25", parts: "25", overhead: "25", margin: "20", calls: "12" },
  Other: { trip: "75", labor: "85", hours: "1.5", markup: "30", parts: "40", overhead: "35", margin: "20", calls: "10" },
};
const tips: Record<Trade, string> = {
  Plumbing: "Plumbers typically charge $150–350 for a standard service call depending on market.",
  Electrical: "Electricians often charge $100–250 for a diagnostic visit.",
  HVAC: "HVAC service calls typically range $100–300 before parts.",
  Handyman: "Handymen often charge $75–150 minimum per visit.",
  Other: "Your local market, travel time, and specialty should guide your final service call price.",
};
const n = (value: string) => Math.max(0, Number.parseFloat(value) || 0);
const money = (value: number) => `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Field({ id, label, value, onChange, suffix, helper }: { id: keyof Values; label: string; value: string; onChange: (v: string) => void; suffix?: string; helper?: string }) {
  return <div><label htmlFor={id} className="block text-sm font-semibold text-slate-700">{label}</label><div className="relative mt-2"><input id={id} type="number" min="0" step="0.01" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 pr-14 text-lg font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" />{suffix && <span className="pointer-events-none absolute right-4 top-3.5 text-lg text-slate-400">{suffix}</span>}</div>{helper && <p className="mt-1.5 text-xs leading-5 text-slate-500">{helper}</p>}</div>;
}

function ServiceCallPricing() {
  const [trade, setTrade] = useState<Trade>("Plumbing");
  const [values, setValues] = useState<Values>(defaults.Plumbing);
  const set = (id: keyof Values) => (value: string) => setValues((current) => ({ ...current, [id]: value }));
  const selectTrade = (next: Trade) => { setTrade(next); setValues(defaults[next]); };
  const labor = n(values.labor) * n(values.hours);
  const parts = n(values.parts) * (1 + n(values.markup) / 100);
  const overhead = n(values.overhead);
  const totalCost = labor + parts + overhead;
  const minimum = totalCost;
  const margin = Math.min(99.9, n(values.margin));
  const profitPrice = margin < 100 ? totalCost / (1 - margin / 100) : totalCost;
  const recommended = Math.max(n(values.trip), profitPrice);
  const profit = recommended - totalCost;
  const monthly = recommended * n(values.calls) * 4.33;

  return <div className="min-h-dvh bg-slate-50 text-slate-900">
    <header className="bg-slate-950 text-white"><div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 sm:px-6"><Link to="/" className="text-lg font-bold tracking-tight">Job<span className="text-blue-400">Margin</span></Link><nav className="flex items-center gap-1"><Link to="/blog/" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white">Blog</Link><Link to="/profit-calculator" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white">Calculator</Link><Link to="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white">Log in</Link></nav></div></header>
    <main className="mx-auto max-w-5xl px-4 pb-24 pt-10 sm:px-6 sm:pt-14">
      <div className="max-w-3xl"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">Free contractor tool</p><h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Service Call Pricing Calculator</h1><p className="mt-4 text-lg leading-7 text-slate-600">Find the minimum service call price that covers your real costs—and a recommended price that leaves room for profit.</p></div>
      <div className="mt-10 grid gap-8 lg:grid-cols-5 lg:items-start">
        <form className="space-y-6 lg:col-span-3" onSubmit={(e) => e.preventDefault()} aria-label="Service call pricing inputs">
          <section className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8"><label htmlFor="trade" className="block text-sm font-semibold text-slate-700">Your trade</label><select id="trade" value={trade} onChange={(e) => selectTrade(e.target.value as Trade)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-lg font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200">{Object.keys(defaults).map((item) => <option key={item}>{item}</option>)}</select><p className="mt-2 text-xs text-slate-500">Switching trades loads sensible starting values. Adjust them to match your business.</p></section>
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8"><h2 className="text-xl font-bold">Your service call</h2><div className="mt-5 grid gap-5 sm:grid-cols-2"><Field id="trip" label="Trip / diagnostic fee" value={values.trip} onChange={set("trip")} suffix="$" helper="Your current minimum or dispatch fee." /><Field id="hours" label="Average time on site" value={values.hours} onChange={set("hours")} suffix="hrs" /></div></section>
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8"><h2 className="text-xl font-bold">Costs per call</h2><div className="mt-5 grid gap-5 sm:grid-cols-2"><Field id="labor" label="Hourly labor rate" value={values.labor} onChange={set("labor")} suffix="$/hr" /><Field id="parts" label="Average parts cost" value={values.parts} onChange={set("parts")} suffix="$" /><Field id="markup" label="Parts / materials markup" value={values.markup} onChange={set("markup")} suffix="%" /><Field id="overhead" label="Overhead per call" value={values.overhead} onChange={set("overhead")} suffix="$" helper="Insurance, truck, tools, office, and other costs." /></div></section>
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8"><h2 className="text-xl font-bold">Profit goal</h2><div className="mt-5 grid gap-5 sm:grid-cols-2"><Field id="margin" label="Desired profit margin" value={values.margin} onChange={set("margin")} suffix="%" /><Field id="calls" label="Calls per week" value={values.calls} onChange={set("calls")} suffix="calls" /></div></section>
        </form>
        <aside className="space-y-5 lg:col-span-2 lg:sticky lg:top-6"><section className="rounded-2xl border border-blue-200 bg-blue-50 p-6 shadow-sm sm:p-7"><p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Recommended price</p><p className="mt-2 text-5xl font-bold tracking-tight text-blue-900">{money(recommended)}</p><p className="mt-2 text-sm leading-6 text-slate-600">per service call to cover costs and target a {margin}% margin.</p><div className="mt-6 grid grid-cols-2 gap-3 border-t border-blue-200 pt-5"><div><p className="text-xs font-semibold uppercase text-slate-500">Minimum price</p><p className="mt-1 text-xl font-bold">{money(minimum)}</p></div><div><p className="text-xs font-semibold uppercase text-slate-500">Profit / call</p><p className="mt-1 text-xl font-bold text-emerald-700">{money(profit)}</p></div></div></section><section className="rounded-2xl bg-slate-950 p-6 text-white"><p className="text-sm font-semibold text-blue-300">At {values.calls || "0"} calls per week</p><p className="mt-1 text-3xl font-bold">{money(monthly)}<span className="text-base font-medium text-slate-400"> / month</span></p><p className="mt-2 text-sm leading-6 text-slate-300">in service call revenue at your recommended price.</p></section></aside>
      </div>
      <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8"><h2 className="text-2xl font-bold">Your service call breakdown</h2><div className="mt-5 divide-y divide-slate-100"><Row label="Labor" value={labor} /><Row label={`Parts (with ${n(values.markup)}% markup)`} value={parts} /><Row label="Overhead" value={overhead} /><Row label="Profit" value={profit} accent /><div className="mt-2 flex items-center justify-between border-t-2 border-slate-200 py-4 text-lg font-bold"><span>Total price to charge</span><span className="text-blue-700">{money(recommended)}</span></div></div><p className="mt-3 text-xs leading-5 text-slate-500">The trip / diagnostic fee is treated as your current price floor. The recommendation uses whichever is higher: that fee or the price needed to reach your desired margin.</p></section>
      <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6 sm:p-8"><h2 className="text-lg font-bold text-amber-950">{trade} pricing note</h2><p className="mt-2 leading-7 text-amber-900">{tips[trade]}</p></section>
      <section className="mt-12 rounded-2xl bg-slate-950 px-6 py-10 text-center text-white sm:px-10"><h2 className="text-2xl font-bold sm:text-3xl">Stop guessing what to charge</h2><p className="mx-auto mt-3 max-w-2xl text-slate-300">JobMargin tracks your real costs on every service call, so you always know where your profit stands.</p><Link to="/signup" className="mt-7 inline-flex min-h-12 items-center justify-center rounded-xl bg-blue-500 px-7 py-3 font-bold hover:bg-blue-400">Try JobMargin free <span className="ml-2" aria-hidden="true">→</span></Link><p className="mt-6 text-sm text-slate-300"><Link to="/profit-calculator" className="font-semibold text-blue-300 underline underline-offset-2 hover:text-blue-200">Contractor Profit Calculator</Link><span className="mx-2 text-slate-500">·</span><Link to="/tools/labor-burden-calculator" className="font-semibold text-blue-300 underline underline-offset-2 hover:text-blue-200">Labor Burden Calculator</Link><span className="mx-2 text-slate-500">·</span><Link to="/tools/markup-margin-converter" className="font-semibold text-blue-300 underline underline-offset-2 hover:text-blue-200">Markup &amp; Margin Converter</Link></p></section>
    </main>
  </div>;
}
function Row({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) { return <div className="flex items-center justify-between py-3 text-sm"><span className="text-slate-600">{label}</span><span className={`font-semibold ${accent ? "text-emerald-700" : "text-slate-900"}`}>{money(value)}</span></div>; }
