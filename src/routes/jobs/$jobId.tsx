import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { sql } from "~/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MaterialEntry {
  id: string;
  description: string;
  cost: number;
  purchased_at: string;
  receipt_url: string | null;
}

interface TimeEntry {
  id: string;
  hours: number;
  hourly_rate: number;
  total_cost: number;
  notes: string | null;
  logged_at: string;
}

interface JobDetail {
  id: string;
  job_number: string;
  status: string;
  estimated_total: number | null;
  actual_materials_cost: number;
  actual_labor_cost: number;
  actual_labor_hours: number;
  created_at: string;
  updated_at: string;
  client_id: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  client_address: string | null;
  materials: MaterialEntry[];
  time_entries: TimeEntry[];
}

interface JobFinancials {
  estimated_total: number;
  actual_materials: number;
  actual_labor: number;
  actual_total: number;
  profit: number;
  margin_pct: number;
}
interface Invoice {
  id: string;
  job_id: string;
  invoice_number: string;
  description: string;
  amount_cents: number;
  amount_paid_cents: number;
  status: string;
  stripe_invoice_id: string | null;
  stripe_payment_link: string | null;
  customer_email: string | null;
  issued_at: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  needs_payment_link: boolean;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Server functions
// ---------------------------------------------------------------------------

const getJob = createServerFn({ method: "GET" })
  .validator((data: unknown) => data as { jobId: string })
  .handler(async ({ data: { jobId } }) => {
    try {
      const jobRows = await sql`
        SELECT
          j.id, j.job_number, j.status, j.estimated_total,
          j.actual_materials_cost, j.actual_labor_cost, j.actual_labor_hours,
          j.created_at, j.updated_at, j.client_id,
          c.name AS client_name, c.email AS client_email,
          c.phone AS client_phone, c.address AS client_address
        FROM jobs j
        JOIN clients c ON j.client_id = c.id
        WHERE j.id = ${jobId}
      `;
      if (jobRows.length === 0) return null;
      const job = jobRows[0];

      const materialRows = await sql`
        SELECT id, description, cost, purchased_at, receipt_url
        FROM job_materials
        WHERE job_id = ${jobId}
        ORDER BY purchased_at DESC
      `;

      const timeRows = await sql`
        SELECT id, hours, hourly_rate, total_cost, notes, logged_at
        FROM job_time_entries
        WHERE job_id = ${jobId}
        ORDER BY logged_at DESC
      `;

      return {
        id: String(job.id),
        job_number: String(job.job_number),
        status: String(job.status),
        estimated_total: job.estimated_total ? Number(job.estimated_total) : null,
        actual_materials_cost: Number(job.actual_materials_cost),
        actual_labor_cost: Number(job.actual_labor_cost),
        actual_labor_hours: Number(job.actual_labor_hours),
        created_at: String(job.created_at),
        updated_at: String(job.updated_at),
        client_id: String(job.client_id),
        client_name: String(job.client_name),
        client_email: job.client_email ? String(job.client_email) : null,
        client_phone: job.client_phone ? String(job.client_phone) : null,
        client_address: job.client_address ? String(job.client_address) : null,
        materials: materialRows.map((r) => ({
          id: String(r.id),
          description: String(r.description),
          cost: Number(r.cost),
          purchased_at: String(r.purchased_at),
          receipt_url: r.receipt_url ? String(r.receipt_url) : null,
        })),
        time_entries: timeRows.map((r) => ({
          id: String(r.id),
          hours: Number(r.hours),
          hourly_rate: Number(r.hourly_rate),
          total_cost: Number(r.total_cost),
          notes: r.notes ? String(r.notes) : null,
          logged_at: String(r.logged_at),
        })),
      } as JobDetail;
    } catch {
      return null;
    }
  });

const updateJobStatus = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as { jobId: string; status: string };
    if (!["not_started", "in_progress", "complete"].includes(d.status)) {
      throw new Error("Invalid status");
    }
    return d;
  })
  .handler(async ({ data: { jobId, status } }) => {
    await sql`
      UPDATE jobs SET status = ${status}, updated_at = NOW()
      WHERE id = ${jobId}
    `;
    return { success: true };
  });

const addMaterial = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as { jobId: string; description: string; cost: number; receipt_url?: string };
    if (!d.description || d.description.trim().length === 0) {
      throw new Error("Description is required");
    }
    if (typeof d.cost !== "number" || d.cost < 0) {
      throw new Error("Cost must be a positive number");
    }
    return { ...d, description: d.description.trim(), receipt_url: d.receipt_url || null };
  })
  .handler(async ({ data }) => {
    await sql`
      INSERT INTO job_materials (job_id, description, cost, receipt_url)
      VALUES (${data.jobId}, ${data.description}, ${data.cost}, ${data.receipt_url})
    `;

    // Recalculate and update actual_materials_cost on the job
    const sumRows = await sql`
      SELECT COALESCE(SUM(cost), 0) AS total FROM job_materials WHERE job_id = ${data.jobId}
    `;
    await sql`
      UPDATE jobs SET actual_materials_cost = ${Number(sumRows[0].total)}, updated_at = NOW()
      WHERE id = ${data.jobId}
    `;

    return { success: true };
  });

const addTimeEntry = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as { jobId: string; hours: number; hourly_rate: number; notes?: string };
    if (typeof d.hours !== "number" || d.hours <= 0) {
      throw new Error("Hours must be a positive number");
    }
    if (typeof d.hourly_rate !== "number" || d.hourly_rate <= 0) {
      throw new Error("Hourly rate must be a positive number");
    }
    return { ...d, notes: d.notes || null };
  })
  .handler(async ({ data }) => {
    const totalCost = data.hours * data.hourly_rate;

    await sql`
      INSERT INTO job_time_entries (job_id, hours, hourly_rate, total_cost, notes)
      VALUES (${data.jobId}, ${data.hours}, ${data.hourly_rate}, ${totalCost}, ${data.notes})
    `;

    // Recalculate and update actual_labor on the job
    const sumRows = await sql`
      SELECT
        COALESCE(SUM(total_cost), 0) AS total_labor,
        COALESCE(SUM(hours), 0) AS total_hours
      FROM job_time_entries WHERE job_id = ${data.jobId}
    `;
    await sql`
      UPDATE jobs SET
        actual_labor_cost = ${Number(sumRows[0].total_labor)},
        actual_labor_hours = ${Number(sumRows[0].total_hours)},
        updated_at = NOW()
      WHERE id = ${data.jobId}
    `;

    return { success: true };
  });

const getInvoices = createServerFn({ method: "GET" })
  .validator((data: unknown) => data as { jobId: string })
  .handler(async ({ data: { jobId } }) => {
    try {
      const rows = await sql`
        SELECT id, job_id, invoice_number, description, amount_cents,
               amount_paid_cents, status, stripe_invoice_id, stripe_payment_link,
               customer_email, issued_at, paid_at, created_at, updated_at,
               needs_payment_link
        FROM invoices
        WHERE job_id = ${jobId}
        ORDER BY created_at DESC
      `;
      return rows.map((r) => ({
        id: String(r.id),
        job_id: String(r.job_id),
        invoice_number: String(r.invoice_number),
        description: String(r.description),
        amount_cents: Number(r.amount_cents),
        amount_paid_cents: Number(r.amount_paid_cents),
        status: String(r.status),
        stripe_invoice_id: r.stripe_invoice_id ? String(r.stripe_invoice_id) : null,
        stripe_payment_link: r.stripe_payment_link ? String(r.stripe_payment_link) : null,
        customer_email: r.customer_email ? String(r.customer_email) : null,
        issued_at: r.issued_at ? String(r.issued_at) : null,
        paid_at: r.paid_at ? String(r.paid_at) : null,
        needs_payment_link: Boolean(r.needs_payment_link),
        created_at: String(r.created_at),
        updated_at: String(r.updated_at),
      })) as Invoice[];
    } catch {
      return [] as Invoice[];
    }
  });

const createInvoiceForJob = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as {
      jobId: string;
      description: string;
      amountCents: number;
      customerEmail?: string;
    };
    if (!d.description || d.description.trim().length === 0) {
      throw new Error("Description is required");
    }
    if (typeof d.amountCents !== "number" || d.amountCents <= 0) {
      throw new Error("Amount must be a positive number");
    }
    return {
      jobId: d.jobId,
      description: d.description.trim(),
      amountCents: Math.round(d.amountCents),
      customerEmail: d.customerEmail || null,
    };
  })
  .handler(async ({ data: { jobId, description, amountCents, customerEmail } }) => {
    // Generate next invoice number (INV-001 format)
    const countRows = await sql`
      SELECT COUNT(*)::int AS cnt FROM invoices
    `;
    const nextNum = Number(countRows[0].cnt) + 1;
    const invoiceNumber = `INV-${String(nextNum).padStart(3, "0")}`;

    const now = new Date().toISOString();

    const rows = await sql`
      INSERT INTO invoices (job_id, invoice_number, description, amount_cents, customer_email, issued_at, needs_payment_link)
      VALUES (${jobId}, ${invoiceNumber}, ${description}, ${amountCents}, ${customerEmail}, ${now}, true)
      RETURNING id, job_id, invoice_number, description, amount_cents,
                amount_paid_cents, status, stripe_invoice_id, stripe_payment_link,
                customer_email, issued_at, paid_at, needs_payment_link, created_at, updated_at
    `;
    const r = rows[0];

    // Stripe integration: the lead calls create_invoice with this record's data

    return {
      id: String(r.id),
      job_id: String(r.job_id),
      invoice_number: String(r.invoice_number),
      description: String(r.description),
      amount_cents: Number(r.amount_cents),
      amount_paid_cents: Number(r.amount_paid_cents),
      status: String(r.status),
      stripe_invoice_id: r.stripe_invoice_id ? String(r.stripe_invoice_id) : null,
      stripe_payment_link: r.stripe_payment_link ? String(r.stripe_payment_link) : null,
      customer_email: r.customer_email ? String(r.customer_email) : null,
      issued_at: r.issued_at ? String(r.issued_at) : null,
      paid_at: r.paid_at ? String(r.paid_at) : null,
      needs_payment_link: Boolean(r.needs_payment_link),
      created_at: String(r.created_at),
      updated_at: String(r.updated_at),
    } as Invoice;
  });

const markInvoicePaid = createServerFn({ method: "POST" })
  .validator((data: unknown) => data as { invoiceId: string })
  .handler(async ({ data: { invoiceId } }) => {
    try {
      const rows = await sql`
        UPDATE invoices
        SET status = 'paid',
            paid_at = NOW(),
            amount_paid_cents = amount_cents,
            needs_payment_link = false,
            updated_at = NOW()
        WHERE id = ${invoiceId}
        RETURNING id, status, paid_at, amount_paid_cents, needs_payment_link
      `;
      if (rows.length === 0) return null;
      const r = rows[0];
      return {
        id: String(r.id),
        status: String(r.status),
        paid_at: r.paid_at ? String(r.paid_at) : null,
        amount_paid_cents: Number(r.amount_paid_cents),
        needs_payment_link: Boolean(r.needs_payment_link),
      };
    } catch {
      return null;
    }
  });

const cancelInvoice = createServerFn({ method: "POST" })
  .validator((data: unknown) => data as { invoiceId: string })
  .handler(async ({ data: { invoiceId } }) => {
    try {
      const rows = await sql`
        UPDATE invoices
        SET status = 'cancelled',
            needs_payment_link = false,
            updated_at = NOW()
        WHERE id = ${invoiceId} AND status = 'unpaid'
        RETURNING id, status, needs_payment_link
      `;
      if (rows.length === 0) return null;
      const r = rows[0];
      return {
        id: String(r.id),
        status: String(r.status),
        needs_payment_link: Boolean(r.needs_payment_link),
      };
    } catch {
      return null;
    }
  });

const getInvoice = createServerFn({ method: "GET" })
  .validator((data: unknown) => data as { invoiceId: string })
  .handler(async ({ data: { invoiceId } }) => {
    try {
      const rows = await sql`
        SELECT i.id, i.job_id, i.invoice_number, i.description, i.amount_cents,
               i.amount_paid_cents, i.status, i.stripe_invoice_id, i.stripe_payment_link,
               i.customer_email, i.issued_at, i.paid_at, i.created_at, i.updated_at,
               j.job_number, c.name AS client_name
        FROM invoices i
        JOIN jobs j ON i.job_id = j.id
        JOIN clients c ON j.client_id = c.id
        WHERE i.id = ${invoiceId}
      `;
      if (rows.length === 0) return null;
      const r = rows[0];
      return {
        id: String(r.id),
        job_id: String(r.job_id),
        invoice_number: String(r.invoice_number),
        description: String(r.description),
        amount_cents: Number(r.amount_cents),
        amount_paid_cents: Number(r.amount_paid_cents),
        status: String(r.status),
        stripe_invoice_id: r.stripe_invoice_id ? String(r.stripe_invoice_id) : null,
        stripe_payment_link: r.stripe_payment_link ? String(r.stripe_payment_link) : null,
        customer_email: r.customer_email ? String(r.customer_email) : null,
        issued_at: r.issued_at ? String(r.issued_at) : null,
        paid_at: r.paid_at ? String(r.paid_at) : null,
        created_at: String(r.created_at),
        updated_at: String(r.updated_at),
        job_number: String(r.job_number),
        client_name: String(r.client_name),
      };
    } catch {
      return null;
    }
  });

export const Route = createFileRoute("/jobs/$jobId")({
  loader: ({ params }) =>
    getJob({ data: { jobId: params.jobId } }),
  component: JobDetailPage,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateShort(d: string): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function computeFinancials(job: JobDetail): JobFinancials {
  const estimated = job.estimated_total ?? 0;
  const actualMaterials = job.materials.reduce((sum, m) => sum + m.cost, 0);
  const actualLabor = job.time_entries.reduce((sum, t) => sum + t.total_cost, 0);
  const actualTotal = actualMaterials + actualLabor;
  const profit = estimated - actualTotal;
  const marginPct = estimated > 0 ? (profit / estimated) * 100 : 0;
  return {
    estimated_total: estimated,
    actual_materials: actualMaterials,
    actual_labor: actualLabor,
    actual_total: actualTotal,
    profit,
    margin_pct: marginPct,
  };
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

function JobDetailPage() {
  const job = Route.useLoaderData();
  const navigate = useNavigate();

  if (!job) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="mb-4 flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-gray-100">
          <svg className="h-8 w-8 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <p className="text-lg font-semibold text-gray-900">Job not found</p>
        <p className="mt-2 text-sm text-gray-500">This job may have been deleted or the link is incorrect.</p>
        <button
          type="button"
          onClick={() => navigate({ to: "/jobs" })}
          className="mt-6 inline-flex min-h-[44px] items-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
        >
          Back to Jobs
        </button>
      </div>
    );
  }

  const financials = computeFinancials(job);
  const estimated = financials.estimated_total;
  const actualTotal = financials.actual_total;
  const diff = estimated - actualTotal;
  const isProfitable = diff >= 0;
  const diffPct =
    estimated > 0
      ? Math.abs((diff / estimated) * 100).toFixed(1)
      : "0.0";
  const hasActuals = actualTotal > 0;

  const [statusLoading, setStatusLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleStatusChange = async (newStatus: string) => {
    try {
      setStatusLoading(newStatus);
      setError(null);
      await updateJobStatus({
        data: { jobId: job.id, status: newStatus },
      });
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setStatusLoading(null);
    }
  };

  return (
    <div className="mx-auto max-w-lg">
      {/* --- Sticky Money Bar --- */}
      <div
        className={`sticky top-0 z-40 px-4 py-3 shadow-md ${
          isProfitable ? "bg-green-50 border-b border-green-200" : "bg-red-50 border-b border-red-200"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          {/* Estimated */}
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              Estimated
            </p>
            <p className="text-lg font-bold text-gray-900">
              {formatCurrency(estimated)}
            </p>
          </div>

          {/* Divider */}
          <div className="text-gray-300 text-lg font-light">|</div>

          {/* Actual */}
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              Actual
            </p>
            <p className="text-lg font-bold text-gray-900">
              {formatCurrency(actualTotal)}
            </p>
          </div>

          {/* Divider */}
          <div className="text-gray-300 text-lg font-light">|</div>

          {/* Difference */}
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              {isProfitable ? "Under" : "Over"}
            </p>
            <p
              className={`text-lg font-bold ${
                isProfitable ? "text-green-600" : "text-red-600"
              }`}
            >
              {isProfitable ? "+" : "−"}
              {formatCurrency(Math.abs(diff))}
            </p>
          </div>
        </div>
        {/* Percentage bar */}
        {hasActuals && estimated > 0 && (
          <div className="mt-2">
            <div className="flex justify-between text-[10px] font-medium text-gray-500 mb-0.5">
              <span>Budget</span>
              <span
                className={isProfitable ? "text-green-600" : "text-red-600"}
              >
                {isProfitable
                  ? `${diffPct}% under budget`
                  : `${diffPct}% over budget`}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  isProfitable ? "bg-green-500" : "bg-red-500"
                }`}
                style={{
                  width: `${Math.min(100, estimated > 0 ? (actualTotal / estimated) * 100 : 0)}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate({ to: "/jobs" })}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 active:bg-gray-200 transition-colors"
            aria-label="Back to jobs"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold tracking-tight text-gray-900">
              {job.job_number}
            </h1>
            <p className="text-sm text-gray-500">
              {job.client_name} · {formatDate(job.created_at)}
            </p>
          </div>
          <StatusBadge status={job.status} large />
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {/* Status Action Buttons */}
        <div className="mb-6">
          <div className="flex gap-2">
            {job.status !== "not_started" && (
              <button
                type="button"
                onClick={() => handleStatusChange("not_started")}
                disabled={statusLoading !== null}
                className="flex-1 min-h-[44px] rounded-lg bg-gray-100 px-3 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-200 active:bg-gray-300 disabled:opacity-50 transition-colors"
              >
                {statusLoading === "not_started" ? "..." : "Not Started"}
              </button>
            )}
            {job.status !== "in_progress" && (
              <button
                type="button"
                onClick={() => handleStatusChange("in_progress")}
                disabled={statusLoading !== null}
                className="flex-1 min-h-[44px] rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {statusLoading === "in_progress" ? "..." : "In Progress"}
              </button>
            )}
            {job.status !== "complete" && (
              <button
                type="button"
                onClick={() => handleStatusChange("complete")}
                disabled={statusLoading !== null}
                className="flex-1 min-h-[44px] rounded-lg bg-green-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-green-500 active:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {statusLoading === "complete" ? "..." : "Complete"}
              </button>
            )}
          </div>
        </div>

        {/* Materials Section */}
        <MaterialsSection jobId={job.id} materials={job.materials} />

        {/* Time Section */}
        <TimeSection jobId={job.id} timeEntries={job.time_entries} />

        {/* Profit Summary */}
        <ProfitSummary financials={financials} />

          {/* Invoices Section */}
          <InvoicesSection jobId={job.id} clientEmail={job.client_email || undefined} jobNumber={job.job_number} estimatedTotal={financials.estimated_total} actualTotal={financials.actual_total} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Materials Section
// ---------------------------------------------------------------------------

function MaterialsSection({ jobId, materials }: { jobId: string; materials: MaterialEntry[] }) {
  const [showForm, setShowForm] = useState(false);
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalMaterials = materials.reduce((sum, m) => sum + m.cost, 0);

  const handleAdd = async () => {
    const costNum = parseFloat(cost);
    if (!description.trim()) {
      setError("Description is required");
      return;
    }
    if (isNaN(costNum) || costNum < 0) {
      setError("Enter a valid cost");
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await addMaterial({
        data: {
          jobId,
          description: description.trim(),
          cost: costNum,
          receipt_url: receiptUrl.trim() || undefined,
        },
      });
      // Re-fetch will happen on reload
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add material");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-900">
          Materials
        </h2>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 min-h-[32px] px-2"
        >
          {showForm ? "Cancel" : "+ Add Material"}
        </button>
      </div>

      {/* Inline Add Form */}
      {showForm && (
        <div className="mb-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          {error && (
            <p className="mb-2 text-xs font-medium text-red-600">{error}</p>
          )}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. 2x4 lumber, PVC pipe"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Cost ($)
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Receipt URL <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="url"
                value={receiptUrl}
                onChange={(e) => setReceiptUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={saving}
              className="w-full min-h-[44px] rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : "Add Material"}
            </button>
          </div>
        </div>
      )}

      {/* Materials List */}
      {materials.length === 0 ? (
        <p className="text-sm text-gray-400 py-3">No materials logged yet</p>
      ) : (
        <div className="space-y-2">
          {materials.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {m.description}
                </p>
                <p className="text-xs text-gray-400">
                  {formatDateShort(m.purchased_at)}
                </p>
                {m.receipt_url && (
                  <a
                    href={m.receipt_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-600 hover:text-indigo-500 underline mt-0.5 inline-block"
                  >
                    View receipt
                  </a>
                )}
              </div>
              <span className="text-sm font-semibold text-gray-900 shrink-0">
                {formatCurrency(m.cost)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Running total */}
      {materials.length > 0 && (
        <div className="mt-2 flex justify-end">
          <span className="text-xs font-semibold text-gray-500">
            Materials total: {formatCurrency(totalMaterials)}
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Time Section
// ---------------------------------------------------------------------------

function TimeSection({ jobId, timeEntries: entries }: { jobId: string; timeEntries: TimeEntry[] }) {
  const [showForm, setShowForm] = useState(false);
  const [hours, setHours] = useState("");
  const [hourlyRate, setHourlyRate] = useState("75");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalLabor = entries.reduce((sum, t) => sum + t.total_cost, 0);
  const totalHours = entries.reduce((sum, t) => sum + t.hours, 0);

  const handleAdd = async () => {
    const hoursNum = parseFloat(hours);
    const rateNum = parseFloat(hourlyRate);
    if (isNaN(hoursNum) || hoursNum <= 0) {
      setError("Enter valid hours");
      return;
    }
    if (isNaN(rateNum) || rateNum <= 0) {
      setError("Enter a valid hourly rate");
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await addTimeEntry({
        data: {
          jobId,
          hours: hoursNum,
          hourly_rate: rateNum,
          notes: notes.trim() || undefined,
        },
      });
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add time entry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-900">
          Time Logged
        </h2>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 min-h-[32px] px-2"
        >
          {showForm ? "Cancel" : "+ Log Time"}
        </button>
      </div>

      {/* Inline Add Form */}
      {showForm && (
        <div className="mb-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          {error && (
            <p className="mb-2 text-xs font-medium text-red-600">{error}</p>
          )}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Hours
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="0.0"
                step="0.25"
                min="0"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Hourly Rate ($)
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                placeholder="75.00"
                step="0.50"
                min="0"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Notes <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Demolition and prep"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            {/* Preview */}
            {hours && parseFloat(hours) > 0 && hourlyRate && parseFloat(hourlyRate) > 0 && (
              <p className="text-xs font-medium text-gray-600">
                Total: {formatCurrency(parseFloat(hours) * parseFloat(hourlyRate))}
              </p>
            )}
            <button
              type="button"
              onClick={handleAdd}
              disabled={saving}
              className="w-full min-h-[44px] rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : "Log Time"}
            </button>
          </div>
        </div>
      )}

      {/* Time Entries List */}
      {entries.length === 0 ? (
        <p className="text-sm text-gray-400 py-3">No time logged yet</p>
      ) : (
        <div className="space-y-2">
          {entries.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {Number(t.hours)} hr
                  </span>
                  <span className="text-xs text-gray-400">
                    @ {formatCurrency(t.hourly_rate)}/hr
                  </span>
                </div>
                {t.notes && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{t.notes}</p>
                )}
                <p className="text-xs text-gray-400 mt-0.5">
                  {formatDateShort(t.logged_at)}
                </p>
              </div>
              <span className="text-sm font-semibold text-gray-900 shrink-0">
                {formatCurrency(t.total_cost)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Running total */}
      {entries.length > 0 && (
        <div className="mt-2 flex justify-end gap-4">
          <span className="text-xs text-gray-400">
            {Number(totalHours).toFixed(1)} hrs
          </span>
          <span className="text-xs font-semibold text-gray-500">
            Labor total: {formatCurrency(totalLabor)}
          </span>
        </div>
      )}
    </div>
  );
}
// ---------------------------------------------------------------------------
// Invoices Section
// ---------------------------------------------------------------------------

function InvoicesSection({
  jobId,
  clientEmail,
  jobNumber,
  estimatedTotal,
  actualTotal,
}: {
  jobId: string;
  clientEmail?: string;
  jobNumber: string;
  estimatedTotal: number;
  actualTotal: number;
}) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [customerEmail, setCustomerEmail] = useState(clientEmail || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Load invoices on mount
  useEffect(() => {
    getInvoices({ data: { jobId } }).then((data) => {
      setInvoices(data);
      setLoading(false);
    });
  }, []);

  const handleCreate = async () => {
    const amountDollars = parseFloat(amount);
    if (!description.trim()) {
      setError("Description is required");
      return;
    }
    if (isNaN(amountDollars) || amountDollars <= 0) {
      setError("Enter a valid amount");
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const newInvoice = await createInvoiceForJob({
        data: {
          jobId,
          description: description.trim(),
          amountCents: Math.round(amountDollars * 100),
          customerEmail: customerEmail || undefined,
        },
      });
      setInvoices((prev) => [newInvoice, ...prev]);
      setSuccessMsg("Invoice " + newInvoice.invoice_number + " created!");
      setShowForm(false);
      setDescription("");
      setAmount("");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create invoice");
    } finally {
      setSaving(false);
    }
  };

  const openForm = () => {
    const remaining = Math.max(0, (estimatedTotal || actualTotal) - invoices
      .filter((inv) => inv.status !== "cancelled")
      .reduce((sum, inv) => sum + inv.amount_cents, 0) / 100);
    setDescription("Job " + jobNumber + " — Services");
    setAmount(remaining > 0 ? remaining.toFixed(2) : (estimatedTotal || actualTotal).toFixed(2));
    setCustomerEmail(clientEmail || "");
    setError(null);
    setShowForm(true);
  };

  const totalInvoiced = invoices
    .filter((inv) => inv.status !== "cancelled")
    .reduce((sum, inv) => sum + inv.amount_cents, 0) / 100;
  const totalPaid = invoices
    .filter((inv) => inv.status === "paid")
    .reduce((sum, inv) => sum + inv.amount_paid_cents, 0) / 100;

  return (
    <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-900">Invoices</h2>
        {!showForm && (
          <button
            type="button"
            onClick={openForm}
            className="inline-flex min-h-[40px] items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 active:bg-indigo-700 transition-colors"
          >
            + Create Invoice
          </button>
        )}
      </div>

      {/* Success message */}
      {successMsg && (
        <div className="mb-3 rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          {successMsg}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-3 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {/* Totals bar */}
      {invoices.length > 0 && (
        <div className="mb-3 flex gap-4 text-xs">
          <div className="flex-1 rounded-lg bg-gray-50 px-3 py-2 text-center">
            <p className="text-gray-500">Invoiced</p>
            <p className="font-semibold text-gray-900">{formatCurrency(totalInvoiced)}</p>
          </div>
          <div className="flex-1 rounded-lg bg-green-50 px-3 py-2 text-center">
            <p className="text-green-600">Paid</p>
            <p className="font-semibold text-green-700">{formatCurrency(totalPaid)}</p>
          </div>
          <div className="flex-1 rounded-lg bg-amber-50 px-3 py-2 text-center">
            <p className="text-amber-600">Outstanding</p>
            <p className="font-semibold text-amber-700">{formatCurrency(Math.max(0, totalInvoiced - totalPaid))}</p>
          </div>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50/50 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">New Invoice</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Plumbing repair services"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Amount ($)
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Customer Email <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="customer@example.com"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowForm(false); setError(null); }}
                className="flex-1 min-h-[44px] rounded-lg bg-gray-100 px-3 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-200 active:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={saving}
                className="flex-1 min-h-[44px] rounded-lg bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "Creating..." : "Send Invoice"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice list */}
      {/* Pending payment links banner */}
      {invoices.some((inv) => inv.needs_payment_link && !inv.stripe_payment_link && inv.status === 'unpaid') && (
        <div className="mb-3 rounded-lg bg-blue-50 px-4 py-2.5 text-xs font-medium text-blue-700 border border-blue-200">
          Payment links pending — they'll be generated shortly.
        </div>
      )}
      {loading ? (
        <p className="text-sm text-gray-400 py-3">Loading...</p>
      ) : invoices.length === 0 ? (
        <p className="text-sm text-gray-400 py-3">No invoices yet</p>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv) => (
            <div
              key={inv.id}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3"
            >
              {/* Top row: info + amount */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">
                      {inv.invoice_number}
                    </p>
                    <InvoiceStatusBadge status={inv.status} paidAt={inv.paid_at} />
                    <CopyInvoiceLinkButton invoiceId={inv.id} />
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {inv.description}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                    {inv.issued_at && <span>Issued {formatDateShort(inv.issued_at)}</span>}
                    {inv.paid_at && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>Paid {formatDateShort(inv.paid_at)}</span>
                      </>
                    )}
                  </div>
                </div>
                <span className="text-sm font-bold text-gray-900 shrink-0">
                  {formatCurrency(inv.amount_cents / 100)}
                </span>
              </div>

              {/* Action row */}
              {inv.status === 'unpaid' && inv.stripe_payment_link && (
                <a
                  href={inv.stripe_payment_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-lg bg-green-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-green-500 active:bg-green-700 transition-colors"
                >
                  Pay Now
                </a>
              )}

              {inv.status === 'unpaid' && !inv.stripe_payment_link && inv.needs_payment_link && (
                <div className="mt-3 flex min-h-[40px] items-center justify-center rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-500">
                  <svg className="mr-2 h-3.5 w-3.5 animate-spin text-gray-400" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Awaiting payment link...
                </div>
              )}

              {inv.status === 'unpaid' && (
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const result = await markInvoicePaid({ data: { invoiceId: inv.id } });
                      if (result) {
                        setInvoices((prev) =>
                          prev.map((i) =>
                            i.id === inv.id
                              ? { ...i, status: 'paid', paid_at: result.paid_at, amount_paid_cents: result.amount_paid_cents, needs_payment_link: result.needs_payment_link }
                              : i
                          )
                        );
                      }
                    }}
                    className="flex-1 min-h-[36px] rounded-lg bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-100 active:bg-green-200 transition-colors border border-green-200"
                  >
                    Mark as Paid
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const result = await cancelInvoice({ data: { invoiceId: inv.id } });
                      if (result) {
                        setInvoices((prev) =>
                          prev.map((i) =>
                            i.id === inv.id
                              ? { ...i, status: 'cancelled', needs_payment_link: result.needs_payment_link }
                              : i
                          )
                        );
                      }
                    }}
                    className="min-h-[36px] rounded-lg bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors border border-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {inv.status === 'paid' && (
                <div className="mt-3 flex items-center justify-center rounded-lg bg-green-50 px-3 py-2">
                  <svg className="h-4 w-4 text-green-600 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span className="text-xs font-semibold text-green-700">
                    Paid {inv.paid_at ? formatDateShort(inv.paid_at) : ''}
                  </span>
                </div>
              )}

              {inv.status === 'cancelled' && (
                <div className="mt-3 flex items-center justify-center rounded-lg bg-gray-50 px-3 py-2">
                  <span className="text-xs font-semibold text-gray-500">Cancelled</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Copy Invoice Share Link Button
// ---------------------------------------------------------------------------
function CopyInvoiceLinkButton({ invoiceId }: { invoiceId: string }) {
  const [copied, setCopied] = useState(false);

  const shareUrl = `${window.location.origin}/share/invoice/${invoiceId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement("input");
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center justify-center rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 active:bg-gray-200 transition-colors"
      aria-label="Copy share link"
      title="Copy share link"
    >
      {copied ? (
        <svg className="h-3.5 w-3.5 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
}

function InvoiceStatusBadge({ status, paidAt }: { status: string; paidAt?: string | null }) {
  const colors: Record<string, string> = {
    unpaid: "bg-amber-100 text-amber-800",
    paid: "bg-green-100 text-green-800",
    cancelled: "bg-gray-100 text-gray-600",
  };
  const color = colors[status] || "bg-gray-100 text-gray-800";
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span
      className={"inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide " + color}
    >
      {label}
    </span>
  );
}
// ---------------------------------------------------------------------------// ---------------------------------------------------------------------------
// Profit Summary Section
// ---------------------------------------------------------------------------

function ProfitSummary({ financials }: { financials: JobFinancials }) {
  const { estimated_total, actual_materials, actual_labor, actual_total, profit, margin_pct } = financials;
  const isProfitable = profit >= 0;

  return (
    <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
      <h2 className="mb-3 text-base font-semibold text-gray-900">
        Profit Summary
      </h2>
      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Estimated Total</span>
          <span className="text-gray-900 font-medium">
            {formatCurrency(estimated_total)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Actual Materials</span>
          <span className="text-gray-700">
            {formatCurrency(actual_materials)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Actual Labor</span>
          <span className="text-gray-700">
            {formatCurrency(actual_labor)}
          </span>
        </div>
        <div className="border-t border-gray-100 pt-1.5 mt-1.5 flex justify-between">
          <span className="text-gray-500">Actual Total</span>
          <span className="text-gray-900 font-semibold">
            {formatCurrency(actual_total)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Profit / Loss</span>
          <span
            className={`text-base font-bold ${
              isProfitable ? "text-green-600" : "text-red-600"
            }`}
          >
            {isProfitable ? "+" : "−"}
            {formatCurrency(Math.abs(profit))}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Profit Margin</span>
          <span
            className={`text-sm font-semibold ${
              isProfitable ? "text-green-600" : "text-red-600"
            }`}
          >
            {isProfitable ? "+" : ""}
            {margin_pct.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status Badge
// ---------------------------------------------------------------------------

function StatusBadge({
  status,
  large,
}: {
  status: string;
  large?: boolean;
}) {
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
      className={`inline-flex items-center rounded-full font-semibold uppercase tracking-wide ${color} ${
        large ? "px-3 py-1 text-xs" : "px-2 py-0.5 text-[10px]"
      }`}
    >
      {label}
    </span>
  );
}
