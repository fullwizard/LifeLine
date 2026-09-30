/**
 * Small, shared UI primitives. Every screen builds from these so spacing,
 * radii, and colors stay consistent. No client state here.
 */
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md";

const VARIANT: Record<Variant, string> = {
  primary: "bg-accent-700 text-white hover:bg-accent-800 disabled:bg-neutral-200 disabled:text-neutral-500",
  secondary: "border border-neutral-300 bg-paper text-neutral-800 hover:bg-neutral-50 disabled:text-neutral-400",
  ghost: "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 disabled:text-neutral-400",
};

const SIZE: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
};

export function buttonClass(variant: Variant = "secondary", size: Size = "md", extra = ""): string {
  return `inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors disabled:cursor-not-allowed ${VARIANT[variant]} ${SIZE[size]} ${extra}`;
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
  neutral: "bg-neutral-100 text-neutral-700",
  success: "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200",
  warning: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200",
  danger: "bg-red-700 text-white",
  accent: "bg-accent-700 text-white",
};

export function Badge({ tone = "neutral", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${TONE[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-lg border border-neutral-200 bg-paper ${className}`} {...props} />;
}

export function SectionHeader({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-neutral-500">{description}</p>}
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
