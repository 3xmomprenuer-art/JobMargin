import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface PublicInvoice {
  id: string;
  invoice_number: string;
  description: string;
  amount_cents: number;
  amount_paid_cents: number;
  status: string;
  stripe_payment_link: string | null;
  issued_at: string | null;
  paid_at: string | null;
  created_at: string;
  job_number: string;
  client_name: string;
}

// ---------------------------------------------------------------------------
// Server function (public — no auth)
// ---------------------------------------------------------------------------
const getPublicInvoice = createServerFn({ method: "GET" })
  .validator((data: unknown) => data as { invoiceId: string })
  .handler(async ({ data: { invoiceId } }): Promise<PublicInvoice | null> => {
    try {
      const rows = await sql`
        SELECT i.id, i.invoice_number, i.description, i.amount_cents,
               i.amount_paid_cents, i.status, i.stripe_payment_link,
               i.issued_at, i.paid_at, i.created_at,
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
        invoice_number: String(r.invoice_number),
        description: String(r.description),
        amount_cents: Number(r.amount_cents),
        amount_paid_cents: Number(r.amount_paid_cents),
        status: String(r.status),
        stripe_payment_link: r.stripe_payment_link
          ? String(r.stripe_payment_link)
          : null,
        issued_at: r.issued_at ? String(r.issued_at) : null,
        paid_at: r.paid_at ? String(r.paid_at) : null,
        created_at: String(r.created_at),
        job_number: String(r.job_number),
        client_name: String(r.client_name),
      };
    } catch {
      return null;
    }
  });

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------
export const Route = createFileRoute("/share/invoice/$invoiceId")({
  loader: ({ params }) =>
    getPublicInvoice({ data: { invoiceId: params.invoiceId } }),
  component: PublicInvoicePage,
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
      <p className="text-lg font-semibold text-gray-900">Invoice not found</p>
      <p className="mt-2 text-sm text-gray-500">
        This invoice may have been deleted or the link is incorrect.
      </p>
    </div>
  ),
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
function PublicInvoicePage() {
  const invoice = Route.useLoaderData();

  if (!invoice) {
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
        <p className="text-lg font-semibold text-gray-900">Invoice not found</p>
        <p className="mt-2 text-sm text-gray-500">
          This invoice may have been deleted or the link is incorrect.
        </p>
      </div>
    );
  }

  const amountDollars = invoice.amount_cents / 100;
  const isPaid = invoice.status === "paid";
  const isCancelled = invoice.status === "cancelled";

  return (
    <div className="space-y-4">
      {/* Invoice Header Card */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-gray-900">
              Invoice from {invoice.client_name}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {invoice.invoice_number}
            </p>
            {invoice.job_number && (
              <p className="text-xs text-gray-400">
                Job: {invoice.job_number}
              </p>
            )}
          </div>
          <InvoiceStatusBadge status={invoice.status} />
        </div>
      </div>

      {/* Invoice Details Card */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Invoice Details
        </h2>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Description</span>
            <span className="text-sm font-medium text-gray-900 text-right max-w-[60%]">
              {invoice.description}
            </span>
          </div>
          {invoice.issued_at && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Issued</span>
              <span className="text-sm text-gray-900">
                {formatDate(invoice.issued_at)}
              </span>
            </div>
          )}
          {invoice.paid_at && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Paid</span>
              <span className="text-sm text-gray-900">
                {formatDate(invoice.paid_at)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Amount Card */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium text-gray-700">Amount Due</span>
          <span className="text-2xl font-bold text-indigo-600">
            {formatCurrency(amountDollars)}
          </span>
        </div>
        {isPaid && invoice.amount_paid_cents > 0 && (
          <div className="mt-2 flex items-baseline justify-between text-sm">
            <span className="text-gray-500">Amount Paid</span>
            <span className="font-medium text-green-700">
              {formatCurrency(invoice.amount_paid_cents / 100)}
            </span>
          </div>
        )}
      </div>

      {/* Paid confirmation */}
      {isPaid && (
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
                ✓ Paid
              </p>
              {invoice.paid_at && (
                <p className="mt-1 text-sm text-green-700">
                  Paid on {formatDate(invoice.paid_at)}
                </p>
              )}
              <p className="mt-1 text-xs text-green-600">
                Thank you for your payment!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Cancelled notice */}
      {isCancelled && (
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
            This invoice has been cancelled.
          </p>
        </div>
      )}

      {/* Pay Now button */}
      {!isPaid && !isCancelled && invoice.stripe_payment_link && (
        <a
          href={invoice.stripe_payment_link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-[56px] w-full items-center justify-center rounded-xl bg-green-600 px-4 py-3 text-lg font-bold text-white shadow-sm hover:bg-green-500 active:bg-green-700 transition-colors"
        >
          <svg
            className="mr-2 h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
            <line x1="1" y1="10" x2="23" y2="10" />
          </svg>
          Pay Now
        </a>
      )}

      {/* No payment link yet */}
      {!isPaid && !isCancelled && !invoice.stripe_payment_link && (
        <div className="rounded-xl bg-gray-100 p-5 text-center">
          <p className="text-sm font-medium text-gray-600">
            This invoice is being prepared. A payment link will be available soon.
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Please check back shortly or contact {invoice.client_name}.
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function InvoiceStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    unpaid: "bg-amber-100 text-amber-800",
    paid: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
  };
  const labels: Record<string, string> = {
    unpaid: "Unpaid",
    paid: "Paid",
    cancelled: "Cancelled",
  };
  const color = colors[status] || "bg-gray-100 text-gray-800";
  const label = labels[status] || status;
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${color}`}
    >
      {label}
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
