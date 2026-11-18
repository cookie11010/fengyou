import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "onDark";

const variants: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700",
  secondary: "border border-line bg-surface text-ink hover:border-brand-500 hover:text-brand-700",
  onDark: "border border-white/60 text-white hover:bg-white/10",
};

/** A link styled as a button. Use it for navigation; use <button> for actions. */
export function ButtonLink({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return (
    <Link
      className={cn(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-base font-medium transition-colors",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
