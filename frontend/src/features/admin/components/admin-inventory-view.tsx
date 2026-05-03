"use client";

import { useState } from "react";

export type InventoryItem = {
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
};

export function getInventoryStatus(item: InventoryItem) {
  if (item.onHand <= item.minNeed / 2) return "Critical";
  if (item.onHand <= item.minNeed) return "Low Stock";
  return "Good Stock";
}

export function InventoryView({
  inventoryItems,
  inventorySummary,
}: {
  inventoryItems: InventoryItem[];
  inventorySummary: InventorySummary;
}) {
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-4">
        <MetricCard label="Total Items" value={inventorySummary.total.toString()} />
        <MetricCard label="Normal" value={inventorySummary.normal.toString()} />
        <MetricCard label="Low Stock" value={inventorySummary.low.toString()} />
        <MetricCard label="Critical" value={inventorySummary.critical.toString()} />
      </div>

      <section className="rounded-[18px] border border-[#DCCFB8] bg-white p-4">
        <h2 className="font-sans text-lg font-bold text-[#0D2E18]">
          Inventory Monitoring
        </h2>

        <div className="grid grid-cols-[50px_1.4fr_0.8fr_1fr_1fr_1fr_1fr_1fr_0.7fr] gap-4 px-6 py-4 font-sans text-sm font-bold uppercase">
          <span>#</span>
          <span>Ingredient</span>
          <span>Unit</span>
          <span>Onhand</span>
          <span>Min. Need</span>
          <span>Max. Cap</span>
          <span>Status</span>
          <span>Supplier</span>
          <span>Action</span>
        </div>

        <div className="space-y-4 px-6 pb-6">
          {inventoryItems.map((item, index) => (
            <div
              key={item.name}
              className="grid grid-cols-[50px_1.4fr_0.8fr_1fr_1fr_1fr_1fr_1fr_0.7fr] gap-4 font-sans text-sm"
            >
              <span>{index + 1}</span>
              <span className="font-semibold">{item.name}</span>
              <span>{item.unit}</span>
              <span>{item.onHand}</span>
              <span>{item.minNeed}</span>
              <span>{item.maxCap}</span>
              <span>{getInventoryStatus(item)}</span>
              <span>{item.supplier}</span>
              <button
                type="button"
                onClick={() => setSelectedItem(item)}
                className="rounded-full border border-[#D6C6AC] px-3 py-1"
              >
                Notes
              </button>
            </div>
          ))}
        </div>
      </section>

      {selectedItem ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0D2E18]/35 px-3 backdrop-blur-sm sm:items-center sm:p-6">
          <section className="w-full max-w-md rounded-t-[24px] border border-[#DCCFB8] bg-[#FFF8EF] p-5 shadow-[0_18px_40px_rgba(13,46,24,0.18)] sm:rounded-[24px]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-[#684B35]">
                  Inventory Notes
                </p>
                <h2 className="mt-1 font-sans text-2xl font-black text-[#0D2E18]">
                  {selectedItem.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="rounded-full bg-white px-3 py-2 font-sans text-sm font-bold text-[#0D2E18]"
              >
                Close
              </button>
            </div>
            <div className="mt-5 space-y-3 rounded-[18px] bg-white p-4 font-sans text-sm text-[#684B35]">
              <p>Status: {getInventoryStatus(selectedItem)}</p>
              <p>
                On hand: {selectedItem.onHand} {selectedItem.unit}
              </p>
              <p>
                Reorder when stock reaches {selectedItem.minNeed}{" "}
                {selectedItem.unit}. Maximum capacity is {selectedItem.maxCap}{" "}
                {selectedItem.unit}.
              </p>
              <p>Supplier: {selectedItem.supplier}</p>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] border border-[#DCCFB8] bg-white p-5">
      <p className="font-sans text-sm font-bold uppercase text-[#0D2E18]">
        {label}
      </p>
      <p className="mt-7 font-sans text-4xl font-bold text-[#0D2E18]">{value}</p>
    </div>
  );
}
