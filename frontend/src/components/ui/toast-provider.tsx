"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

type ToastVariant = "success" | "error" | "info";

type Toast = {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
};

type ToastInput = {
  title: string;
  description?: string;
  variant?: ToastVariant;
};

type ToastContextValue = {
  showToast: (toast: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const toastStyles: Record<
  ToastVariant,
  {
    icon: typeof CheckCircle2;
    border: string;
    iconWrap: string;
    title: string;
  }
> = {
  success: {
    icon: CheckCircle2,
    border: "border-[#BFD8BE]",
    iconWrap: "bg-[#E9F5E7] text-[#2D7A40]",
    title: "text-[#0D2E18]",
  },
  error: {
    icon: AlertCircle,
    border: "border-[#F2C8BD]",
    iconWrap: "bg-[#FFF1EC] text-[#9C543D]",
    title: "text-[#9C543D]",
  },
  info: {
    icon: Info,
    border: "border-[#DCCFB8]",
    iconWrap: "bg-[#FFF0DA] text-[#684B35]",
    title: "text-[#0D2E18]",
  },
};

function createToastId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((toastId: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== toastId));
  }, []);

  const showToast = useCallback(
    ({ title, description, variant = "info" }: ToastInput) => {
      const id = createToastId();

      setToasts((current) => [
        ...current.slice(-2),
        {
          id,
          title,
          description,
          variant,
        },
      ]);

      window.setTimeout(() => dismissToast(id), 4200);
    },
    [dismissToast]
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed inset-x-3 top-4 z-[120] flex flex-col items-stretch gap-2 sm:left-auto sm:right-5 sm:w-[380px]"
      >
        {toasts.map((toast) => {
          const style = toastStyles[toast.variant];
          const Icon = style.icon;

          return (
            <section
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 rounded-[20px] border ${style.border} bg-white/96 p-3.5 text-[#0D2E18] shadow-[0_16px_36px_rgba(13,46,24,0.18)] backdrop-blur`}
            >
              <span
                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${style.iconWrap}`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className={`font-sans text-sm font-black ${style.title}`}>
                  {toast.title}
                </p>
                {toast.description ? (
                  <p className="mt-0.5 font-sans text-xs font-semibold leading-5 text-[#684B35]">
                    {toast.description}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                aria-label="Dismiss notification"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#684B35] transition hover:bg-[#FFF0DA]"
              >
                <X className="h-4 w-4" />
              </button>
            </section>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }

  return context;
}
