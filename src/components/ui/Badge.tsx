import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700", className)}>
      {children}
    </span>
  );
}
