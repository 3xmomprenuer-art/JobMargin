import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { sql } from "~/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EstimateDetail {
  id: string;
  estimate_number: string;
  status: string;
  notes: string | null;
  labor_rate: number;
  markup_pct: number;
  estimated_total: number | null;
  created_at: string;
  updated_at: string;
  client_id: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  client_address: string | null;
  line_items: LineItemDetail[];
}

interface LineItemDetail {
  id: string;
  description: string;
  quantity: number;
  unit_cost: number;
  labor_hours: number;
  materials_cost: number;
  markup_pct: number | null;
  line_total: number;
  sort_order: number;
}

// ---------------------------------------------------------------------------
// Server functions
// ---------------------------------------------------------------------------

const getEstimate = createServerFn({ method: "GET" })
  .validator((data: unknown) => data as { estimateId: string })
  .handler(async ({ data: { estimateId } }) => {
    try {
    const estRows = await sql`
      SELECT e.id, e.estimate_number, e.status, e.notes, e.labor_rate, e.markup_pct,
             e.estimated_total, e.created_at, e.updated_at, e.client_id,
             c.name AS client_name, c.email AS client_email,
             c.phone AS client_phone, c.address AS client_address
      FROM estimates e
      JOIN clients c ON e.client_id = c.id
      WHERE e.id = ${estimateId}
    `;
    if (estRows.length === 0) return null;
    const est = estRows[0];

    const itemRows = await sql`
      SELECT id, description, quantity, unit_cost, labor_hours, materials_cost,
             markup_pct, line_total, sort_order
      FROM estimate_line_items
      WHERE estimate_id = ${estimateId}
      ORDER BY sort_order ASC
    `;

    return {
      ...est,
      created_at: String(est.created_at),
      updated_at: String(est.updated_at),
      line_items: itemRows.map((r) => ({ ...r })),
    } as EstimateDetail;
    } catch {
      return null;
    }
  });

const updateStatus = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as { estimateId: string; status: string };
    if (!["draft", "sent", "accepted", "declined"].includes(d.status)) {
      throw new Error("Invalid status");
    }
    return d;
  })
  .handler(async ({ data: { estimateId, status } }) => {
    await sql`
      UPDATE estimates SET status = ${status}, updated_at = NOW()
      WHERE id = ${estimateId}
    `;
    return { success: true };
  });

const convertToJob = createServerFn({ method: "POST" })
  .validator((data: unknown) => data as { estimateId: string })
  .handler(async ({ data: { estimateId } }) => {
    // Get the estimate
    const estRows = await sql`
      SELECT id, client_id, estimated_total, estimate_number FROM estimates WHERE id = ${estimateId}
    `;
    if (estRows.length === 0) return null;
    const est = estRows[0];

    // Generate job number
    const numRows = await sql`
      SELECT COALESCE(
        MAX(NULLIF(REGEXP_REPLACE(job_number, '[^0-9]', '', 'g'), '')::int),
        0
      ) + 1 AS next_num
      FROM jobs
    `;
    const nextNum = Number(numRows[0].next_num);
    const jobNumber = `JOB-${String(nextNum).padStart(3, "0")}`;

    // Create job
    const jobRows = await sql`
      INSERT INTO jobs (estimate_id, client_id, status, job_number, estimated_total)
      VALUES (${estimateId}, ${est.client_id}, 'not_started', ${jobNumber}, ${est.estimated_total})
      RETURNING id
    `;

    return { jobId: jobRows[0].id };
  });

export const Route = createFileRoute("/estimates/$estimateId")({
  loader: ({ params }) =>
    getEstimate({ data: { estimateId: params.estimateId } }),
  component: EstimateDetailPage,
  notFoundComponent: () => <div className="mx-auto max-w-lg px-4 py-16 text-center"><p className="text-lg font-semibold text-gray-900">Estimate not found</p><p className="mt-2 text-sm text-gray-500">This estimate may have been deleted or the link is incorrect.</p></div>,
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

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

function EstimateDetailPage() {
  const estimate = Route.useLoaderData();
  const navigate = useNavigate();

  if (!estimate) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="mb-4 flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-gray-100">
          <svg className="h-8 w-8 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <p className="text-lg font-semibold text-gray-900">Estimate not found</p>
        <p className="mt-2 text-sm text-gray-500">This estimate may have been deleted or the link is incorrect.</p>
        <button
          type="button"
          onClick={() => navigate({ to: "/estimates" })}
          className="mt-6 inline-flex min-h-[44px] items-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
        >
          Back to Estimates
        </button>
      </div>
    );
  }
  const [statusLoading, setStatusLoading] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStatusChange = async (newStatus: string) => {
    try {
      setStatusLoading(newStatus);
      setError(null);
      await updateStatus({
        data: { estimateId: estimate.id, status: newStatus },
      });
      // Reload the page to reflect new status
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setStatusLoading(null);
    }
  };

  const handleConvertToJob = async () => {
    try {
      setConverting(true);
      setError(null);
      const result = await convertToJob({
        data: { estimateId: estimate.id },
      });
      navigate({
        to: "/jobs",
        // We'll navigate to jobs list for now since /jobs/$jobId doesn't exist yet
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to convert to job");
    } finally {
      setConverting(false);
    }
  };

  // Compute totals breakdown
  const subtotalBeforeMarkup = estimate.line_items.reduce((sum, item) => {
    return (
      sum +
      item.quantity * item.unit_cost +
      item.labor_hours * estimate.labor_rate +
      item.materials_cost
    );
  }, 0);

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate({ to: "/estimates" })}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 active:bg-gray-200 transition-colors"
          aria-label="Back to estimates"
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
            {estimate.estimate_number}
          </h1>
          <p className="text-sm text-gray-500">{formatDate(estimate.created_at)}</p>
        </div>
        <StatusBadge status={estimate.status} large />
      </div>

      {/* Client info */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Client
        </h2>
        <p className="text-base font-semibold text-gray-900">
          {estimate.client_name}
        </p>
        {(estimate.client_email || estimate.client_phone || estimate.client_address) && (
          <div className="mt-1 space-y-0.5 text-sm text-gray-500">
            {estimate.client_email && <p>{estimate.client_email}</p>}
            {estimate.client_phone && <p>{estimate.client_phone}</p>}
            {estimate.client_address && <p>{estimate.client_address}</p>}
          </div>
        )}
      </div>

      {/* Notes */}
      {estimate.notes && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Notes
          </h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">
            {estimate.notes}
          </p>
        </div>
      )}

      {/* Line items */}
      <div className="mb-6">
        <h2 className="mb-3 text-base font-semibold text-gray-900">
          Line Items
        </h2>
        <div className="space-y-2">
          {estimate.line_items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-gray-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">
                    {item.description}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
                    <span>Qty: {Number(item.quantity)}</span>
                    {Number(item.unit_cost) > 0 && (
                      <span>Unit: {formatCurrency(Number(item.unit_cost))}</span>
                    )}
                    {Number(item.labor_hours) > 0 && (
                      <span>
                        Labor: {Number(item.labor_hours)} hr
                        {Number(item.labor_hours) > 0
                          ? ` (${formatCurrency(Number(item.labor_hours) * estimate.labor_rate)})`
                          : ""}
                      </span>
                    )}
                    {Number(item.materials_cost) > 0 && (
                      <span>
                        Materials: {formatCurrency(Number(item.materials_cost))}
                      </span>
                    )}
                    {item.markup_pct !== null && Number(item.markup_pct) > 0 && (
                      <span>Markup: {Number(item.markup_pct)}%</span>
                    )}
                  </div>
                </div>
                <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                  {formatCurrency(Number(item.line_total))}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Totals breakdown */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-base font-semibold text-gray-900">Totals</h2>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Subtotal (before markup)</span>
            <span className="text-gray-700">
              {formatCurrency(subtotalBeforeMarkup)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">
              Markup ({Number(estimate.markup_pct)}%)
            </span>
            <span className="text-gray-700">
              {formatCurrency(
                subtotalBeforeMarkup * (Number(estimate.markup_pct) / 100)
              )}
            </span>
          </div>
          <div className="border-t border-gray-100 pt-1.5 flex justify-between">
            <span className="font-semibold text-gray-900">Estimate Total</span>
            <span className="text-lg font-bold text-indigo-600">
              {formatCurrency(Number(estimate.estimated_total))}
            </span>
          </div>
        </div>
      </div>

      {/* Status actions */}
      <div className="mb-6">
        <h2 className="mb-3 text-base font-semibold text-gray-900">Status</h2>
        <div className="flex flex-wrap gap-2">
          {estimate.status === "draft" && (
            <button
              type="button"
              onClick={() => handleStatusChange("sent")}
              disabled={statusLoading === "sent"}
              className="flex min-h-[44px] items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {statusLoading === "sent" ? (
                "Marking..."
              ) : (
                <>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polyline points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                  Mark as Sent
                </>
              )}
            </button>
          )}
          {estimate.status === "sent" && (
            <>
              <button
                type="button"
                onClick={() => handleStatusChange("accepted")}
                disabled={statusLoading === "accepted"}
                className="flex min-h-[44px] items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-green-500 active:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {statusLoading === "accepted" ? (
                  "Accepting..."
                ) : (
                  <>
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Accept
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange("declined")}
                disabled={statusLoading === "declined"}
                className="flex min-h-[44px] items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-500 active:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {statusLoading === "declined" ? (
                  "Declining..."
                ) : (
                  <>
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                    Decline
                  </>
                )}
              </button>
            </>
          )}
          {estimate.status === "declined" && (
            <button
              type="button"
              onClick={() => handleStatusChange("draft")}
              disabled={statusLoading === "draft"}
              className="flex min-h-[44px] items-center gap-2 rounded-lg bg-gray-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-gray-500 active:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {statusLoading === "draft" ? "Reverting..." : "↩ Revert to Draft"}
            </button>
          )}
        </div>
      </div>

      {/* Convert to Job */}
      {estimate.status === "accepted" && (
        <div className="mb-6 rounded-xl border-2 border-dashed border-green-300 bg-green-50 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <svg
                className="h-5 w-5 text-green-600"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-900">
                Ready to start the job?
              </p>
              <p className="mt-1 text-xs text-green-700">
                Convert this accepted estimate into a job to track actual costs
                and time.
              </p>
              <button
                type="button"
                onClick={handleConvertToJob}
                disabled={converting}
                className="mt-3 flex min-h-[44px] items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-green-500 active:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {converting ? "Converting..." : "Convert to Job"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({
  status,
  large,
}: {
  status: string;
  large?: boolean;
}) {
  const colors: Record<string, string> = {
    draft: "bg-amber-100 text-amber-800",
    sent: "bg-blue-100 text-blue-800",
    accepted: "bg-green-100 text-green-800",
    declined: "bg-red-100 text-red-800",
  };
  const color = colors[status] || "bg-gray-100 text-gray-800";

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold uppercase tracking-wide ${color} ${
        large ? "px-3 py-1 text-xs" : "px-2 py-0.5 text-[10px]"
      }`}
    >
      {status}
    </span>
  );
}
