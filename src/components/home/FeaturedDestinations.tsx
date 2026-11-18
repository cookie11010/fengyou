import { DestinationCard } from "@/components/cards/DestinationCard";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Spot } from "@/types/content";

type Props = {
  locale: Locale;
  spots: Spot[];
  t: Dictionary["home"]["featured"];
  categories: Dictionary["categories"];
  mapCta: string;
};

/**
 * Phones: a swipeable row that shows part of the next card, so people can
 * tell there's more. Tablet and up: a normal grid.
 */
export function FeaturedDestinations({ locale, spots, t, categories, mapCta }: Props) {
  return (
    <section id="destinations" aria-labelledby="destinations-title" className="scroll-mt-20 py-16 sm:py-24">
      <Container className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading id="destinations-title" eyebrow={t.eyebrow} title={t.title} description={t.description} />
        <ButtonLink href={`/${locale}/spots`} variant="secondary" className="self-start sm:self-auto">
          {mapCta}
        </ButtonLink>
      </Container>

      {/* No side padding on phones, so the row can scroll edge to edge. */}
      <div className="mx-auto mt-8 w-full max-w-6xl sm:px-6 lg:px-8">
        {/* tabIndex lets keyboard users focus and scroll the row on phones. */}
        <ul
          tabIndex={0}
          aria-label={t.listLabel}
          className="flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-4 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4"
        >
          {spots.map((spot) => (
            <li key={spot.slug} className="w-[80%] shrink-0 snap-start sm:w-auto">
              <DestinationCard spot={spot} locale={locale} categoryLabel={categories[spot.category]} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
