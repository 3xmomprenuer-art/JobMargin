import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";

type Trade = "Plumbing" | "Electrical" | "HVAC" | "Handyman / General" | "Custom";
type Material = { id: number; name: string; unit: string; cost: string; markup: string };

const STARTER: Record<Trade, Omit<Material, "id">[]> = {
  Plumbing: [
    ["PVC pipe", "per ft", "0.85"], ["Copper pipe", "per ft", "3.25"], ["PEX tubing", "per ft", "0.65"], ["Fittings", "ea", "2.50"], ["Valves", "ea", "18.00"], ["Water heater", "ea", "650.00"], ["Toilet", "ea", "225.00"], ["Faucet", "ea", "95.00"],
  ].map(([name, unit, cost]) => ({ name, unit, cost, markup: "" })),
  Electrical: [
    ["Romex 12/2", "per ft", "0.72"], ["Outlets", "ea", "2.50"], ["Switches", "ea", "2.25"], ["Breakers", "ea", "12.00"], ["Panel", "ea", "185.00"], ["Junction boxes", "ea", "1.75"], ["Conduit", "per ft", "0.90"], ["Wire nuts", "per 100", "8.50"],
  ].map(([name, unit, cost]) => ({ name, unit, cost, markup: "" })),
  HVAC: [
    ["Refrigerant", "per lb", "18.00"], ["Ductwork", "per ft", "4.25"], ["Filters", "ea", "9.00"], ["Thermostat", "ea", "85.00"], ["Capacitor", "ea", "28.00"], ["Contactor", "ea", "42.00"], ["Condenser fan motor", "ea", "165.00"],
  ].map(([name, unit, cost]) => ({ name, unit, cost, markup: "" })),
  "Handyman / General": [
    ["Drywall sheet", "ea", "14.00"], ["2x4 lumber", "ea", "5.50"], ["Paint gallon", "ea", "38.00"], ["Caulk tube", "ea", "6.50"], ["Screws", "per box", "12.00"], ["Door hardware", "ea", "32.00"],
  ].map(([name, unit, cost]) => ({ name, unit, cost, markup: "" })),
  Custom: [],
};

export const Route = createFileRoute("/tools/material-price-book")({
  head: () => ({ meta: [
    { title: "Free Contractor Material Price Book Template | JobMargin" },
    { name: "description", content: "Build and print a customizable material price book. Pre-loaded with common plumbing, electrical, HVAC, and handyman materials. Set your markup and go." },
  ] }),
  component: MaterialPriceBook,
});

function money(value: number) {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function numeric(value: string) {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function MaterialPriceBook() {
  const [trade, setTrade] = useState<Trade>("Plumbing");
  const [globalMarkup, setGlobalMarkup] = useState("30");
  const [items, setItems] = useState<Record<Trade, Material[]>>(() => {
    let id = 1;
    return Object.fromEntries((Object.keys(STARTER) as Trade[]).map((key) => [key, STARTER[key].map((item) => ({ ...item, id: id++ }))])) as Record<Trade, Material[]>;
  });
  const rows = items[trade];
  const markup = numeric(globalMarkup);
  const count = useMemo(() => Object.values(items).reduce((total, list) => total + list.length, 0), [items]);

  function update(id: number, field: keyof Material, value: string) {
    setItems((current) => ({ ...current, [trade]: current[trade].map((item) => item.id === id ? { ...item, [field]: value } : item) }));
  }
  function addRow() {
    setItems((current) => ({ ...current, [trade]: [...current[trade], { id: Date.now(), name: "", unit: "ea", cost: "", markup: "" }] }));
  }
  function removeRow(id: number) {
    setItems((current) => ({ ...current, [trade]: current[trade].filter((item) => item.id !== id) }));
  }
  function downloadCsv() {
    const all = (Object.keys(items) as Trade[]).flatMap((key) => items[key].map((item) => ({ ...item, trade: key })));
    const lines = [["Trade", "Item name", "Unit cost", "Unit", "Markup", "Sell price"], ...all.map((item) => {
      const applied = item.markup === "" ? markup : numeric(item.markup);
      return [item.trade, item.name, numeric(item.cost).toFixed(2), item.unit, `${applied}%`, (numeric(item.cost) * (1 + applied / 100)).toFixed(2)];
    })];
    const csv = "\\ufeff" + lines.map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\\r\\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "jobmargin-material-price-book.csv"; link.click(); URL.revokeObjectURL(url);
  }

  return <div className="material-book min-h-dvh bg-slate-50 text-slate-900">
    <header className="book-header bg-slate-950 text-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6"><Link to="/" className="text-lg font-bold tracking-tight">Job<span className="text-blue-400">Margin</span></Link><nav className="flex items-center gap-1"><Link to="/tools/markup-margin-converter" className="hidden rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-white sm:block">Tools</Link><Link to="/pricing" className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-white">Pricing</Link><Link to="/login" className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-white">Log in</Link></nav></div></header>
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-9 sm:px-6 sm:pt-14">
      <div className="max-w-3xl"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">Free contractor tool</p><h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Material Price Book</h1><p className="mt-4 text-lg leading-7 text-slate-600">Build a quick reference for your most-used materials. Add your supplier costs, set your markup, and always know what to charge.</p></div>
      <section className="mt-8 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-slate-500">Your price book</p><p className="mt-1 text-2xl font-bold">{count} <span className="text-base font-medium text-slate-500">materials</span></p></div><label className="w-full sm:w-52"><span className="text-sm font-semibold text-slate-700">Default markup</span><div className="relative mt-1"><input aria-label="Default markup" type="number" min="0" step="1" inputMode="decimal" value={globalMarkup} onChange={(e) => setGlobalMarkup(e.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-10 text-lg font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"/><span className="absolute right-3 top-3 text-lg text-slate-400">%</span></div></label></div>
        <div className="mt-6 flex gap-2 overflow-x-auto border-b border-slate-200 pb-2" role="tablist">{(Object.keys(STARTER) as Trade[]).map((key) => <button key={key} role="tab" aria-selected={trade === key} onClick={() => setTrade(key)} className={`shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${trade === key ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{key}</button>)}</div>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[680px] text-left"><thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><th className="pb-3 pr-3">Item name</th><th className="pb-3 pr-3">Unit</th><th className="pb-3 pr-3">Supplier cost</th><th className="pb-3 pr-3">Markup</th><th className="pb-3 pr-3">Sell price</th><th className="pb-3" aria-label="Remove"/></tr></thead><tbody>{rows.map((item) => { const applied = item.markup === "" ? markup : numeric(item.markup); const sell = numeric(item.cost) * (1 + applied / 100); return <tr key={item.id} className="border-b border-slate-100"><td className="py-3 pr-3"><input aria-label="Item name" value={item.name} onChange={(e) => update(item.id, "name", e.target.value)} placeholder="Material name" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/></td><td className="py-3 pr-3"><select aria-label="Unit" value={item.unit} onChange={(e) => update(item.id, "unit", e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-blue-500"><option>ea</option><option>per ft</option><option>per lb</option><option>per box</option><option>per 100</option></select></td><td className="py-3 pr-3"><div className="relative"><span className="absolute left-3 top-2.5 text-slate-400">$</span><input aria-label="Supplier cost" type="number" min="0" step="0.01" inputMode="decimal" value={item.cost} onChange={(e) => update(item.id, "cost", e.target.value)} placeholder="0.00" className="w-32 rounded-lg border border-slate-300 py-2.5 pl-7 pr-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/></div></td><td className="py-3 pr-3"><div className="relative"><input aria-label="Item markup" type="number" min="0" step="1" inputMode="decimal" value={item.markup} onChange={(e) => update(item.id, "markup", e.target.value)} placeholder={globalMarkup} className="w-24 rounded-lg border border-slate-300 px-3 py-2.5 pr-7 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/><span className="absolute right-2 top-2.5 text-slate-400">%</span></div></td><td className="py-3 pr-3 font-bold text-blue-700">{money(sell)}</td><td className="py-3"><button onClick={() => removeRow(item.id)} aria-label={`Remove ${item.name || "row"}`} className="rounded-lg px-2 py-2 text-lg text-slate-400 hover:bg-red-50 hover:text-red-600">×</button></td></tr>})}</tbody></table>{rows.length === 0 && <div className="py-12 text-center text-slate-500"><p className="font-semibold">No materials yet</p><p className="mt-1 text-sm">Add your first custom material below.</p></div>}</div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><button onClick={addRow} className="inline-flex min-h-11 items-center justify-center rounded-xl border-2 border-dashed border-blue-300 px-5 py-2.5 font-bold text-blue-700 hover:bg-blue-50">+ Add row</button><p className="text-sm text-slate-500">Items with a blank markup use your {markup}% default.</p></div>
        <div className="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end"><button onClick={() => window.print()} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 px-5 py-3 font-bold text-slate-700 hover:bg-slate-50">Print Price Book</button><button onClick={downloadCsv} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-blue-600 px-5 py-3 font-bold text-white shadow-sm hover:bg-blue-500">Download CSV</button></div>
      </section>
      <section className="book-cta mt-12 rounded-2xl bg-slate-950 px-6 py-10 text-center text-white sm:px-10"><h2 className="text-2xl font-bold sm:text-3xl">Build estimates faster with JobMargin</h2><p className="mx-auto mt-3 max-w-xl text-slate-300">JobMargin remembers your material prices so you can build estimates faster. Start your free trial.</p><Link to="/signup" className="mt-7 inline-flex min-h-12 items-center justify-center rounded-xl bg-blue-500 px-7 py-3 font-bold hover:bg-blue-400">Start your free trial <span className="ml-2" aria-hidden="true">→</span></Link></section>
    </main>
    <style>{`@media print { .book-header, .book-cta, .material-book main > div:first-child, .material-book section > div:first-child, .material-book section > div:nth-of-type(2), .material-book section > div:nth-of-type(4), .material-book button, .material-book select, .material-book input { display: none !important; } .material-book, .material-book section { background: white !important; box-shadow: none !important; border: 0 !important; } .material-book main { padding: 0 !important; max-width: none !important; } .material-book table { min-width: 0 !important; } }`}</style>
  </div>;
}
