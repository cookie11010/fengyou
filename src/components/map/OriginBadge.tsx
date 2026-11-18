import { cn } from "@/lib/cn";
import type { SpotOrigin } from "@/types/content";

type Props = { origin: SpotOrigin; labels: { official: string; community: string }; className?: string };

/** Shows whether the FengYou team picked a place or a user added it. */
export function OriginBadge({ origin, labels, className }: Props) {
  const official = origin === "official";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        official ? "bg-brand-600 text-white" : "bg-sand text-ink ring-1 ring-line",
        className,
      )}
    >
      <span aria-hidden="true">{official ? "★" : "✎"}</span>
      {official ? labels.official : labels.community}
    </span>
  );
}
