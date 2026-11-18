import Image from "next/image";
import { Badge } from "@/components/ui/Badge";
import type { Locale } from "@/i18n/config";
import type { Spot } from "@/types/content";

type DestinationCardProps = {
  spot: Spot;
  locale: Locale;
  categoryLabel: string;
};

export function DestinationCard({ spot, locale, categoryLabel }: DestinationCardProps) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl bg-surface shadow-sm ring-1 ring-line">
      <div className="relative aspect-[4/3]">
        <Image
          src={spot.image.src}
          alt={spot.image.alt[locale]}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 45vw, 80vw"
          className="object-cover"
        />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <Badge className="self-start">{categoryLabel}</Badge>
        <h3 className="font-display text-xl font-semibold text-ink">{spot.name[locale]}</h3>
        <p className="text-sm leading-relaxed text-muted">{spot.summary[locale]}</p>
      </div>
    </article>
  );
}
