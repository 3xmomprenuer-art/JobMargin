import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { sql } from "~/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface PublicEstimate {
  id: string;
  estimate_number: string;
  status: string;
  notes: string | null;
  labor_rate: number;
  markup_pct: number;
  estimated_total: number | null;
  created_at: string;
  client_name: string;
  client_email: string | null;
  line_items: {
    id: string;
    description: string;
    quantity: number;
    unit_cost: number;
    labor_hours: number;
    materials_cost: number;
    markup_pct: number | null;
    line_total: number;
    sort_order: number;
  }[];
}

// ---------------------------------------------------------------------------
// Server functions (public — no auth)
// ---------------------------------------------------------------------------
const getPublicEstimate = createServerFn({ method: "GET" })
  .validator((data: unknown) => data as { estimateId: string })
  .handler(async ({ data: { estimateId } }): Promise<PublicEstimate | null> => {
    try {
      const estRows = await sql`
        SELECT e.id, e.estimate_number, e.status, e.notes, e.labor_rate,
               e.markup_pct, e.estimated_total, e.created_at,
               c.name AS client_name, c.email AS client_email
        FROM estimates e
        JOIN clients c ON e.client_id = c.id
        WHERE e.id = ${estimateId}
      `;
      if (estRows.length === 0) return null;
      if (estRows[0].status === 'draft') return null;
      const est = estRows[0];

      const itemRows = await sql`
        SELECT id, description, quantity, unit_cost, labor_hours,
               materials_cost, markup_pct, line_total, sort_order
        FROM estimate_line_items
        WHERE estimate_id = ${estimateId}
        ORDER BY sort_order ASC
      `;

      return {
        id: String(est.id),
        estimate_number: String(est.estimate_number),
        status: String(est.status),
        notes: est.notes ? String(est.notes) : null,
        labor_rate: Number(est.labor_rate),
        markup_pct: Number(est.markup_pct),
        estimated_total: est.estimated_total ? Number(est.estimated_total) : null,
        created_at: String(est.created_at),
        client_name: String(est.client_name),
        client_email: est.client_email ? String(est.client_email) : null,
        line_items: itemRows.map((r) => ({
          id: String(r.id),
          description: String(r.description),
          quantity: Number(r.quantity),
          unit_cost: Number(r.unit_cost),
          labor_hours: Number(r.labor_hours),
          materials_cost: Number(r.materials_cost),
          markup_pct: r.markup_pct ? Number(r.markup_pct) : null,
          line_total: Number(r.line_total),
          sort_order: Number(r.sort_order),
        })),
      };
    } catch {
      return null;
    }
  });

const acceptEstimate = createServerFn({ method: "POST" })
  .validator((data: unknown) => data as { estimateId: string })
  .handler(async ({ data: { estimateId } }) => {
    try {
      // Verify the estimate exists and is in 'sent' status
      const estRows = await sql`
        SELECT id, client_id, estimated_total, estimate_number
        FROM estimates
        WHERE id = ${estimateId} AND status = 'sent'
      `;
      if (estRows.length === 0) return null;
      const est = estRows[0];

      // Mark estimate as accepted
      await sql`
        UPDATE estimates SET status = 'accepted', updated_at = NOW()
        WHERE id = ${estimateId}
      `;

      // Create a job
      const numRows = await sql`
        SELECT COALESCE(
          MAX(NULLIF(REGEXP_REPLACE(job_number, '[^0-9]', '', 'g'), '')::int),
          0
        ) + 1 AS next_num
        FROM jobs
      `;
      const nextNum = Number(numRows[0].next_num);
      const jobNumber = `JOB-${String(nextNum).padStart(3, "0")}`;

      const jobRows = await sql`
        INSERT INTO jobs (estimate_id, client_id, status, job_number, estimated_total)
        VALUES (${estimateId}, ${est.client_id}, 'not_started', ${jobNumber}, ${est.estimated_total})
        RETURNING id
      `;

      return {
        success: true,
        job_number: jobNumber,
        job_id: String(jobRows[0].id),
      };
    } catch {
      return null;
    }
  });

const declineEstimate = createServerFn({ method: "POST" })
  .validator((data: unknown) => data as { estimateId: string })
  .handler(async ({ data: { estimateId } }) => {
    try {
      const result = await sql`
        UPDATE estimates SET status = 'declined', updated_at = NOW()
        WHERE id = ${estimateId} AND status = 'sent'
        RETURNING id
      `;
      if (result.length === 0) return null;
      return { success: true };
    } catch {
      return null;
    }
  });

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------
export const Route = createFileRoute("/share/estimate/$estimateId")({
  loader: ({ params }) =>
    getPublicEstimate({ data: { estimateId: params.estimateId } }),
  component: PublicEstimatePage,
  notFoundComponent: () => (
    <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
      <div className="mb-4 mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
        <svg
          className="h-8 w-8 text-gray-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <p className="text-lg font-semibold text-gray-900">Estimate not found</p>
      <p className="mt-2 text-sm text-gray-500">
        This estimate may have been deleted or the link is incorrect.
      </p>
    </div>
  ),
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
function PublicEstimatePage() {
  const estimate = Route.useLoaderData();

  if (!estimate) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <div className="mb-4 mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <svg
            className="h-8 w-8 text-gray-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <p className="text-lg font-semibold text-gray-900">Estimate not found</p>
        <p className="mt-2 text-sm text-gray-500">
          This estimate may have been deleted or the link is incorrect.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Estimate Header Card */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-gray-900">
              JobMargin Estimate
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {estimate.estimate_number}
            </p>
            <p className="text-sm font-medium text-gray-700">
              {estimate.client_name}
            </p>
            <p className="text-xs text-gray-400">
              {formatDate(estimate.created_at)}
            </p>
          </div>
          <StatusBadge status={estimate.status} />
        </div>
      </div>

      {/* Line Items Card */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Line Items
        </h2>
        {estimate.line_items.length === 0 ? (
          <p className="text-sm text-gray-400 py-3">No line items</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {estimate.line_items.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {item.description}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                    <span>Qty: {Number(item.quantity)}</span>
                    {Number(item.unit_cost) > 0 && (
                      <span>Unit: {formatCurrency(Number(item.unit_cost))}</span>
                    )}
                    {Number(item.labor_hours) > 0 && (
                      <span>
                        Labor: {Number(item.labor_hours)} hr
                        ({formatCurrency(Number(item.labor_hours) * estimate.labor_rate)})
                      </span>
                    )}
                    {Number(item.materials_cost) > 0 && (
                      <span>Materials: {formatCurrency(Number(item.materials_cost))}</span>
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
            ))}
          </div>
        )}
      </div>

      {/* Totals Card */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Total
        </h2>
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium text-gray-700">Estimate Total</span>
          <span className="text-2xl font-bold text-indigo-600">
            {formatCurrency(Number(estimate.estimated_total))}
          </span>
        </div>
      </div>

      {/* Accepted confirmation */}
      {estimate.status === "accepted" && <AcceptedBanner />}

      {/* Declined notice */}
      {estimate.status === "declined" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center">
          <div className="mb-3 mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <svg
              className="h-6 w-6 text-red-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-red-800">
            This estimate has been declined.
          </p>
        </div>
      )}

      {/* Accept/Decline buttons (only when status is 'sent') */}
      {estimate.status === "sent" && (
        <AcceptDeclineSection estimateId={estimate.id} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Accept/Decline Section
// ---------------------------------------------------------------------------
function AcceptDeclineSection({ estimateId }: { estimateId: string }) {
  const [loading, setLoading] = useState<"accept" | "decline" | null>(null);
  const [result, setResult] = useState<{
    type: "accepted" | "declined";
    jobNumber?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (result?.type === "accepted") {
    return <AcceptedBanner jobNumber={result.jobNumber} />;
  }

  if (result?.type === "declined") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center">
        <div className="mb-3 mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <svg
            className="h-6 w-6 text-red-500"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-red-800">
          This estimate has been declined.
        </p>
      </div>
    );
  }

  const handleAccept = async () => {
    try {
      setLoading("accept");
      setError(null);
      const res = await acceptEstimate({ data: { estimateId } });
      if (res && res.success) {
        setResult({ type: "accepted", jobNumber: res.job_number });
      } else {
        setError("This estimate is no longer available for acceptance.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  const handleDecline = async () => {
    try {
      setLoading("decline");
      setError(null);
      const res = await declineEstimate({ data: { estimateId } });
      if (res && res.success) {
        setResult({ type: "declined" });
      } else {
        setError("This estimate is no longer available.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleAccept}
          disabled={loading !== null}
          className="flex-1 min-h-[52px] rounded-xl bg-green-600 px-4 py-3 text-base font-bold text-white shadow-sm hover:bg-green-500 active:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {loading === "accept" ? "Accepting..." : "Accept Estimate"}
        </button>
        <button
          type="button"
          onClick={handleDecline}
          disabled={loading !== null}
          className="flex-1 min-h-[52px] rounded-xl border-2 border-red-300 bg-white px-4 py-3 text-base font-bold text-red-600 hover:bg-red-50 active:bg-red-100 disabled:opacity-50 transition-colors"
        >
          {loading === "decline" ? "Declining..." : "Decline"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Accepted Banner
// ---------------------------------------------------------------------------
function AcceptedBanner({ jobNumber }: { jobNumber?: string }) {
  return (
    <div className="rounded-xl border-2 border-green-300 bg-green-50 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-100">
          <svg
            className="h-6 w-6 text-green-600"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div>
          <p className="text-base font-bold text-green-900">
            ✓ Estimate accepted — your job is confirmed!
          </p>
          {jobNumber && (
            <p className="mt-1 text-sm font-medium text-green-700">
              Job reference: {jobNumber}
            </p>
          )}
          <p className="mt-1 text-xs text-green-600">
            Your contractor will be in touch with next steps.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: "bg-amber-100 text-amber-800",
    sent: "bg-blue-100 text-blue-800",
    accepted: "bg-green-100 text-green-800",
    declined: "bg-red-100 text-red-800",
  };
  const color = colors[status] || "bg-gray-100 text-gray-800";
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${color}`}
    >
      {status}
    </span>
  );
}

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
