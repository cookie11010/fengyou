import type { Locale } from "@/i18n/config";
import type { Route } from "@/types/content";

type RouteCardProps = {
  route: Route;
  locale: Locale;
  labels: { duration: string; stops: string; stopsHeading: string };
};

/** Fills "{hours}" / "{count}" placeholders in translated strings. */
const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));

export function RouteCard({ route, locale, labels }: RouteCardProps) {
  return (
    <article className="flex h-full flex-col rounded-2xl bg-surface p-6 ring-1 ring-line">
      <p className="text-sm font-medium text-brand-600">{route.theme[locale]}</p>
      <h3 className="mt-1 font-display text-2xl font-semibold text-ink">{route.title[locale]}</h3>
      <p className="mt-2 flex gap-3 text-sm text-muted">
        <span>{fill(labels.duration, { hours: route.durationHours })}</span>
        <span aria-hidden="true">·</span>
        <span>{fill(labels.stops, { count: route.stops.length })}</span>
      </p>

      {/* The stops drawn as a vertical line of numbered dots. */}
      <h4 className="sr-only">{labels.stopsHeading}</h4>
      <ol className="mt-6 space-y-4">
        {route.stops.map((stop, i) => (
          <li key={stop.name.en} className="relative flex items-center gap-4">
            {i < route.stops.length - 1 && (
              <span aria-hidden="true" className="absolute left-4 top-8 h-4 w-px bg-brand-100" />
            )}
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700"
            >
              {i + 1}
            </span>
            <span className="text-ink">{stop.name[locale]}</span>
          </li>
        ))}
      </ol>
    </article>
  );
}
