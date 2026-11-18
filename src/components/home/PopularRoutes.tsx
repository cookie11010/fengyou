import { RouteCard } from "@/components/cards/RouteCard";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Route } from "@/types/content";

type Props = { locale: Locale; routes: Route[]; t: Dictionary["home"]["routes"] };

export function PopularRoutes({ locale, routes, t }: Props) {
  return (
    <section id="routes" aria-labelledby="routes-title" className="scroll-mt-20 bg-sand py-16 sm:py-24">
      <Container>
        <SectionHeading id="routes-title" eyebrow={t.eyebrow} title={t.title} description={t.description} />
        <ul className="mt-10 grid gap-6 md:grid-cols-3">
          {routes.map((route) => (
            <li key={route.slug}>
              <RouteCard
                route={route}
                locale={locale}
                labels={{ duration: t.duration, stops: t.stops, stopsHeading: t.stopsHeading }}
              />
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
