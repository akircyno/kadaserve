"use client";

import type { ReactElement, SVGProps } from "react";

export type KadaAdminIconProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

export type KadaAdminIcon = (props: KadaAdminIconProps) => ReactElement;

function AdminIcon({
  children,
  className,
  fill = "none",
  size = 24,
  strokeWidth = 2.35,
  ...props
}: KadaAdminIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill={fill}
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      viewBox="0 0 24 24"
      width={size}
      {...props}
    >
      {children}
    </svg>
  );
}

export function KadaDashboardIcon(props: KadaAdminIconProps) {
  return (
    <AdminIcon {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <path d="M11.5 4v16" />
      <path d="M4 10.5h7.5" />
      <path d="M11.5 14h8" />
    </AdminIcon>
  );
}

export function KadaDemandIcon(props: KadaAdminIconProps) {
  return (
    <AdminIcon {...props}>
      <rect x="3.5" y="4" width="17" height="16" rx="4" />
      <path d="M7.5 16v-4" />
      <path d="M12 16V8" />
      <path d="M16.5 16v-6" />
      <path d="M6.5 16.5h11" />
    </AdminIcon>
  );
}

export function KadaCustomerIcon(props: KadaAdminIconProps) {
  return (
    <AdminIcon {...props}>
      <path d="M12 4.5c2.2 0 3.9 1.7 3.9 3.8S14.2 12 12 12s-3.9-1.6-3.9-3.7S9.8 4.5 12 4.5Z" />
      <path d="M4.8 19.2c1.2-3.2 3.6-5 7.2-5s6 1.8 7.2 5" />
      <path d="M5.8 6.3 4 8.1l1.8 1.8" />
      <path d="M18.2 6.3 20 8.1l-1.8 1.8" />
    </AdminIcon>
  );
}

export function KadaMenuIcon(props: KadaAdminIconProps) {
  return (
    <AdminIcon {...props}>
      <path d="M7.5 4.5v7.2a4.5 4.5 0 0 0 9 0V4.5" />
      <path d="M7.5 9.5h9" />
      <path d="M12 16.2v4" />
      <path d="M8.8 20.5h6.4" />
    </AdminIcon>
  );
}

export function KadaPanelMenuIcon(props: KadaAdminIconProps) {
  return (
    <AdminIcon {...props}>
      <rect x="4" y="5" width="16" height="14" rx="4" />
      <path d="M8 9h8" />
      <path d="M8 12h8" />
      <path d="M8 15h5" />
    </AdminIcon>
  );
}

export function KadaCloseIcon(props: KadaAdminIconProps) {
  return (
    <AdminIcon {...props}>
      <path d="m7 7 10 10" />
      <path d="m17 7-10 10" />
    </AdminIcon>
  );
}

export function KadaSearchIcon(props: KadaAdminIconProps) {
  return (
    <AdminIcon {...props}>
      <circle cx="10.5" cy="10.5" r="5.5" />
      <path d="m15 15 4 4" />
      <path d="M8.2 10.5h4.6" />
    </AdminIcon>
  );
}

export function KadaRefreshIcon(props: KadaAdminIconProps) {
  return (
    <AdminIcon {...props}>
      <path d="M18.5 7.5a7 7 0 0 0-11.8-1L5 8.2" />
      <path d="M5 4.5v3.7h3.7" />
      <path d="M5.5 16.5a7 7 0 0 0 11.8 1l1.7-1.7" />
      <path d="M19 19.5v-3.7h-3.7" />
    </AdminIcon>
  );
}

export function KadaLogoutIcon(props: KadaAdminIconProps) {
  return (
    <AdminIcon {...props}>
      <path d="M10.5 5H6.8A2.8 2.8 0 0 0 4 7.8v8.4A2.8 2.8 0 0 0 6.8 19h3.7" />
      <path d="M12 12h7" />
      <path d="m16.5 8.5 3.5 3.5-3.5 3.5" />
    </AdminIcon>
  );
}

export function KadaClockIcon(props: KadaAdminIconProps) {
  return (
    <AdminIcon {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5v5l3.2 2" />
      <path d="M6.7 5.8 5 4.3" />
      <path d="m17.3 5.8 1.7-1.5" />
    </AdminIcon>
  );
}

export function KadaAlertIcon(props: KadaAdminIconProps) {
  return (
    <AdminIcon {...props}>
      <path d="M12 4.5 21 19H3l9-14.5Z" />
      <path d="M12 9.2v4.4" />
      <path d="M12 17h.01" />
    </AdminIcon>
  );
}

export function KadaMessageIcon(props: KadaAdminIconProps) {
  return (
    <AdminIcon {...props}>
      <path d="M5 6h14v9.5H9.8L5 19V6Z" />
      <path d="M8.5 9.5h7" />
      <path d="M8.5 12.5h4.8" />
    </AdminIcon>
  );
}

export function KadaStarIcon(props: KadaAdminIconProps) {
  return (
    <AdminIcon {...props}>
      <path d="m12 3.8 2.35 4.75 5.25.77-3.8 3.72.9 5.23L12 15.8l-4.7 2.47.9-5.23-3.8-3.72 5.25-.77L12 3.8Z" />
    </AdminIcon>
  );
}

export function KadaAwardIcon(props: KadaAdminIconProps) {
  return (
    <AdminIcon {...props}>
      <circle cx="12" cy="9" r="4.5" />
      <path d="m9.4 13 1 6 1.6-1.2 1.6 1.2 1-6" />
      <path d="M10.3 9h3.4" />
    </AdminIcon>
  );
}

export function KadaBrainIcon(props: KadaAdminIconProps) {
  return (
    <AdminIcon {...props}>
      <path d="M9.2 5.2A3.2 3.2 0 0 0 6 8.4v6.2a3.2 3.2 0 0 0 3.2 3.2" />
      <path d="M14.8 5.2A3.2 3.2 0 0 1 18 8.4v6.2a3.2 3.2 0 0 1-3.2 3.2" />
      <path d="M12 5v14" />
      <path d="M8.2 10.2h3.8" />
      <path d="M12 13.8h3.8" />
      <path d="M8.8 15.8 12 13.8" />
      <path d="M15.2 8.2 12 10.2" />
    </AdminIcon>
  );
}

export function KadaSparklesIcon(props: KadaAdminIconProps) {
  return (
    <AdminIcon {...props}>
      <path d="m12 3 1.2 4.1L17 8.5l-3.8 1.4L12 14l-1.2-4.1L7 8.5l3.8-1.4L12 3Z" />
      <path d="m6 14 .8 2.2L9 17l-2.2.8L6 20l-.8-2.2L3 17l2.2-.8L6 14Z" />
      <path d="m18 13 .7 1.8 1.8.7-1.8.7L18 18l-.7-1.8-1.8-.7 1.8-.7L18 13Z" />
    </AdminIcon>
  );
}

export function KadaTrendIcon(props: KadaAdminIconProps) {
  return (
    <AdminIcon {...props}>
      <path d="M4 17.5h16" />
      <path d="m5.5 15 4-4 3 2.8 5.5-6.3" />
      <path d="M14.5 7.5H18v3.5" />
    </AdminIcon>
  );
}

export function KadaUsersIcon(props: KadaAdminIconProps) {
  return (
    <AdminIcon {...props}>
      <path d="M9.5 6.2a3.3 3.3 0 1 0 0 6.6 3.3 3.3 0 0 0 0-6.6Z" />
      <path d="M3.8 19c.9-2.7 2.8-4.1 5.7-4.1s4.8 1.4 5.7 4.1" />
      <path d="M15.5 7.2a2.8 2.8 0 0 1 0 5.4" />
      <path d="M16 15c2.1.3 3.5 1.6 4.2 4" />
    </AdminIcon>
  );
}

export function KadaPackageIcon(props: KadaAdminIconProps) {
  return (
    <AdminIcon {...props}>
      <path d="M4.5 8.2 12 4l7.5 4.2v7.6L12 20l-7.5-4.2V8.2Z" />
      <path d="m4.8 8.5 7.2 4 7.2-4" />
      <path d="M12 12.5V20" />
      <path d="m8.2 6.2 7.4 4.2" />
    </AdminIcon>
  );
}

export function KadaSmileIcon(props: KadaAdminIconProps) {
  return (
    <AdminIcon {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M8.8 10h.01" />
      <path d="M15.2 10h.01" />
      <path d="M8.7 14.1c1.7 2 4.9 2 6.6 0" />
    </AdminIcon>
  );
}

export function KadaZapIcon(props: KadaAdminIconProps) {
  return (
    <AdminIcon {...props}>
      <path d="M13.5 3.8 5.8 13H12l-1.5 7.2 7.7-9.2H12l1.5-7.2Z" />
    </AdminIcon>
  );
}

export function KadaFlameIcon(props: KadaAdminIconProps) {
  return (
    <AdminIcon {...props}>
      <path d="M12 21c4 0 6.6-2.7 6.6-6.4 0-3.8-2.6-6.2-5.2-10.6-.5 2.8-2 4.3-3.5 5.6-.3-1.1-.9-2-1.7-2.7-.5 2.6-2.8 4.7-2.8 7.7C5.4 18.3 8 21 12 21Z" />
      <path d="M12 17.8c1.5 0 2.5-1 2.5-2.4 0-1.2-.8-2.1-1.8-3.4-.2 1-.8 1.7-1.5 2.2-.2-.5-.5-.9-.9-1.2-.3 1-.8 1.7-.8 2.4 0 1.4 1 2.4 2.5 2.4Z" />
    </AdminIcon>
  );
}

export function KadaMoneyIcon(props: KadaAdminIconProps) {
  return (
    <AdminIcon {...props}>
      <rect x="4" y="6.5" width="16" height="11" rx="3" />
      <path d="M8 10.5h4.7a2 2 0 1 1 0 4H8" />
      <path d="M10.8 8.6v8.8" />
      <path d="M16.5 12h.01" />
    </AdminIcon>
  );
}

export function KadaChevronUpIcon(props: KadaAdminIconProps) {
  return (
    <AdminIcon {...props}>
      <path d="m6.5 14.5 5.5-5 5.5 5" />
    </AdminIcon>
  );
}

export function KadaChevronRightIcon(props: KadaAdminIconProps) {
  return (
    <AdminIcon {...props}>
      <path d="m9 6 6 6-6 6" />
    </AdminIcon>
  );
}

export function KadaInfoIcon(props: KadaAdminIconProps) {
  return (
    <AdminIcon {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 11.5V16" />
      <path d="M12 8h.01" />
    </AdminIcon>
  );
}

export function KadaActivityIcon(props: KadaAdminIconProps) {
  return (
    <AdminIcon {...props}>
      <path d="M4 13h3l2-6 4 10 2-5h5" />
      <path d="M4 19h16" />
    </AdminIcon>
  );
}

export function KadaCheckIcon(props: KadaAdminIconProps) {
  return (
    <AdminIcon {...props}>
      <path d="m5 12.5 4.2 4L19 7" />
    </AdminIcon>
  );
}

export function KadaCopyIcon(props: KadaAdminIconProps) {
  return (
    <AdminIcon {...props}>
      <rect x="8" y="8" width="11" height="11" rx="3" />
      <path d="M5 15.5V6.8A1.8 1.8 0 0 1 6.8 5h8.7" />
    </AdminIcon>
  );
}

export function KadaDownloadIcon(props: KadaAdminIconProps) {
  return (
    <AdminIcon {...props}>
      <path d="M12 4v10" />
      <path d="m8 10 4 4 4-4" />
      <path d="M5 19h14" />
    </AdminIcon>
  );
}
