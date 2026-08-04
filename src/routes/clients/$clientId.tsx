import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { sql } from "~/db";
import { getCurrentUser } from "~/lib/auth";

type Client = { id: string; name: string; email: string | null; phone: string | null; address: string | null };
type Related = { id: string; label: string; status: string; created_at: string };
type Detail = { client: Client; estimates: Related[]; jobs: Related[] };

const getClient = createServerFn({ method: "GET" }).validator((d: unknown) => d as { clientId: string }).handler(async ({ data }) => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  try {
    const clients = await sql`SELECT id, name, email, phone, address FROM clients WHERE id = ${data.clientId} AND user_id = ${user.id}`;
    if (!clients.length) return null;
    const estimates = await sql`SELECT id, estimate_number AS label, status, created_at FROM estimates WHERE client_id = ${data.clientId} AND user_id = ${user.id} ORDER BY created_at DESC`;
    const jobs = await sql`SELECT id, job_number AS label, status, created_at FROM jobs WHERE client_id = ${data.clientId} AND user_id = ${user.id} ORDER BY created_at DESC`;
    const c = clients[0];
    return { client: { id: String(c.id), name: String(c.name), email: c.email ? String(c.email) : null, phone: c.phone ? String(c.phone) : null, address: c.address ? String(c.address) : null }, estimates: estimates.map((r) => ({ id: String(r.id), label: String(r.label), status: String(r.status), created_at: String(r.created_at) })), jobs: jobs.map((r) => ({ id: String(r.id), label: String(r.label), status: String(r.status), created_at: String(r.created_at) })) } satisfies Detail;
  } catch { return null; }
});

const updateClient = createServerFn({ method: "POST" }).validator((d: unknown) => {
  const v = d as { clientId: string; name: string; email: string; phone: string; address: string };
  if (!v.name?.trim()) throw new Error("Client name is required");
  if (v.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) throw new Error("Enter a valid email address");
  return { ...v, name: v.name.trim(), email: v.email.trim() || null, phone: v.phone.trim() || null, address: v.address.trim() || null };
}).handler(async ({ data }) => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  const rows = await sql`UPDATE clients SET name = ${data.name}, email = ${data.email}, phone = ${data.phone}, address = ${data.address}, updated_at = NOW() WHERE id = ${data.clientId} AND user_id = ${user.id} RETURNING id`;
  if (!rows.length) return null;
  return { success: true };
});

export const Route = createFileRoute("/clients/$clientId")({ loader: ({ params }) => getClient({ data: { clientId: params.clientId } }), component: ClientDetailPage });

function ClientDetailPage() {
  const detail = Route.useLoaderData();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!detail) return <div className="mx-auto max-w-lg px-4 py-16 text-center"><p className="text-lg font-semibold text-gray-900">Client not found</p><Link to="/clients" className="mt-4 inline-block text-sm font-semibold text-indigo-600">Back to clients</Link></div>;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  useEffect(() => { if (detail) { setName(detail.client.name); setEmail(detail.client.email || ""); setPhone(detail.client.phone || ""); setAddress(detail.client.address || ""); } }, [detail]);
  const save = async (e: React.FormEvent) => { e.preventDefault(); setError(null); if (!name.trim()) return setError("Client name is required"); if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Enter a valid email address"); try { setSaving(true); await updateClient({ data: { clientId: detail.client.id, name, email, phone, address } }); setEditing(false); window.location.reload(); } catch (err) { setError(err instanceof Error ? err.message : "Unable to save client"); } finally { setSaving(false); } };
  const field = (label: string, value: string, set: (v: string) => void, type = "text") => <label className="block"><span className="mb-1 block text-sm font-medium text-gray-700">{label}</span><input type={type} value={value} onChange={(e) => set(e.target.value)} className="min-h-[48px] w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" /></label>;
  return <div className="mx-auto max-w-lg px-4 py-6"><div className="mb-6 flex items-center gap-3"><Link to="/clients" className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-gray-500 hover:bg-gray-100" aria-label="Back to clients">←</Link><h1 className="flex-1 text-2xl font-bold tracking-tight text-gray-900">{editing ? "Edit Client" : detail.client.name}</h1>{!editing && <button onClick={() => setEditing(true)} className="min-h-[44px] rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Edit</button>}</div>
    {editing ? <form onSubmit={save} className="space-y-5 rounded-xl border border-gray-200 bg-white p-4">{field("Name *", name, setName)}{field("Email", email, setEmail, "email")}{field("Phone", phone, setPhone, "tel")}{field("Address", address, setAddress)}{error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}<div className="flex gap-3"><button type="button" onClick={() => setEditing(false)} className="min-h-[48px] flex-1 rounded-lg border border-gray-300 px-4 py-3 font-semibold text-gray-700">Cancel</button><button disabled={saving} className="min-h-[48px] flex-1 rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white disabled:opacity-50">{saving ? "Saving..." : "Save"}</button></div></form> : <><div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 space-y-2 text-sm text-gray-600">{detail.client.email && <p>✉ {detail.client.email}</p>}{detail.client.phone && <p>☎ {detail.client.phone}</p>}{detail.client.address && <p>⌖ {detail.client.address}</p>}{!detail.client.email && !detail.client.phone && !detail.client.address && <p>No contact details added.</p>}</div><RelatedList title="Estimates" items={detail.estimates} to="/estimates/$estimateId" /><RelatedList title="Jobs" items={detail.jobs} to="/jobs/$jobId" /></>}</div>;
}
function RelatedList({ title, items, to }: { title: string; items: Related[]; to: "/estimates/$estimateId" | "/jobs/$jobId" }) { return <section className="mb-6"><h2 className="mb-3 text-base font-semibold text-gray-900">{title}</h2>{items.length ? <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">{items.map((item) => <li key={item.id}><Link to={to} params={{ [to.startsWith("/estimates") ? "estimateId" : "jobId"]: item.id } as never} className="flex min-h-[60px] items-center justify-between px-4 py-3 hover:bg-gray-50"><span className="font-medium text-gray-900">{item.label}</span><span className="text-xs text-gray-500">{item.status}</span></Link></li>)}</ul> : <p className="rounded-xl border border-dashed border-gray-300 px-4 py-5 text-sm text-gray-500">No {title.toLowerCase()} for this client.</p>}</section>; }
