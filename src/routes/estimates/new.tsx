import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState, useEffect, useCallback } from "react";
import { sql } from "~/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClientOption {
  id: string;
  name: string;
}

interface LineItem {
  key: string; // client-side unique key for React
  description: string;
  quantity: number;
  unit_cost: number;
  labor_hours: number;
  materials_cost: number;
  markup_pct: number;
}

interface EstimateInput {
  client_id: string;
  notes: string;
  labor_rate: number;
  markup_pct: number;
  line_items: Omit<LineItem, "key">[];
  estimated_total: number;
}

// ---------------------------------------------------------------------------
// Server functions
// ---------------------------------------------------------------------------

const getClientsForDropdown = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const rows = await sql`
      SELECT id, name FROM clients ORDER BY name ASC
    `;
    return rows as ClientOption[];
  } catch {
    return [] as ClientOption[];
  }
});

const createEstimate = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as EstimateInput;
    if (!d.client_id) throw new Error("Client is required");
    if (!d.line_items || d.line_items.length === 0)
      throw new Error("At least one line item is required");
    for (const item of d.line_items) {
      if (!item.description || item.description.trim().length === 0)
        throw new Error("Each line item needs a description");
    }
    return d;
  })
  .handler(async ({ data }) => {
    // Generate estimate number
    const numRows = await sql`
      SELECT COALESCE(
        MAX(NULLIF(REGEXP_REPLACE(estimate_number, '[^0-9]', '', 'g'), '')::int),
        0
      ) + 1 AS next_num
      FROM estimates
    `;
    const nextNum = Number(numRows[0].next_num);
    const estimateNumber = `EST-${String(nextNum).padStart(3, "0")}`;

    // Insert estimate
    const estRows = await sql`
      INSERT INTO estimates (client_id, status, estimate_number, notes, labor_rate, markup_pct, estimated_total)
      VALUES (${data.client_id}, 'draft', ${estimateNumber}, ${data.notes || null}, ${data.labor_rate}, ${data.markup_pct}, ${data.estimated_total})
      RETURNING id
    `;
    const estimateId = estRows[0].id as string;

    // Insert line items
    for (let i = 0; i < data.line_items.length; i++) {
      const item = data.line_items[i];
      await sql`
        INSERT INTO estimate_line_items (estimate_id, description, quantity, unit_cost, labor_hours, materials_cost, markup_pct, line_total, sort_order)
        VALUES (${estimateId}, ${item.description}, ${item.quantity}, ${item.unit_cost}, ${item.labor_hours}, ${item.materials_cost}, ${item.markup_pct}, ${item.line_total}, ${i})
      `;
    }

    return { id: estimateId };
  });

export const Route = createFileRoute("/estimates/new")({
  loader: () => getClientsForDropdown(),
  component: NewEstimatePage,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calcLineTotal(item: LineItem, laborRate: number): number {
  const subtotal =
    item.quantity * item.unit_cost +
    item.labor_hours * laborRate +
    item.materials_cost;
  return subtotal * (1 + item.markup_pct / 100);
}

function newLineItem(defaultMarkup: number): LineItem {
  return {
    key: String(Date.now()) + Math.random().toString(36).slice(2),
    description: "",
    quantity: 1,
    unit_cost: 0,
    labor_hours: 0,
    materials_cost: 0,
    markup_pct: defaultMarkup,
  };
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

function NewEstimatePage() {
  const clients = Route.useLoaderData();
  const navigate = useNavigate();

  // Estimate header state
  const [clientId, setClientId] = useState("");
  const [notes, setNotes] = useState("");
  const [laborRate, setLaborRate] = useState(75);
  const [defaultMarkup, setDefaultMarkup] = useState(20);

  // Line items
  const [lineItems, setLineItems] = useState<LineItem[]>([
    newLineItem(20),
  ]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update markup on existing items when default changes
  const updateDefaultMarkup = useCallback(
    (newMarkup: number) => {
      setDefaultMarkup(newMarkup);
      setLineItems((prev) =>
        prev.map((item) => ({ ...item, markup_pct: newMarkup }))
      );
    },
    []
  );

  // Line item mutations
  const updateItem = (key: string, field: keyof LineItem, value: string | number) => {
    setLineItems((prev) =>
      prev.map((item) =>
        item.key === key ? { ...item, [field]: value } : item
      )
    );
  };

  const addItem = () => {
    setLineItems((prev) => [...prev, newLineItem(defaultMarkup)]);
  };

  const removeItem = (key: string) => {
    setLineItems((prev) => {
      if (prev.length <= 1) return prev; // keep at least one
      return prev.filter((item) => item.key !== key);
    });
  };

  // Compute totals
  const estimateTotal = lineItems.reduce(
    (sum, item) => sum + calcLineTotal(item, laborRate),
    0
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) {
      setError("Please select a client");
      return;
    }
    const validItems = lineItems.filter(
      (item) => item.description.trim().length > 0
    );
    if (validItems.length === 0) {
      setError("At least one line item with a description is required");
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const result = await createEstimate({
        data: {
          client_id: clientId,
          notes: notes.trim() || "",
          labor_rate: laborRate,
          markup_pct: defaultMarkup,
          estimated_total: Math.round(estimateTotal * 100) / 100,
          line_items: validItems.map((item) => ({
            description: item.description.trim(),
            quantity: item.quantity,
            unit_cost: item.unit_cost,
            labor_hours: item.labor_hours,
            materials_cost: item.materials_cost,
            markup_pct: item.markup_pct,
            line_total: Math.round(calcLineTotal(item, laborRate) * 100) / 100,
          })),
        },
      });
      navigate({ to: "/estimates/$estimateId", params: { estimateId: result.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save estimate");
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
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          New Estimate
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Client picker */}
        <div>
          <label
            htmlFor="client"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Client <span className="text-red-500">*</span>
          </label>
          {clients.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-center">
              <p className="mb-2 text-sm text-gray-600">No clients yet</p>
              <Link
                to="/clients/new"
                className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
              >
                + Add a client first
              </Link>
            </div>
          ) : (
            <select
              id="client"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              required
              className="block w-full min-h-[48px] rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem] bg-[right_0.75rem_center] bg-no-repeat pr-10"
            >
              <option value="">Select a client...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Estimate header fields */}
        <div>
          <label
            htmlFor="notes"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Notes
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes about this estimate..."
            rows={2}
            className="block w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
          />
        </div>

        {/* Labor rate and default markup */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="laborRate"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Labor rate ($/hr)
            </label>
            <input
              id="laborRate"
              type="number"
              min={0}
              step={1}
              value={laborRate}
              onChange={(e) => setLaborRate(Number(e.target.value) || 0)}
              className="block w-full min-h-[48px] rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <div>
            <label
              htmlFor="markup"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Default markup (%)
            </label>
            <input
              id="markup"
              type="number"
              min={0}
              step={0.5}
              value={defaultMarkup}
              onChange={(e) => updateDefaultMarkup(Number(e.target.value) || 0)}
              className="block w-full min-h-[48px] rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>

        {/* Line items */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">
              Line Items
            </h2>
            <button
              type="button"
              onClick={addItem}
              className="flex min-h-[40px] min-w-[40px] items-center gap-1 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 active:bg-gray-300 transition-colors"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Item
            </button>
          </div>

          <div className="space-y-3">
            {lineItems.map((item, idx) => (
              <LineItemCard
                key={item.key}
                item={item}
                index={idx}
                laborRate={laborRate}
                canRemove={lineItems.length > 1}
                onUpdate={(field, value) => updateItem(item.key, field, value)}
                onRemove={() => removeItem(item.key)}
              />
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {/* Sticky total bar */}
        <div className="sticky bottom-0 z-10 -mx-4 border-t border-gray-200 bg-white px-4 pb-4 pt-3">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-base font-semibold text-gray-900">
              Estimate Total
            </span>
            <span className="text-xl font-bold text-indigo-600">
              $
              {estimateTotal.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
          <button
            type="submit"
            disabled={saving || !clientId}
            className="flex w-full min-h-[48px] items-center justify-center rounded-lg bg-indigo-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-indigo-500 active:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Save Estimate"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Line item card
// ---------------------------------------------------------------------------

function LineItemCard({
  item,
  index,
  laborRate,
  canRemove,
  onUpdate,
  onRemove,
}: {
  item: LineItem;
  index: number;
  laborRate: number;
  canRemove: boolean;
  onUpdate: (field: keyof LineItem, value: string | number) => void;
  onRemove: () => void;
}) {
  const lineTotal = calcLineTotal(item, laborRate);

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm font-semibold text-gray-700">
          Item {index + 1}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">
            $
            {lineTotal.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
          {canRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
              aria-label="Remove item"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Fields */}
      <div className="space-y-3 px-4 pb-4">
        {/* Description */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            Description <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={item.description}
            onChange={(e) => onUpdate("description", e.target.value)}
            placeholder="e.g. Replace kitchen faucet"
            className="block w-full min-h-[44px] rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        {/* Row: Quantity + Unit cost */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Quantity
            </label>
            <input
              type="number"
              min={0}
              step={0.5}
              value={item.quantity}
              onChange={(e) =>
                onUpdate("quantity", Number(e.target.value) || 0)
              }
              className="block w-full min-h-[44px] rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Unit cost ($)
            </label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={item.unit_cost || ""}
              onChange={(e) =>
                onUpdate("unit_cost", Number(e.target.value) || 0)
              }
              placeholder="0.00"
              className="block w-full min-h-[44px] rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>

        {/* Row: Labor hours + Materials cost */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Labor hours
            </label>
            <input
              type="number"
              min={0}
              step={0.25}
              value={item.labor_hours || ""}
              onChange={(e) =>
                onUpdate("labor_hours", Number(e.target.value) || 0)
              }
              placeholder="0"
              className="block w-full min-h-[44px] rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Materials ($)
            </label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={item.materials_cost || ""}
              onChange={(e) =>
                onUpdate("materials_cost", Number(e.target.value) || 0)
              }
              placeholder="0.00"
              className="block w-full min-h-[44px] rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>

        {/* Markup override */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            Markup (%)
          </label>
          <input
            type="number"
            min={0}
            step={0.5}
            value={item.markup_pct}
            onChange={(e) =>
              onUpdate("markup_pct", Number(e.target.value) || 0)
            }
            className="block w-full min-h-[44px] rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
      </div>
    </div>
  );
}
