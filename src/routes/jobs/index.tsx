import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface JobRow {
  id: string;
  job_number: string;
  status: string;
  estimated_total: number | null;
  actual_materials_cost: number;
  actual_labor_cost: number;
  actual_total: number;
  created_at: string;
  client_name: string;
}

// ---------------------------------------------------------------------------
// Server functions
// ---------------------------------------------------------------------------

const getJobs = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const rows = await sql`
      SELECT
        j.id,
        j.job_number,
        j.status,
        j.estimated_total,
        j.actual_materials_cost,
        j.actual_labor_cost,
        j.created_at,
        c.name AS client_name,
        COALESCE(
          (SELECT SUM(cost) FROM job_materials WHERE job_id = j.id), 0
        ) AS materials_sum,
        COALESCE(
          (SELECT SUM(total_cost) FROM job_time_entries WHERE job_id = j.id), 0
        ) AS labor_sum
      FROM jobs j
      JOIN clients c ON j.client_id = c.id
      ORDER BY j.created_at DESC
    `;
    return rows.map((r) => ({
      id: String(r.id),
      job_number: String(r.job_number),
      status: String(r.status),
      estimated_total: r.estimated_total ? Number(r.estimated_total) : null,
      actual_materials_cost: Number(r.materials_sum),
      actual_labor_cost: Number(r.labor_sum),
      actual_total: Number(r.materials_sum) + Number(r.labor_sum),
      created_at: String(r.created_at),
      client_name: String(r.client_name),
    })) as JobRow[];
  } catch {
    return [] as JobRow[];
  }
});

export const Route = createFileRoute("/jobs/")({
  loader: () => getJobs(),
  component: JobsPage,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

function JobsPage() {
  const jobs = Route.useLoaderData();

  // Group by status
  const grouped: Record<string, JobRow[]> = {
    in_progress: [],
    not_started: [],
    complete: [],
  };
  for (const job of jobs) {
    if (grouped[job.status]) grouped[job.status].push(job);
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Jobs
        </h1>
      </div>

      {jobs.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-6">
          {(
            [
              ["in_progress", "In Progress"],
              ["not_started", "Not Started"],
              ["complete", "Complete"],
            ] as const
          ).map(([status, label]) => {
            const items = grouped[status];
            if (items.length === 0) return null;
            return (
              <section key={status}>
                <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <StatusDot status={status} />
                  <span>{label}</span>
                  <span className="text-gray-400">({items.length})</span>
                </h2>
                <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100 bg-white">
                  {items.map((job) => (
                    <JobRowItem key={job.id} job={job} />
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
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
        </svg>
      </div>
      <p className="mb-1 text-lg font-semibold text-gray-900">
        No jobs yet
      </p>
      <p className="mb-6 text-sm text-gray-500">
        Create an estimate and accept it to get started
      </p>
      <Link
        to="/estimates"
        className="inline-flex min-h-[48px] items-center rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 active:bg-indigo-700 transition-colors"
      >
        Go to Estimates
      </Link>
    </div>
  );
}

function JobRowItem({ job }: { job: JobRow }) {
  const created = new Date(job.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  const estimated = job.estimated_total;
  const actual = job.actual_total;
  const diff = estimated !== null ? estimated - actual : -actual;
  const isProfitable = diff >= 0;

  return (
    <li>
      <Link
        to="/jobs/$jobId"
        params={{ jobId: job.id }}
        className="flex min-h-[60px] items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-sm font-semibold text-gray-900">
            {job.job_number}
          </span>
          <span className="text-xs text-gray-500 truncate">
            {job.client_name} · {created}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex flex-col items-end gap-0.5">
            {estimated !== null && (
              <span className="text-xs text-gray-500">
                Est: {formatCurrency(estimated)}
              </span>
            )}
            {actual > 0 && (
              <span
                className={`text-xs font-semibold ${
                  isProfitable ? "text-green-600" : "text-red-600"
                }`}
              >
                {isProfitable ? "+" : "−"}
                {formatCurrency(Math.abs(diff))}
              </span>
            )}
          </div>
          <StatusBadge status={job.status} />
        </div>
      </Link>
    </li>
  );
}

function StatusBadge({ status }: { status: string }) {
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
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${color}`}
    >
      {label}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    not_started: "bg-gray-400",
    in_progress: "bg-blue-500",
    complete: "bg-green-500",
  };
  return (
    <span className={`inline-block h-2 w-2 rounded-full ${colors[status] || "bg-gray-400"}`} />
  );
}
