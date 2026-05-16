import {
  LayoutDashboard,
  BarChart3,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

export type AdminTab =
  | "dashboard"
  | "demand"
  | "customer-intelligence"
  | "menu";

export const adminTabs: Array<{
  key: AdminTab;
  label: string;
  icon: LucideIcon;
}> = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "demand", label: "Demand", icon: BarChart3 },
  { key: "customer-intelligence", label: "Customers", icon: Users },
  { key: "menu", label: "Menu", icon: UtensilsCrossed },
];
