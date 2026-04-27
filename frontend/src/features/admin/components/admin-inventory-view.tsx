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
              <button className="rounded-full border border-[#D6C6AC] px-3 py-1">
                Notes
              </button>
            </div>
          ))}
        </div>
      </section>
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
