import type { Metadata } from "next";
import { SignInForm } from "@/components/auth/SignInForm";
import { Container } from "@/components/ui/Container";
import { getDictionary, getLocale } from "@/i18n/dictionaries";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: `${dict.auth.title} | FengYou`, robots: { index: false } };
}

export default async function SignInPage() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  return (
    <Container className="py-10 sm:py-16">
      <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">{dict.auth.title}</h1>
      <p className="mt-2 max-w-md text-muted">{dict.auth.intro}</p>
      <div className="mt-8">
        <SignInForm locale={locale} t={dict.auth} />
      </div>
    </Container>
  );
}
