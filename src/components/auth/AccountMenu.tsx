"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { cn } from "@/lib/cn";
import { useSession } from "./SessionProvider";

type Props = { locale: Locale; t: Dictionary["auth"]; layout: "inline" | "stacked" };

/** "Sign in" link, or the signed-in name with a Sign out button. */
export function AccountMenu({ locale, t, layout }: Props) {
  const { status, profile, signOut } = useSession();
  const pathname = usePathname();

  if (status === "unavailable") return null;
  if (status === "loading") return <span aria-hidden="true" className="inline-block h-9 w-20 animate-pulse rounded-full bg-sand" />;

  if (status === "signed-out") {
    return (
      <Link
        href={`/${locale}/sign-in?next=${encodeURIComponent(pathname)}`}
        className="inline-flex min-h-9 items-center rounded-full border border-line bg-surface px-4 text-sm font-medium text-ink hover:border-brand-500 hover:text-brand-700"
      >
        {t.signIn}
      </Link>
    );
  }

  return (
    <div className={cn("flex items-center gap-2 text-sm", layout === "stacked" && "justify-between")}>
      <span className="max-w-[10rem] truncate text-muted" title={profile?.display_name}>
        {profile?.display_name}
      </span>
      <button
        type="button"
        onClick={() => void signOut()}
        className="inline-flex min-h-9 items-center rounded-full px-3 font-medium text-brand-700 hover:bg-brand-50"
      >
        {t.signOut}
      </button>
    </div>
  );
}
