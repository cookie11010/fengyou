import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { buildNavLinks } from "@/lib/navigation";

export async function SiteFooter() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const links = buildNavLinks(locale, dict.nav);

  return (
    <footer className="mt-auto bg-brand-900 text-white/80">
      <Container className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_2fr]">
        <div>
          {/* Light version of the logo for the dark footer. */}
          <Image
            src="/brand/fengyou-logo-light.png"
            alt="風遊 FengYou"
            width={720}
            height={387}
            unoptimized
            className="h-20 w-auto"
          />
          <p className="mt-3 max-w-xs text-sm leading-relaxed">{dict.footer.tagline}</p>
        </div>

        <nav aria-labelledby="footer-explore">
          <h2 id="footer-explore" className="text-sm font-semibold text-white">{dict.footer.explore}</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="hover:text-white hover:underline">{link.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="text-sm font-semibold text-white">{dict.footer.project}</h2>
          <p className="mt-3 text-sm leading-relaxed">{dict.footer.projectText}</p>
        </div>
      </Container>
      <div className="border-t border-white/10">
        <Container className="py-5 text-xs text-white/60">© {dict.footer.rights}</Container>
      </div>
    </footer>
  );
}
