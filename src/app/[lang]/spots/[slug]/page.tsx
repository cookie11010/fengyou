// One place's own page: the photo and full description, "Add to trip" and
// directions, then what to eat there, stories about it, and a discussion.
//
// Pages for the places that exist at build time are prerendered. A place
// added later (anyone can add one) gets its page on the first visit, which is
// then cached (see "ISR with Cache Components" in the Next.js docs).
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SaveToItineraryButton } from "@/components/itinerary/SaveToItineraryButton";
import { OriginBadge } from "@/components/map/OriginBadge";
import { PlaceTalk } from "@/components/place/PlaceTalk";
import { Container } from "@/components/ui/Container";
import { getMapDestinations } from "@/data/map";
import { getPublishedStories } from "@/data/stories";
import { hasLocale, localeLabels, type Locale } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { fill } from "@/lib/format";

export async function generateStaticParams({ params }: { params: { lang: string } }) {
  if (!hasLocale(params.lang)) return [];
  const { destinations } = await getMapDestinations(params.lang);
  return destinations.map((d) => ({ slug: d.slug }));
}

async function findPlace(locale: Locale, slug: string) {
  const { destinations } = await getMapDestinations(locale);
  return destinations.find((d) => d.slug === slug);
}

export async function generateMetadata({ params }: PageProps<"/[lang]/spots/[slug]">): Promise<Metadata> {
  const [{ slug }, locale] = await Promise.all([params, getLocale()]);
  const place = await findPlace(locale, slug);
  return place ? { title: `${place.name} | FengYou`, description: place.summary } : {};
}

export default function PlacePage(props: PageProps<"/[lang]/spots/[slug]">) {
  return (
    <Suspense fallback={<PlaceSkeleton />}>
      <PlaceDetails {...props} />
    </Suspense>
  );
}

async function PlaceDetails({ params }: PageProps<"/[lang]/spots/[slug]">) {
  const [{ slug }, locale, dict] = await Promise.all([params, getLocale(), getDictionary()]);
  const place = await findPlace(locale, slug);
  if (!place) notFound();

  const t = dict.place;
  const spotsT = dict.spots;
  const { stories } = await getPublishedStories(locale);
  const about = stories.filter((s) => s.place.id === place.id);
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`;
  const credit = place.image?.credit;

  return (
    <article className="fy-pop">
      {/* Photo header, like the home page's hero but shorter. */}
      <header className="relative isolate flex min-h-[45svh] items-end overflow-hidden bg-brand-900 sm:min-h-[55svh]">
        {place.image && (
          <Image src={place.image.src} alt={place.image.alt} fill sizes="100vw" loading="eager" fetchPriority="high" className="-z-10 object-cover" />
        )}
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-brand-900/90 via-brand-900/40 to-transparent" />
        <Container className="pb-8 pt-24 text-white">
          <Link href={`/${locale}/spots`} className="inline-flex items-center gap-1 text-sm font-medium text-white/90 underline-offset-2 hover:underline">
            <span aria-hidden="true">←</span> {t.backToMap}
          </Link>
          <p className="mt-4 flex flex-wrap items-center gap-2 text-sm font-medium text-accent-400">
            {dict.categories[place.category]}
            <OriginBadge origin={place.origin} labels={{ official: spotsT.originOfficial, community: spotsT.originCommunity }} />
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold leading-tight sm:text-5xl">{place.name}</h1>
          {place.address && <p className="mt-2 text-white/85">{place.address}</p>}
        </Container>
      </header>

      <Container className="py-8 sm:py-12">
        <div className="grid gap-10 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-12">
            <section aria-label={t.about}>
              <p className="max-w-prose text-lg leading-relaxed text-ink">{place.summary}</p>
              {credit && (
                <p className="mt-3 text-xs text-muted">
                  {credit.sourceUrl ? (
                    <a href={credit.sourceUrl} target="_blank" rel="noopener" className="underline-offset-2 hover:underline">
                      {fill(spotsT.photoBy, { author: credit.author, license: credit.license })}
                    </a>
                  ) : (
                    fill(spotsT.photoBy, { author: credit.author, license: credit.license })
                  )}
                </p>
              )}
              {/* Jump links to the sections below. */}
              <nav aria-label={t.onThisPage} className="mt-6 flex flex-wrap gap-2 text-sm">
                {[
                  ["#food", t.foodTitle],
                  ["#stories", t.storiesTitle],
                  ["#discussion", t.discussionTitle],
                ].map(([href, label]) => (
                  <a key={href} href={href} className="rounded-full bg-sand px-4 py-2 font-medium text-ink hover:bg-brand-50 hover:text-brand-700">
                    {label}
                  </a>
                ))}
              </nav>
            </section>

            {/* Food tips and the discussion are live (loaded in the browser); the
                stories section in between is rendered here on the server. */}
            <PlaceTalk
              destinationId={place.id}
              slug={place.slug}
              placeName={place.name}
              locale={locale}
              t={t}
              storiesSlot={
              <section id="stories" aria-labelledby="stories-heading" className="scroll-mt-24">
                <h2 id="stories-heading" className="font-display text-2xl font-semibold text-ink">
                  {t.storiesTitle} <span className="text-muted">({about.length})</span>
                </h2>
                {about.length === 0 ? (
                  <p className="mt-4 rounded-2xl bg-sand p-5 text-sm text-muted">
                    {t.storiesEmpty}{" "}
                    <Link href={`/${locale}/stories`} className="font-medium text-brand-700 underline underline-offset-2">{t.writeStory}</Link>
                  </p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {about.map((s) => (
                      <li key={s.id} className="rounded-2xl bg-surface p-4 ring-1 ring-line">
                        <p className="text-xs font-medium text-brand-600">
                          {s.kind === "tip" ? dict.stories.kindTip : dict.stories.kindStory}
                          {s.authorName && <> · {fill(dict.stories.by, { name: s.authorName })}</>}
                          {hasLocale(s.locale) && s.locale !== locale && <> · {fill(dict.stories.writtenIn, { language: localeLabels[s.locale] })}</>}
                        </p>
                        <h3 lang={s.locale} className="mt-1 font-display text-lg font-semibold text-ink">{s.title}</h3>
                        <p lang={s.locale} className="mt-1 line-clamp-3 text-sm text-muted">{s.body}</p>
                      </li>
                    ))}
                    <li>
                      <Link href={`/${locale}/stories`} className="text-sm font-medium text-brand-700 underline-offset-2 hover:underline">
                        {t.allStories} <span aria-hidden="true">→</span>
                      </Link>
                    </li>
                  </ul>
                )}
              </section>
              }
            />
          </div>

          {/* Actions: beside the text on desktop, above it in reading order on phones. */}
          <aside className="order-first space-y-4 lg:order-none lg:sticky lg:top-24 lg:self-start">
            <div className="space-y-3 rounded-2xl bg-surface p-5 ring-1 ring-line">
              <h2 className="font-display text-lg font-semibold text-ink">{t.planTitle}</h2>
              <SaveToItineraryButton destinationId={place.id} placeName={place.name} locale={locale} t={dict.save} />
              <a href={directionsUrl} target="_blank" rel="noopener" className="flex items-center gap-1 text-sm font-medium text-brand-700 underline-offset-2 hover:underline">
                {spotsT.directions} <span aria-hidden="true">↗</span>
              </a>
              <Link href={`/${locale}/spots`} className="block text-sm font-medium text-brand-700 underline-offset-2 hover:underline">
                {t.seeOnMap}
              </Link>
            </div>
          </aside>
        </div>
      </Container>
    </article>
  );
}

function PlaceSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="h-[45svh] animate-pulse bg-sand sm:h-[55svh]" />
      <Container className="space-y-4 py-8">
        <div className="h-6 w-2/3 animate-pulse rounded bg-sand" />
        <div className="h-6 w-1/2 animate-pulse rounded bg-sand" />
      </Container>
    </div>
  );
}
