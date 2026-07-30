import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState, useRef, useEffect } from "react";
import { sql } from "~/db";

// ---------------------------------------------------------------------------
// Server function
// ---------------------------------------------------------------------------

interface ClientInput {
  name: string;
  email: string;
  phone: string;
  address: string;
}

interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
}

const createClient = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as ClientInput;
    if (!d.name || typeof d.name !== "string" || d.name.trim().length === 0) {
      throw new Error("Client name is required");
    }
    return {
      name: d.name.trim(),
      email: (d.email || "").trim() || null,
      phone: (d.phone || "").trim() || null,
      address: (d.address || "").trim() || null,
    } as ClientInput;
  })
  .handler(async ({ data }) => {
    const rows = await sql`
      INSERT INTO clients (name, email, phone, address)
      VALUES (${data.name}, ${data.email}, ${data.phone}, ${data.address})
      RETURNING id, name, email, phone, address, created_at, updated_at
    `;
    const r = rows[0];
    return {
      ...r,
      created_at: String(r.created_at),
      updated_at: String(r.updated_at),
    } as Client;
  });

export const Route = createFileRoute("/clients/new")({
  component: NewClientPage,
});

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

function NewClientPage() {
  const navigate = useNavigate();
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Auto-focus on the name field when the component mounts
    requestAnimationFrame(() => nameRef.current?.focus());
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Client name is required");
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await createClient({
        data: { name: trimmedName, email, phone, address },
      });
      navigate({ to: "/clients" });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save client"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate({ to: "/clients" })}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 active:bg-gray-200 transition-colors"
          aria-label="Back to clients"
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
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          New Client
        </h1>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Name — required */}
        <div>
          <label
            htmlFor="name"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Name <span className="text-red-500">*</span>
          </label>
          <input
            ref={nameRef}
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Jane Smith"
            required
            className="block w-full min-h-[48px] rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        {/* Email */}
        <div>
          <label
            htmlFor="email"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@example.com"
            inputMode="email"
            className="block w-full min-h-[48px] rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        {/* Phone */}
        <div>
          <label
            htmlFor="phone"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Phone
          </label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(555) 123-4567"
            inputMode="tel"
            className="block w-full min-h-[48px] rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        {/* Address */}
        <div>
          <label
            htmlFor="address"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Address
          </label>
          <input
            id="address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="123 Main St, Springfield, IL"
            className="block w-full min-h-[48px] rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="mt-6 flex w-full min-h-[48px] items-center justify-center rounded-lg bg-indigo-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-indigo-500 active:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : "Save Client"}
        </button>
      </form>
    </div>
  );
}
