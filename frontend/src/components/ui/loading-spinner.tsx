"use client";

type LoadingSpinnerProps = {
  className?: string;
  label?: string;
};

export function LoadingSpinner({
  className = "h-4 w-4",
  label = "Loading",
}: LoadingSpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={`inline-block shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent ${className}`}
    />
  );
}

export function PageLoadingSpinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-[45vh] items-center justify-center bg-[#FFF0DA] text-[#0D2E18]">
      <div className="flex items-center gap-3 font-sans text-sm font-semibold text-[#684B35]">
        <LoadingSpinner className="h-5 w-5" label={label} />
        <span>{label}</span>
      </div>
    </div>
  );
}
