import {
  BarChart3,
  Boxes,
  ClipboardList,
  Coffee,
  LayoutDashboard,
  Star,
  Target,
  Timer,
  TrendingUp,
} from "lucide-react";

export type AdminTab =
  | "dashboard"
  | "orders"
  | "time-series"
  | "peak-hours"
  | "item-ranking"
  | "satisfaction"
  | "customer-pref"
  | "menu"
  | "inventory";

export const adminTabs: Array<{
  key: AdminTab;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "orders", label: "All Orders", icon: ClipboardList },
  { key: "time-series", label: "Time Series", icon: BarChart3 },
  { key: "peak-hours", label: "Peak Hours", icon: Timer },
  { key: "item-ranking", label: "Item Ranking", icon: TrendingUp },
  { key: "satisfaction", label: "Satisfaction", icon: Star },
  { key: "customer-pref", label: "Customer Pref", icon: Target },
  { key: "menu", label: "Menu", icon: Coffee },
  { key: "inventory", label: "Inventory", icon: Boxes },
];
