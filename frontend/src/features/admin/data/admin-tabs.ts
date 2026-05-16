import {
  KadaCustomerIcon,
  KadaDashboardIcon,
  KadaDemandIcon,
  KadaMenuIcon,
  type KadaAdminIcon,
} from "@/components/icons/kadaserve-admin-icons";

export type AdminTab =
  | "dashboard"
  | "demand"
  | "customer-intelligence"
  | "menu";

export const adminTabs: Array<{
  key: AdminTab;
  label: string;
  icon: KadaAdminIcon;
}> = [
  { key: "dashboard", label: "Dashboard", icon: KadaDashboardIcon },
  { key: "demand", label: "Demand", icon: KadaDemandIcon },
  { key: "customer-intelligence", label: "Customers", icon: KadaCustomerIcon },
  { key: "menu", label: "Menu", icon: KadaMenuIcon },
];
