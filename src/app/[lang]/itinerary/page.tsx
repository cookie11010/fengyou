import type { Metadata } from "next";
import { ItineraryEditor } from "@/components/itinerary/ItineraryEditor";
import { SavedStories } from "@/components/itinerary/SavedStories";
import { Container } from "@/components/ui/Container";
import { getMapDestinations } from "@/data/map";
import { getDictionary, getLocale } from "@/i18n/dictionaries";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: `${dict.itinerary.title} | FengYou`, robots: { index: false } };
}

export default async function ItineraryPage() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const { destinations } = await getMapDestinations(locale);

  return (
    <Container className="py-8 sm:py-12">
      <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">{dict.itinerary.title}</h1>
      <p className="mt-2 max-w-2xl text-muted">{dict.itinerary.description}</p>
      <div className="mt-8 max-w-3xl space-y-12">
        <ItineraryEditor locale={locale} places={destinations} t={dict.itinerary} authT={dict.auth} />
        <SavedStories locale={locale} t={dict.itinerary} storiesT={dict.stories} saveT={dict.save} />
      </div>
    </Container>
  );
}
