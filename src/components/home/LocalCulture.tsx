import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { cn } from "@/lib/cn";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { CultureTopic } from "@/types/content";

type Props = { locale: Locale; topics: CultureTopic[]; t: Dictionary["home"]["culture"] };

/** Photo + short story rows. On desktop the photo alternates left and right. */
export function LocalCulture({ locale, topics, t }: Props) {
  return (
    <section id="culture" aria-labelledby="culture-title" className="scroll-mt-20 py-16 sm:py-24">
      <Container>
        <SectionHeading id="culture-title" eyebrow={t.eyebrow} title={t.title} description={t.description} />

        <div className="mt-12 space-y-12 sm:space-y-16">
          {topics.map((topic, i) => (
            <article key={topic.slug} className="grid items-center gap-6 md:grid-cols-2 md:gap-12">
              <div className={cn("relative aspect-[4/3] overflow-hidden rounded-2xl", i % 2 === 1 && "md:order-2")}>
                <Image
                  src={topic.image.src}
                  alt={topic.image.alt[locale]}
                  fill
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="object-cover"
                />
              </div>
              <div>
                <p aria-hidden="true" className="font-display text-5xl font-semibold text-brand-100">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-2 font-display text-2xl font-semibold text-ink sm:text-3xl">{topic.title[locale]}</h3>
                <p className="mt-3 text-base leading-relaxed text-muted sm:text-lg">{topic.body[locale]}</p>
              </div>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
