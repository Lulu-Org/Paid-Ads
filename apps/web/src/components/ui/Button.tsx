import type { ButtonHTMLAttributes } from "react";

const variants = {
  primary:
    "border-[#5e54dd] bg-[#5e54dd] text-white shadow-[0_7px_14px_#5e54dd22] hover:bg-[#4c42c3]",
  outline: "border-[#dad8ec] bg-surface text-primary-hover hover:bg-[#f7f5ff]",
  ghost: "border-transparent bg-transparent text-text-muted hover:bg-surface-muted",
  danger: "border-[#d9534f] bg-[#d9534f] text-white hover:bg-[#c2413d]",
} as const;

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  icon?: React.ReactNode;
  loading?: boolean;
};

export function Button({
  variant = "primary",
  icon,
  loading = false,
  className = "",
  type = "button",
  disabled,
  children,
  ...props
}: Props) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md whitespace-nowrap border px-3.5 py-2.5 text-[11px] font-extrabold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
      {...props}
    >
      {loading ? (
        <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
      ) : (
        icon && <span aria-hidden>{icon}</span>
      )}
      {children}
    </button>
  );
}
