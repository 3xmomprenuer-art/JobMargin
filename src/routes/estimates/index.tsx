import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";
import { getCurrentUser } from "~/lib/auth";

// ---------------------------------------------------------------------------
// Server functions
// ---------------------------------------------------------------------------

interface EstimateRow {
  id: string;
  estimate_number: string;
  status: string;
  estimated_total: number | null;
  notes: string | null;
  created_at: string;
  client_name: string;
}

const getEstimates = createServerFn({ method: "GET" }).handler(async () => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  const userId = user.id;
  try {
    const rows = await sql`
      SELECT e.id, e.estimate_number, e.status, e.estimated_total, e.notes, e.created_at,
             c.name AS client_name
      FROM estimates e
      JOIN clients c ON e.client_id = c.id
      WHERE e.user_id = ${userId}
      ORDER BY e.created_at DESC
    `;
    return rows.map((r) => ({
      ...r,
      created_at: String(r.created_at),
    })) as EstimateRow[];
  } catch {
    return [] as EstimateRow[];
  }
});

export const Route = createFileRoute("/estimates/")({
  loader: () => getEstimates(),
  component: EstimatesPage,
});

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

function EstimatesPage() {
  const estimates = Route.useLoaderData();

  // Group by status
  const grouped: Record<string, EstimateRow[]> = {
    draft: [],
    sent: [],
    accepted: [],
    declined: [],
  };
  for (const est of estimates) {
    if (grouped[est.status]) grouped[est.status].push(est);
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Estimates
        </h1>
        <Link
          to="/estimates/new"
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 active:bg-indigo-700 transition-colors"
        >
          + New
        </Link>
      </div>

      {estimates.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-6">
          {(["draft", "sent", "accepted", "declined"] as const).map((status) => {
            const items = grouped[status];
            if (items.length === 0) return null;
            return (
              <section key={status}>
                <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <StatusBadge status={status} />
                  <span>
                    {status === "draft"
                      ? "Drafts"
                      : status === "sent"
                        ? "Sent"
                        : status === "accepted"
                          ? "Accepted"
                          : "Declined"}
                  </span>
                  <span className="text-gray-400">({items.length})</span>
                </h2>
                <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100 bg-white">
                  {items.map((est) => (
                    <EstimateRow key={est.id} estimate={est} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50">
        <svg
          className="h-8 w-8 text-indigo-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      </div>
      <p className="mb-1 text-lg font-semibold text-gray-900">
        No estimates yet
      </p>
      <p className="mb-6 text-sm text-gray-500">
        Create your first one to get started
      </p>
      <Link
        to="/estimates/new"
        className="inline-flex min-h-[48px] items-center rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 active:bg-indigo-700 transition-colors"
      >
        + Create your first estimate
      </Link>
    </div>
  );
}

function EstimateRow({ estimate }: { estimate: EstimateRow }) {
  const total = estimate.estimated_total
    ? `$${Number(estimate.estimated_total).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "—";
  const created = new Date(estimate.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <li>
      <Link
        to="/estimates/$estimateId"
        params={{ estimateId: estimate.id }}
        className="flex min-h-[60px] items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-gray-900">
            {estimate.estimate_number}
          </span>
          <span className="text-xs text-gray-500">
            {estimate.client_name} · {created}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-900">{total}</span>
          <StatusBadge status={estimate.status} />
        </div>
      </Link>
    </li>
  );
}

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
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${color}`}
    >
      {status}
    </span>
  );
}
