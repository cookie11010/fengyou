import type { Metadata } from "next";
import { StoryList } from "@/components/stories/StoryList";
import { StoryReactionsProvider } from "@/components/stories/StoryReactionsProvider";
import { StoryWorkspace } from "@/components/stories/StoryWorkspace";
import { Container } from "@/components/ui/Container";
import { getMapDestinations } from "@/data/map";
import { getPublishedStories } from "@/data/stories";
import { getDictionary, getLocale } from "@/i18n/dictionaries";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: `${dict.stories.title} | FengYou`, description: dict.stories.description };
}

export default async function StoriesPage() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const [{ status, stories }, { destinations }] = await Promise.all([getPublishedStories(locale), getMapDestinations(locale)]);
  const isExample = status === "example";
  const t = dict.stories;
  const places = destinations.map((d) => ({ id: d.id, name: d.name }));

  return (
    <Container className="py-8 sm:py-12">
      <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">{t.title}</h1>
      <p className="mt-2 max-w-2xl text-muted">{t.description}</p>
      {isExample && (
        <p role="note" className="mt-4 max-w-2xl rounded-xl bg-accent-400/15 px-4 py-2 text-sm text-ink">
          {t.exampleNotice}
        </p>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_24rem]">
        <section aria-label={t.title}>
          <StoryReactionsProvider locale={locale}>
            <StoryList stories={stories} locale={locale} t={t} saveLabels={dict.save} isExample={isExample} />
          </StoryReactionsProvider>
        </section>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <StoryWorkspace locale={locale} places={places} t={t} authT={dict.auth} />
        </aside>
      </div>
    </Container>
  );
}
