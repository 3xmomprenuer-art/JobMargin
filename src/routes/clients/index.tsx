import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";
import { getCurrentUser } from "~/lib/auth";

// ---------------------------------------------------------------------------
// Server functions
// ---------------------------------------------------------------------------

interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
}

const getClients = createServerFn({ method: "GET" }).handler(async () => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  const userId = user.id;
  try {
    const rows = await sql`
      SELECT id, name, email, phone, address, created_at, updated_at
      FROM clients
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;
    return rows.map((r) => ({
      ...r,
      created_at: String(r.created_at),
      updated_at: String(r.updated_at),
    })) as Client[];
  } catch {
    // DATABASE_URL not set or table doesn't exist yet — return empty
    return [] as Client[];
  }
});

export const Route = createFileRoute("/clients/")({
  loader: () => getClients(),
  component: ClientsPage,
});

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

function ClientsPage() {
  const clients = Route.useLoaderData();

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Clients
        </h1>
        <Link
          to="/clients/new"
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 active:bg-indigo-700 transition-colors"
        >
          + Add
        </Link>
      </div>

      {/* Client list */}
      {clients.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100 bg-white">
          {clients.map((client) => (
            <ClientRow key={client.id} client={client} />
          ))}
        </ul>
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
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
        </svg>
      </div>
      <p className="mb-1 text-lg font-semibold text-gray-900">No clients yet</p>
      <p className="mb-6 text-sm text-gray-500">
        Add your first one to get started
      </p>
      <Link
        to="/clients/new"
        className="inline-flex min-h-[48px] items-center rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 active:bg-indigo-700 transition-colors"
      >
        + Add your first client
      </Link>
    </div>
  );
}

function ClientRow({ client }: { client: Client }) {
  const contact = client.email || client.phone || "—";
  const created = new Date(client.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <li className="flex min-h-[60px] flex-col justify-center gap-0.5 px-4 py-3 hover:bg-gray-50 transition-colors">
      <Link to="/clients/$clientId" params={{ clientId: client.id }} className="text-sm font-semibold text-indigo-600 hover:underline">{client.name}</Link>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
        <span>{contact}</span>
        {client.address && (
          <>
            <span aria-hidden="true">·</span>
            <span className="max-w-[160px] truncate">{client.address}</span>
          </>
        )}
        <span aria-hidden="true">·</span>
        <span>{created}</span>
      </div>
    </li>
  );
}
