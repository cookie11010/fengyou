import { cn } from "@/lib/cn";

type SectionHeadingProps = {
  id: string; // used by the section's aria-labelledby
  eyebrow: string;
  title: string;
  description?: string;
  className?: string;
};

/** Small label + serif heading + optional intro, used at the top of each section. */
export function SectionHeading({ id, eyebrow, title, description, className }: SectionHeadingProps) {
  return (
    <div className={cn("max-w-2xl", className)}>
      <p className="text-sm font-medium tracking-wide text-brand-600">{eyebrow}</p>
      <h2 id={id} className="mt-2 font-display text-3xl font-semibold text-ink sm:text-4xl">
        {title}
      </h2>
      {description && <p className="mt-3 text-base leading-relaxed text-muted sm:text-lg">{description}</p>}
    </div>
  );
}
