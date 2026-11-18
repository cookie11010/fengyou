import Image from "next/image";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Photo } from "@/types/content";

type HeroProps = {
  locale: Locale;
  photo: Photo;
  t: Dictionary["home"]["hero"];
};

/**
 * Full-bleed photo with the text on a dark gradient so it stays readable.
 * On phones the text sits at the bottom, within thumb reach; on desktop it moves left.
 */
export function Hero({ locale, photo, t }: HeroProps) {
  return (
    <section aria-labelledby="hero-title" className="relative isolate flex min-h-[80svh] items-end overflow-hidden lg:min-h-[85svh] lg:items-center">
      <Image
        src={photo.src}
        alt={photo.alt[locale]}
        fill
        sizes="100vw"
        loading="eager"
        fetchPriority="high"
        className="-z-10 object-cover"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-t from-brand-900/90 via-brand-900/45 to-transparent lg:bg-gradient-to-r lg:from-brand-900/85 lg:via-brand-900/40"
      />

      <Container className="pb-12 pt-32 text-white lg:py-24">
        <div className="max-w-xl">
          <p className="text-sm font-medium tracking-wide text-accent-400">{t.eyebrow}</p>
          <h1 id="hero-title" className="mt-3 font-display text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
            {t.title}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-white/90">{t.subtitle}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="#destinations">{t.cta}</ButtonLink>
            <ButtonLink href="#routes" variant="onDark">
              {t.secondary}
            </ButtonLink>
          </div>
        </div>
      </Container>
    </section>
  );
}
