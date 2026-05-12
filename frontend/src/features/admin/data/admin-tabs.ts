import {
  BarChart3,
  Coffee,
  LayoutDashboard,
  Target,
} from "lucide-react";

export type AdminTab =
  | "dashboard"
  | "demand"
  | "customer-intelligence"
  | "menu";

export const adminTabs: Array<{
  key: AdminTab;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "demand", label: "Demand", icon: BarChart3 },
  { key: "customer-intelligence", label: "Customer Intelligence", icon: Target },
  { key: "menu", label: "Menu", icon: Coffee },
];
