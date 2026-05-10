"use client";

import { createPortal } from "react-dom";
import { RefreshCw, Search } from "lucide-react";
import { useSyncExternalStore } from "react";

interface EncodeOrderHeaderControlsProps {
    search: string;
    onSearchChange: (value: string) => void;
    isLoadingMenu: boolean;
    onRefresh: () => void;
    menuSyncMeta: string;
}

export function EncodeOrderHeaderControls({
    search,
    onSearchChange,
    isLoadingMenu,
    onRefresh,
    menuSyncMeta,
}: EncodeOrderHeaderControlsProps) {
    const mounted = useSyncExternalStore(
        () => () => {},
        () => true,
        () => false
    );

    if (!mounted) return null;

    const headerControlsElement = document.getElementById("staff-header-controls");
    if (!headerControlsElement) return null;

    return createPortal(
        <div className="flex shrink-0 items-center justify-end gap-2">
            <label className="flex h-9 items-center gap-2 rounded-xl border border-[#E7DDCC] bg-white px-2.5 min-w-[180px] max-w-[280px] sm:min-w-[220px] sm:max-w-[300px]">
                <Search size={16} className="text-[#8C7A64]" />
                <input
                    value={search}
                    onChange={(event) => onSearchChange(event.target.value)}
                    placeholder="Search menu items..."
                    className="w-full bg-transparent font-sans text-sm text-[#0D2E18] outline-none placeholder:text-[#9B8A74]"
                />
            </label>

            <button
                type="button"
                onClick={onRefresh}
                disabled={isLoadingMenu}
                title="Refresh menu"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[#D6C6AC] bg-white text-[#684B35] transition hover:bg-[#FFF0DA] disabled:opacity-60"
            >
                <RefreshCw
                    size={16}
                    className={isLoadingMenu ? "animate-spin" : ""}
                />
            </button>

            <p className="hidden font-sans text-[11px] text-[#8C7A64] whitespace-nowrap sm:block">
                {menuSyncMeta}
            </p>
        </div>,
        headerControlsElement
    );
}
