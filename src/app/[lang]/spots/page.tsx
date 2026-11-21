import type { Metadata } from "next";
import { AddSpotForm } from "@/components/map/AddSpotForm";
import { DestinationExplorer } from "@/components/map/DestinationExplorer";
import { Container } from "@/components/ui/Container";
import { getMapDestinations } from "@/data/map";
import { getDictionary, getLocale } from "@/i18n/dictionaries";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: `${dict.spots.title} | FengYou`, description: dict.spots.description };
}

export default async function SpotsPage() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const { source, destinations } = await getMapDestinations(locale);
  const t = dict.spots;

  return (
    <Container className="py-8 sm:py-12">
      <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">{t.title}</h1>
      <p className="mt-2 max-w-2xl text-muted">{t.description}</p>
      {source === "sample" && (
        <p role="note" className="mt-4 rounded-xl bg-accent-400/15 px-4 py-2 text-sm text-ink">
          {t.sampleNotice}
        </p>
      )}

      <div className="mt-6 sm:mt-8">
        <DestinationExplorer
          locale={locale}
          saveLabels={dict.save}
          destinations={destinations}
          categories={dict.categories}
          labels={{
            mapLabel: t.mapLabel,
            listHeading: t.listHeading,
            markerHint: t.markerHint,
            close: t.close,
            directions: t.directions,
            empty: t.empty,
            official: t.originOfficial,
            community: t.originCommunity,
            photoBy: t.photoBy,
            originNote: t.originNote,
            details: t.details,
          }}
        />
      </div>

      <div className="mt-10">
        <AddSpotForm locale={locale} categories={dict.categories} t={t} storiesT={dict.stories} authT={dict.auth} />
      </div>
    </Container>
  );
}
