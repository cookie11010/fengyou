import Image from "next/image";
import Link from "next/link";
import { AccountMenu } from "@/components/auth/AccountMenu";
import { Container } from "@/components/ui/Container";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { buildNavLinks } from "@/lib/navigation";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { MobileMenu } from "./MobileMenu";
import { NavLinks } from "./NavLinks";

export async function SiteHeader() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const links = buildNavLinks(locale, dict.nav);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
      <Container className="relative flex h-16 items-center justify-between gap-4">
        <Link href={`/${locale}`} className="shrink-0 rounded-md">
          {/* A small local file, so it skips the image loader. The alt text is the link's name. */}
          <Image
            src="/brand/fengyou-logo.png"
            alt="風遊 FengYou"
            width={720}
            height={387}
            unoptimized
            loading="eager"
            className="h-12 w-auto"
          />
        </Link>

        {/* Desktop */}
        <div className="hidden items-center gap-4 lg:flex">
          <nav aria-label={dict.a11y.mainNav}>
            <NavLinks links={links} orientation="horizontal" />
          </nav>
          <LanguageSwitcher current={locale} label={dict.a11y.language} />
          <AccountMenu locale={locale} t={dict.auth} layout="inline" />
        </div>

        {/* Mobile */}
        <MobileMenu
          links={links}
          labels={{ open: dict.a11y.openMenu, close: dict.a11y.closeMenu, nav: dict.a11y.mainNav }}
        >
          <div className="space-y-4">
            <LanguageSwitcher current={locale} label={dict.a11y.language} />
            <AccountMenu locale={locale} t={dict.auth} layout="stacked" />
          </div>
        </MobileMenu>
      </Container>
    </header>
  );
}
