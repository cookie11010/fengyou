import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import type { Locale } from "@/i18n/config";
import type { Spot } from "@/types/content";

type DestinationCardProps = {
  spot: Spot;
  locale: Locale;
  categoryLabel: string;
  /** The place's own page. Without it the card is not a link. */
  href?: string;
  moreLabel: string;
};

/**
 * A place card. When the place has its own page, the whole card is one link
 * (the name is the link text; a stretched ::after makes the card clickable).
 */
export function DestinationCard({ spot, locale, categoryLabel, href, moreLabel }: DestinationCardProps) {
  return (
    <article className="fy-lift group relative flex h-full flex-col overflow-hidden rounded-2xl bg-surface shadow-sm ring-1 ring-line hover:ring-brand-500">
      <div className="relative aspect-[4/3] overflow-hidden">
        <Image
          src={spot.image.src}
          alt={spot.image.alt[locale]}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 45vw, 80vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <Badge className="self-start">{categoryLabel}</Badge>
        <h3 className="font-display text-xl font-semibold text-ink">
          {href ? (
            <Link href={href} className="after:absolute after:inset-0 after:content-['']">
              {spot.name[locale]}
            </Link>
          ) : (
            spot.name[locale]
          )}
        </h3>
        <p className="text-sm leading-relaxed text-muted">{spot.summary[locale]}</p>
        {href && (
          <p aria-hidden="true" className="mt-auto pt-2 text-sm font-medium text-brand-700">
            {moreLabel} <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
          </p>
        )}
      </div>
    </article>
  );
}
