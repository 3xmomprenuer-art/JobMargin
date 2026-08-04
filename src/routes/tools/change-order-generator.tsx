import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/tools/change-order-generator")({
  head: () => ({
    meta: [
      { title: "Free Change Order Generator for Contractors | JobMargin" },
      { name: "description", content: "Generate professional change orders in seconds. Fill in the details, download as PDF, and get client approval before doing extra work." },
    ],
  }),
  component: ChangeOrderGenerator,
});

type FormValues = {
  contractor: string; client: string; project: string; date: string;
  originalScope: string; changeDescription: string; reason: string;
  additionalCost: string; newTotal: string; daysAdded: string; notes: string;
};

const initialValues: FormValues = {
  contractor: "", client: "", project: "", date: new Date().toISOString().slice(0, 10),
  originalScope: "", changeDescription: "", reason: "", additionalCost: "", newTotal: "", daysAdded: "", notes: "This change order must be approved before work begins. Original contract terms remain in effect.",
};

const inputClass = "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-base text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200";
const labelClass = "block text-sm font-semibold text-slate-700";

function ChangeOrderGenerator() {
  const [values, setValues] = useState<FormValues>(initialValues);
  const set = (key: keyof FormValues) => (value: string) => setValues((current) => ({ ...current, [key]: value }));
  const money = (value: string) => value ? `$${Number.parseFloat(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";
  const dateDisplay = values.date ? new Date(`${values.date}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—";

  return <div className="min-h-dvh bg-slate-50 text-slate-900">
    <style>{`@media print { @page { size: letter; margin: .55in; } body { background: white !important; } .print-hide { display: none !important; } .change-order-print { display: block !important; max-width: none !important; padding: 0 !important; } .change-order-paper { border: 0 !important; box-shadow: none !important; padding: 0 !important; } .change-order-paper p, .change-order-paper h1, .change-order-paper h2 { color: #0f172a !important; } }`}</style>
    <header className="print-hide bg-slate-950 text-white"><div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-6 sm:px-6"><Link to="/" className="text-lg font-bold tracking-tight">Job<span className="text-blue-400">Margin</span></Link><nav className="flex items-center gap-1"><Link to="/blog/" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white">Blog</Link><Link to="/profit-calculator" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white">Calculator</Link><Link to="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white">Log in</Link></nav></div></header>
    <main className="change-order-print mx-auto max-w-5xl px-4 pb-24 pt-10 sm:px-6 sm:pt-14">
      <div className="print-hide max-w-3xl"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">Free contractor tool</p><h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Change Order Generator</h1><p className="mt-4 text-lg leading-7 text-slate-600">Create a clear, professional change order and get client approval before extra work begins.</p></div>
      <div className="mt-10 grid gap-8 lg:grid-cols-5 lg:items-start">
        <form className="print-hide space-y-6 lg:col-span-3" onSubmit={(e) => e.preventDefault()} aria-label="Change order details">
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8"><h2 className="text-xl font-bold">Change order details</h2><p className="mt-1 text-sm text-slate-500">Fields marked with * are required.</p><div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Field id="contractor" label="Contractor / company name *" value={values.contractor} onChange={set("contractor")} required /><Field id="client" label="Client name *" value={values.client} onChange={set("client")} required /><Field id="project" label="Project / job name *" value={values.project} onChange={set("project")} required /><Field id="date" label="Date *" type="date" value={values.date} onChange={set("date")} required />
          </div></section>
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8"><h2 className="text-xl font-bold">Scope and reason</h2><div className="mt-5 space-y-5"><TextField id="originalScope" label="Original scope of work" value={values.originalScope} onChange={set("originalScope")} placeholder="What was originally agreed?" /><TextField id="changeDescription" label="Change description *" value={values.changeDescription} onChange={set("changeDescription")} placeholder="Describe the additional work requested" required /><TextField id="reason" label="Reason for change" value={values.reason} onChange={set("reason")} placeholder="Client request, unforeseen condition, etc." /></div></section>
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8"><h2 className="text-xl font-bold">Price and schedule impact</h2><div className="mt-5 grid gap-5 sm:grid-cols-3"><Field id="additionalCost" label="Additional cost ($) *" type="number" value={values.additionalCost} onChange={set("additionalCost")} required /><Field id="newTotal" label="New total ($) *" type="number" value={values.newTotal} onChange={set("newTotal")} required /><Field id="daysAdded" label="Days added" type="number" value={values.daysAdded} onChange={set("daysAdded")} /></div></section>
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8"><TextField id="notes" label="Notes / terms" value={values.notes} onChange={set("notes")} /></section>
        </form>
        <div className="lg:col-span-2 lg:sticky lg:top-6"><button type="button" onClick={() => window.print()} className="print-hide flex min-h-14 w-full items-center justify-center rounded-xl bg-blue-600 px-6 py-4 text-lg font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700">Download as PDF <span aria-hidden="true" className="ml-3">↓</span></button><p className="print-hide mt-2 text-center text-xs text-slate-500">Your browser will open the print dialog. Choose “Save as PDF”.</p>
          <section className="change-order-paper mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8" aria-label="Change order preview"><div className="border-b-4 border-blue-600 pb-5"><p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">{values.contractor || "Your company name"}</p><h2 className="mt-2 text-3xl font-black tracking-tight">CHANGE ORDER</h2><p className="mt-1 text-sm text-slate-500">{values.project || "Project / job name"} · {dateDisplay}</p></div><div className="mt-5 grid grid-cols-2 gap-4 text-sm"><div><p className="text-xs font-bold uppercase text-slate-400">Contractor</p><p className="mt-1 font-semibold">{values.contractor || "—"}</p></div><div><p className="text-xs font-bold uppercase text-slate-400">Client</p><p className="mt-1 font-semibold">{values.client || "—"}</p></div></div><PreviewBlock title="Original scope" value={values.originalScope} /><PreviewBlock title="Additional work requested" value={values.changeDescription} /><PreviewBlock title="Reason for change" value={values.reason} /><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-lg bg-slate-100 p-3"><p className="text-xs font-bold uppercase text-slate-500">Additional cost</p><p className="mt-1 text-xl font-bold">{money(values.additionalCost)}</p></div><div className="rounded-lg bg-blue-50 p-3"><p className="text-xs font-bold uppercase text-blue-700">New total</p><p className="mt-1 text-xl font-bold text-blue-900">{money(values.newTotal)}</p></div></div><p className="mt-4 text-sm"><strong>Schedule impact:</strong> {values.daysAdded ? `${values.daysAdded} day${values.daysAdded === "1" ? "" : "s"} added` : "—"}</p><div className="mt-6 border-t border-slate-200 pt-5"><p className="text-xs leading-5 text-slate-500">{values.notes || "—"}</p><div className="mt-8 grid grid-cols-2 gap-6 text-sm"><div className="border-t border-slate-500 pt-2">Client signature</div><div className="border-t border-slate-500 pt-2">Date</div></div></div></section>
        </div>
      </div>
      <section className="print-hide mt-12 rounded-2xl bg-slate-950 px-6 py-10 text-center text-white sm:px-10"><h2 className="text-2xl font-bold sm:text-3xl">Know what every change does to your profit</h2><p className="mx-auto mt-3 max-w-2xl text-slate-300">JobMargin helps you track change orders against your original estimate — so you know exactly how they affected your profit.</p><Link to="/signup" className="mt-7 inline-flex min-h-12 items-center justify-center rounded-xl bg-blue-500 px-7 py-3 font-bold hover:bg-blue-400">Try JobMargin free <span className="ml-2" aria-hidden="true">→</span></Link></section>
    </main>
  </div>;
}

function Field({ id, label, value, onChange, type = "text", required = false }: { id: string; label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) { return <div><label htmlFor={id} className={labelClass}>{label}</label><input id={id} type={type} value={value} required={required} onChange={(e) => onChange(e.target.value)} className={inputClass} /></div>; }
function TextField({ id, label, value, onChange, placeholder, required = false }: { id: string; label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean }) { return <div><label htmlFor={id} className={labelClass}>{label}</label><textarea id={id} value={value} required={required} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} rows={3} className={`${inputClass} resize-y`} /></div>; }
function PreviewBlock({ title, value }: { title: string; value: string }) { return <div className="mt-5"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">{title}</p><p className="mt-1 min-h-5 whitespace-pre-wrap text-sm leading-6 text-slate-700">{value || "—"}</p></div>; }
