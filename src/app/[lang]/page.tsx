import { FeaturedDestinations } from "@/components/home/FeaturedDestinations";
import { Hero } from "@/components/home/Hero";
import { LocalCulture } from "@/components/home/LocalCulture";
import { PhotoCredits } from "@/components/home/PhotoCredits";
import { PopularRoutes } from "@/components/home/PopularRoutes";
import { cultureTopics, routes, spots } from "@/data";
import { photos } from "@/data/photos";
import { getDictionary, getLocale } from "@/i18n/dictionaries";

export default async function HomePage() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const t = dict.home;
  const heroPhoto = photos.eastGatePark;

  return (
    <>
      <Hero locale={locale} photo={heroPhoto} t={t.hero} />
      <FeaturedDestinations locale={locale} spots={spots} t={t.featured} categories={dict.categories} mapCta={dict.spots.mapCta} />
      <PopularRoutes locale={locale} routes={routes} t={t.routes} />
      <LocalCulture locale={locale} topics={cultureTopics} t={t.culture} />
      <PhotoCredits
        title={t.credits}
        photos={[heroPhoto, ...spots.map((s) => s.image), ...cultureTopics.map((c) => c.image)]}
      />
    </>
  );
}
