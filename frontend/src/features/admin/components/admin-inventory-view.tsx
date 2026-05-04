"use client";

import { Plus, Save } from "lucide-react";
import { useState, type FormEvent } from "react";

export type InventoryItem = {
  id?: string;
  name: string;
  unit: string;
  onHand: number;
  minNeed: number;
  maxCap: number;
  supplier: string;
};

type InventorySummary = {
  total: number;
  normal: number;
  low: number;
  critical: number;
  overstocked: number;
};

export function getInventoryStatus(item: InventoryItem) {
  if (item.onHand > item.maxCap) return "Overstocked";
  if (item.onHand <= item.minNeed / 2) return "Critical";
  if (item.onHand <= item.minNeed) return "Low Stock";
  return "Normal";
}

type InventoryStatus = ReturnType<typeof getInventoryStatus>;

const emptyInventoryItem: InventoryItem = {
  name: "",
  unit: "",
  onHand: 0,
  minNeed: 0,
  maxCap: 0,
  supplier: "",
};

function statusStyles(status: InventoryStatus) {
  if (status === "Critical") {
    return "border-[#F2B3A5] bg-[#FFF1EC] text-[#9B2F18]";
  }

  if (status === "Low Stock") {
    return "border-[#EAC46C] bg-[#FFF8D8] text-[#7A5300]";
  }

  if (status === "Overstocked") {
    return "border-[#B8D5F0] bg-[#EDF7FF] text-[#24577A]";
  }

  return "border-[#BFDCC6] bg-[#EDF8EF] text-[#0D5A26]";
}

function sanitizeInventoryNumber(value: number, fallback = 0) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.round(value));
}

export function InventoryView({
  inventoryItems,
  inventorySummary,
  onSetStock,
  onAddStock,
  onSaveItem,
  isInventorySaving = false,
  inventoryMessage = "",
}: {
  inventoryItems: InventoryItem[];
  inventorySummary: InventorySummary;
  onSetStock: (item: InventoryItem, onHand: number) => void | Promise<void>;
  onAddStock: (item: InventoryItem, amount: number) => void | Promise<void>;
  onSaveItem: (item: InventoryItem) => void | Promise<void>;
  isInventorySaving?: boolean;
  inventoryMessage?: string;
}) {
  const [newItem, setNewItem] = useState<InventoryItem>(emptyInventoryItem);
  const [stockAdds, setStockAdds] = useState<Record<string, string>>({});

  function updateItemStock(item: InventoryItem, value: string) {
    const nextStock = sanitizeInventoryNumber(Number(value));

    void onSetStock(item, nextStock);
  }

  function addStock(item: InventoryItem) {
    const itemKey = item.id ?? item.name;
    const amount = sanitizeInventoryNumber(Number(stockAdds[itemKey]), 0);

    if (amount <= 0) return;

    void onAddStock(item, amount);
    setStockAdds((currentAdds) => ({ ...currentAdds, [itemKey]: "" }));
  }

  function addInventoryItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = newItem.name.trim();
    const unit = newItem.unit.trim();
    const supplier = newItem.supplier.trim() || "Supplier";

    if (!name || !unit) return;

    void onSaveItem({
      name,
      unit,
      supplier,
      onHand: sanitizeInventoryNumber(newItem.onHand),
      minNeed: sanitizeInventoryNumber(newItem.minNeed),
      maxCap: sanitizeInventoryNumber(newItem.maxCap),
    });
    setNewItem(emptyInventoryItem);
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Total Items" value={inventorySummary.total.toString()} tone="neutral" />
        <MetricCard label="Normal" value={inventorySummary.normal.toString()} tone="normal" />
        <MetricCard label="Low Stock" value={inventorySummary.low.toString()} tone="low" />
        <MetricCard label="Critical" value={inventorySummary.critical.toString()} tone="critical" />
        <MetricCard label="Overstocked" value={inventorySummary.overstocked.toString()} tone="overstocked" />
      </div>

      <section className="rounded-[18px] border border-[#DCCFB8] bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-sans text-lg font-bold text-[#0D2E18]">
              Inventory Monitoring
            </h2>
            <p className="font-sans text-sm text-[#7B6248]">
              Update remaining stock, add new deliveries, and track reorder status.
            </p>
            {inventoryMessage ? (
              <p className="mt-1 font-sans text-xs font-bold text-[#684B35]">
                {inventoryMessage}
              </p>
            ) : null}
          </div>
        </div>

        <form
          onSubmit={addInventoryItem}
          className="mt-5 grid gap-3 rounded-[14px] border border-[#E5D8C1] bg-[#FFF8EF] p-4 md:grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr_0.7fr_1fr_auto]"
        >
          <InventoryInput
            label="Item"
            value={newItem.name}
            onChange={(value) => setNewItem((item) => ({ ...item, name: value }))}
            placeholder="Ingredient/item"
          />
          <InventoryInput
            label="Unit"
            value={newItem.unit}
            onChange={(value) => setNewItem((item) => ({ ...item, unit: value }))}
            placeholder="kg, pcs"
          />
          <InventoryNumberInput
            label="On hand"
            value={newItem.onHand}
            onChange={(value) => setNewItem((item) => ({ ...item, onHand: value }))}
          />
          <InventoryNumberInput
            label="Min"
            value={newItem.minNeed}
            onChange={(value) => setNewItem((item) => ({ ...item, minNeed: value }))}
          />
          <InventoryNumberInput
            label="Max"
            value={newItem.maxCap}
            onChange={(value) => setNewItem((item) => ({ ...item, maxCap: value }))}
          />
          <InventoryInput
            label="Supplier"
            value={newItem.supplier}
            onChange={(value) =>
              setNewItem((item) => ({ ...item, supplier: value }))
            }
            placeholder="Supplier"
          />
          <button
            type="submit"
            disabled={isInventorySaving}
            className="inline-flex h-11 items-center justify-center gap-2 self-end rounded-[12px] bg-[#0D2E18] px-4 font-sans text-sm font-bold text-white transition hover:bg-[#154626]"
          >
            <Plus size={16} />
            Add
          </button>
        </form>

        <div className="mt-5 overflow-x-auto">
          <div className="min-w-[980px]">
            <div className="grid grid-cols-[44px_1.4fr_0.65fr_0.9fr_0.75fr_0.75fr_1fr_1fr_1.15fr] gap-3 rounded-[12px] bg-[#F7EFDF] px-4 py-3 font-sans text-xs font-bold uppercase tracking-[0.08em] text-[#684B35]">
              <span>#</span>
              <span>Ingredient</span>
              <span>Unit</span>
              <span>Remaining</span>
              <span>Min</span>
              <span>Max</span>
              <span>Status</span>
              <span>Supplier</span>
              <span>Add Stock</span>
            </div>

            <div className="mt-3 space-y-3">
              {inventoryItems.map((item, index) => {
                const status = getInventoryStatus(item);

                return (
                  <div
                    key={item.id ?? item.name}
                    className="grid grid-cols-[44px_1.4fr_0.65fr_0.9fr_0.75fr_0.75fr_1fr_1fr_1.15fr] items-center gap-3 rounded-[14px] border border-[#E5D8C1] bg-white px-4 py-3 font-sans text-sm text-[#1E2B18]"
                  >
                    <span className="font-bold text-[#8C7558]">{index + 1}</span>
                    <span className="font-bold text-[#0D2E18]">{item.name}</span>
                    <span>{item.unit}</span>
                    <input
                      type="number"
                      min="0"
                      value={item.onHand}
                      onChange={(event) =>
                        updateItemStock(item, event.target.value)
                      }
                      disabled={isInventorySaving}
                      className="h-10 w-full rounded-[10px] border border-[#D8C8AA] bg-[#FFFDF8] px-3 font-sans font-bold text-[#0D2E18] outline-none focus:border-[#0D2E18]"
                    />
                    <span>{item.minNeed}</span>
                    <span>{item.maxCap}</span>
                    <span
                      className={`w-fit rounded-full border px-3 py-1 text-xs font-black ${statusStyles(status)}`}
                    >
                      {status}
                    </span>
                    <span className="truncate">{item.supplier}</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={stockAdds[item.id ?? item.name] ?? ""}
                        onChange={(event) =>
                          setStockAdds((currentAdds) => ({
                            ...currentAdds,
                            [item.id ?? item.name]: event.target.value,
                          }))
                        }
                        disabled={isInventorySaving}
                        placeholder="Qty"
                        className="h-10 w-20 rounded-[10px] border border-[#D8C8AA] bg-[#FFFDF8] px-3 font-sans text-sm outline-none focus:border-[#0D2E18]"
                      />
                      <button
                        type="button"
                        onClick={() => addStock(item)}
                        disabled={isInventorySaving}
                        className="inline-flex h-10 items-center justify-center rounded-[10px] bg-[#F2E2C5] px-3 font-sans text-sm font-bold text-[#0D2E18] transition hover:bg-[#E8D0A8]"
                        aria-label={`Add stock for ${item.name}`}
                      >
                        <Save size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function InventoryInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="space-y-1 font-sans text-xs font-bold uppercase tracking-[0.08em] text-[#684B35]">
      <span>{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-[12px] border border-[#D8C8AA] bg-white px-3 font-sans text-sm normal-case tracking-normal text-[#0D2E18] outline-none focus:border-[#0D2E18]"
      />
    </label>
  );
}

function InventoryNumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="space-y-1 font-sans text-xs font-bold uppercase tracking-[0.08em] text-[#684B35]">
      <span>{label}</span>
      <input
        type="number"
        min="0"
        value={value}
        onChange={(event) => onChange(sanitizeInventoryNumber(Number(event.target.value)))}
        className="h-11 w-full rounded-[12px] border border-[#D8C8AA] bg-white px-3 font-sans text-sm normal-case tracking-normal text-[#0D2E18] outline-none focus:border-[#0D2E18]"
      />
    </label>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "neutral" | "normal" | "low" | "critical" | "overstocked";
}) {
  const toneClass =
    tone === "normal"
      ? "border-[#BFDCC6] bg-[#F3FBF4]"
      : tone === "low"
      ? "border-[#EAC46C] bg-[#FFF8D8]"
      : tone === "critical"
      ? "border-[#F2B3A5] bg-[#FFF1EC]"
      : tone === "overstocked"
      ? "border-[#B8D5F0] bg-[#EDF7FF]"
      : "border-[#DCCFB8] bg-white";

  return (
    <div className={`rounded-[16px] border p-4 ${toneClass}`}>
      <p className="font-sans text-sm font-bold uppercase text-[#0D2E18]">
        {label}
      </p>
      <p className="mt-4 font-sans text-3xl font-bold text-[#0D2E18]">{value}</p>
    </div>
  );
}
