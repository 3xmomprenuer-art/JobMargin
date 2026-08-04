import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/tools/labor-burden-calculator")({
  head: () => ({
    meta: [
      { title: "Free Labor Burden Calculator for Contractors | JobMargin" },
      { name: "description", content: "Calculate your true hourly labor cost including taxes, insurance, benefits, and overhead. See what you should really be charging." },
    ],
  }),
  component: LaborBurdenCalculator,
});

type Values = Record<"rate" | "taxes" | "workersComp" | "liability" | "benefits" | "vehicle" | "tools" | "hours" | "nonBillable", string>;
const INITIAL: Values = { rate: "30", taxes: "7.65", workersComp: "2", liability: "150", benefits: "500", vehicle: "600", tools: "150", hours: "2000", nonBillable: "20" };
const num = (value: string) => Math.max(0, Number.parseFloat(value) || 0);
const money = (value: number, decimals = 2) => `$${value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;

function Field({ id, label, value, onChange, suffix, helper }: { id: keyof Values; label: string; value: string; onChange: (value: string) => void; suffix?: string; helper?: string }) {
  return <div>
    <label htmlFor={id} className="block text-sm font-semibold text-slate-700">{label}</label>
    <div className="relative mt-2"><input id={id} type="number" min="0" step="0.01" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-lg font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" />{suffix && <span className="pointer-events-none absolute right-4 top-3.5 text-lg text-slate-400">{suffix}</span>}</div>
    {helper && <p className="mt-1.5 text-xs leading-5 text-slate-500">{helper}</p>}
  </div>;
}

function LaborBurdenCalculator() {
  const [values, setValues] = useState(INITIAL);
  const set = (id: keyof Values) => (value: string) => setValues((current) => ({ ...current, [id]: value }));
  const rate = num(values.rate), annualHours = num(values.hours), taxes = num(values.taxes), workersComp = num(values.workersComp);
  const wage = rate * annualHours;
  const taxBurden = wage * taxes / 100;
  const compBurden = wage * workersComp / 100;
  const monthlyCosts = num(values.liability) + num(values.benefits) + num(values.vehicle) + num(values.tools);
  const annualFixed = monthlyCosts * 12;
  const totalBurden = taxBurden + compBurden + annualFixed;
  const billableHours = annualHours * Math.max(0, 1 - num(values.nonBillable) / 100);
  const trueCost = billableHours > 0 ? (wage + totalBurden) / billableHours : 0;
  const difference = trueCost - rate;
  const takeHome = rate - trueCost;
  const rows = [
    ["Base wages", wage], ["Payroll taxes", taxBurden], ["Workers comp", compBurden], ["General liability", num(values.liability) * 12], ["Health & benefits", num(values.benefits) * 12], ["Vehicle / truck", num(values.vehicle) * 12], ["Tools & equipment", num(values.tools) * 12],
  ] as const;
  return <div className="min-h-dvh bg-slate-50 text-slate-900">
    <header className="bg-slate-950 text-white"><div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-6 sm:px-6"><Link to="/" className="text-lg font-bold tracking-tight">Job<span className="text-blue-400">Margin</span></Link><nav className="flex items-center gap-1"><Link to="/blog/" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white">Blog</Link><Link to="/profit-calculator" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white">Calculator</Link><Link to="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white">Log in</Link></nav></div></header>
    <main className="mx-auto max-w-5xl px-4 pb-24 pt-10 sm:px-6 sm:pt-14">
      <div className="max-w-3xl"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">Free contractor tool</p><h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Labor Burden Calculator</h1><p className="mt-4 text-lg leading-7 text-slate-600">Your hourly rate is not your true labor cost. Add the costs behind your work to see what each billable hour really needs to earn.</p></div>
      <div className="mt-10 grid gap-8 lg:grid-cols-5 lg:items-start">
        <form className="space-y-6 lg:col-span-3" onSubmit={(e) => e.preventDefault()} aria-label="Labor burden inputs">
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8"><h2 className="text-xl font-bold">Your work and wage</h2><div className="mt-5 grid gap-5 sm:grid-cols-2"><Field id="rate" label="Base hourly wage / rate" value={values.rate} onChange={set("rate")} suffix="$/hr" /><Field id="hours" label="Annual hours worked" value={values.hours} onChange={set("hours")} helper="Typical full-time year: 2,000 hours." /></div></section>
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8"><h2 className="text-xl font-bold">Employment burden</h2><div className="mt-5 grid gap-5 sm:grid-cols-2"><Field id="taxes" label="Payroll taxes" value={values.taxes} onChange={set("taxes")} suffix="%" helper="FICA is 7.65% for most employees." /><Field id="workersComp" label="Workers comp" value={values.workersComp} onChange={set("workersComp")} suffix="%" /></div></section>
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8"><h2 className="text-xl font-bold">Monthly overhead</h2><p className="mt-1 text-sm text-slate-500">Enter what these costs average each month.</p><div className="mt-5 grid gap-5 sm:grid-cols-2"><Field id="liability" label="General liability insurance" value={values.liability} onChange={set("liability")} suffix="$/mo" /><Field id="benefits" label="Health insurance / benefits" value={values.benefits} onChange={set("benefits")} suffix="$/mo" /><Field id="vehicle" label="Vehicle / truck cost" value={values.vehicle} onChange={set("vehicle")} suffix="$/mo" /><Field id="tools" label="Tools & equipment" value={values.tools} onChange={set("tools")} suffix="$/mo" /></div></section>
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8"><Field id="nonBillable" label="Non-billable time" value={values.nonBillable} onChange={set("nonBillable")} suffix="%" helper="Quoting, driving, admin, and other time you cannot invoice. Typical: 20%." /></section>
        </form>
        <aside className="lg:col-span-2 lg:sticky lg:top-6"><div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 shadow-sm sm:p-7"><p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Your true hourly cost</p><p className="mt-2 text-5xl font-bold tracking-tight text-blue-900">{money(trueCost)}</p><p className="mt-2 text-sm leading-6 text-slate-600">per billable hour, after every burden is covered.</p><div className={`mt-5 rounded-xl p-4 ${difference > 0 ? "bg-rose-100" : "bg-emerald-100"}`}><p className={`text-sm font-semibold ${difference > 0 ? "text-rose-800" : "text-emerald-800"}`}>{difference > 0 ? `${money(difference)} higher than your base rate` : "Your burden is covered by your base rate"}</p><p className="mt-1 text-sm text-slate-700">If you charge {money(rate)}/hr, your real take-home is <strong>{money(takeHome)}/hr</strong>.</p></div><div className="mt-6 grid grid-cols-2 gap-3 border-t border-blue-200 pt-5"><div><p className="text-xs font-semibold uppercase text-slate-500">Billable hours</p><p className="mt-1 text-xl font-bold">{Math.round(billableHours).toLocaleString()}</p></div><div><p className="text-xs font-semibold uppercase text-slate-500">Annual burden</p><p className="mt-1 text-xl font-bold">{money(totalBurden, 0)}</p></div></div></div></aside>
      </div>
      <section className="mt-10 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8"><h2 className="text-2xl font-bold">Where your {money(trueCost)}/hr true hourly rate goes</h2><p className="mt-2 text-sm text-slate-500">Annual costs spread across your {Math.round(billableHours).toLocaleString()} billable hours.</p><div className="mt-5 divide-y divide-slate-100">{rows.map(([label, value]) => <div key={label} className="flex items-center justify-between py-3 text-sm"><span className="text-slate-600">{label}</span><span className="font-semibold text-slate-900">{money(billableHours ? value / billableHours : 0)}/hr <span className="ml-2 text-xs font-normal text-slate-400">({money(value, 0)}/yr)</span></span></div>)}<div className="flex items-center justify-between border-t-2 border-slate-200 py-4 font-bold"><span>Total true cost</span><span className="text-blue-700">{money(trueCost)}/hr</span></div></div></section>
      <section className="mt-12 rounded-2xl bg-slate-950 px-6 py-10 text-center text-white sm:px-10"><h2 className="text-2xl font-bold sm:text-3xl">Stop guessing what you really make</h2><p className="mx-auto mt-3 max-w-2xl text-slate-300">JobMargin tracks your real costs automatically on every job. Start your free trial.</p><Link to="/signup" className="mt-7 inline-flex min-h-12 items-center justify-center rounded-xl bg-blue-500 px-7 py-3 font-bold hover:bg-blue-400">Start your free trial <span className="ml-2" aria-hidden="true">→</span></Link><p className="mt-6 text-sm text-slate-300"><Link to="/profit-calculator" className="font-semibold text-blue-300 underline underline-offset-2 hover:text-blue-200">Also try: Contractor Profit Calculator</Link><span className="mx-2 text-slate-500">·</span><Link to="/tools/change-order-generator" className="font-semibold text-blue-300 underline underline-offset-2 hover:text-blue-200">Change Order Generator</Link></p></section>
    </main>
  </div>;
}
