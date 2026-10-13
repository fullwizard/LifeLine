/**
 * Small, shared UI primitives. Every screen builds from these so spacing,
 * radii, and colors stay consistent. No client state here.
 */
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md";

const VARIANT: Record<Variant, string> = {
  primary: "border border-accent-700 bg-accent-700 text-white hover:border-accent-900 hover:bg-accent-900 disabled:border-neutral-200 disabled:bg-neutral-200 disabled:text-neutral-500",
  secondary: "border border-neutral-300 bg-paper text-neutral-900 hover:border-neutral-700 hover:bg-signal-soft disabled:border-neutral-200 disabled:text-neutral-400",
  ghost: "border border-transparent text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 disabled:text-neutral-400",
};

const SIZE: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
};

export function buttonClass(variant: Variant = "secondary", size: Size = "md", extra = ""): string {
  return `inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[2px] font-semibold transition-colors disabled:cursor-not-allowed ${VARIANT[variant]} ${SIZE[size]} ${extra}`;
}

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = "secondary",
  size = "md",
  className = "",
  external,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant; size?: Size; external?: boolean }) {
  const ext = external ? { target: "_blank", rel: "noopener noreferrer" } : {};
  return <a className={buttonClass(variant, size, className)} {...ext} {...props} />;
}

type Tone = "neutral" | "success" | "warning" | "danger" | "accent";

const TONE: Record<Tone, string> = {
  neutral: "bg-neutral-100 text-neutral-800",
  success: "bg-neutral-900 text-white",
  warning: "bg-signal text-neutral-950",
  danger: "bg-red-700 text-white",
  accent: "bg-accent-700 text-white",
};

export function Badge({ tone = "neutral", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-[2px] px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] whitespace-nowrap ${TONE[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-[2px] border border-neutral-300 bg-paper ${className}`} {...props} />;
}

export function SectionHeader({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold tracking-tight text-neutral-950">{title}</h2>
        {description && <p className="mt-1 max-w-2xl text-sm text-neutral-600">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function PhoneLink({ phone, className = "" }: { phone: string; className?: string }) {
  return (
    <a href={`tel:${phone.replace(/[^0-9+]/g, "")}`} className={`font-medium text-accent-700 tabular-nums hover:underline ${className}`}>
      {phone}
    </a>
  );
}

export function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
