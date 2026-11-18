"use client";

// Two steps: email → 6-digit code. Using a code instead of only a magic link
// means sign-in finishes in the same tab, even if the email is opened on
// another device.
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/lib/format";
import { safeNextPath, useSession } from "./SessionProvider";

const inputClass =
  "mt-1 block w-full rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink focus:border-brand-500";

export function SignInForm({ locale, t }: { locale: Locale; t: Dictionary["auth"] }) {
  const { status, supabase } = useSession();
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in (or just finished): go where the visitor was heading.
  useEffect(() => {
    if (status === "signed-in") {
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(safeNextPath(next, `/${locale}/itinerary`));
    }
  }, [status, locale, router]);

  if (status === "unavailable") return <p className="rounded-xl bg-sand p-4 text-muted">{t.unavailable}</p>;

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      // display_name is only used when this creates a new account (see handle_new_user).
      options: { shouldCreateUser: true, data: name.trim() ? { display_name: name.trim() } : undefined },
    });
    setBusy(false);
    if (error) setError(t.sendFailed);
    else setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    setBusy(false);
    if (error) setError(t.invalidCode);
    // On success the SessionProvider sees the new session and the effect above redirects.
  }

  return (
    <div className="max-w-md">
      {step === "email" ? (
        <form onSubmit={sendCode} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-ink">{t.email}</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink">{t.name}</span>
            <input
              type="text"
              maxLength={60}
              autoComplete="nickname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-describedby="name-hint"
              className={inputClass}
            />
            <span id="name-hint" className="mt-1 block text-xs text-muted">{t.nameHint}</span>
          </label>
          <SubmitButton busy={busy} label={t.sendCode} busyLabel={t.sending} />
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-4">
          <p className="text-muted" role="status">{fill(t.codeSent, { email: email.trim() })}</p>
          <label className="block">
            <span className="text-sm font-medium text-ink">{t.code}</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6,10}"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className={`${inputClass} tracking-[0.3em]`}
            />
          </label>
          <SubmitButton busy={busy} label={t.verify} busyLabel={t.verifying} />
          <button
            type="button"
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
            }}
            className="block text-sm text-brand-700 underline-offset-2 hover:underline"
          >
            {t.useOtherEmail}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-700">
          {error}
        </p>
      )}
    </div>
  );
}

function SubmitButton({ busy, label, busyLabel }: { busy: boolean; label: string; busyLabel: string }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="inline-flex min-h-12 items-center justify-center rounded-full bg-brand-600 px-6 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
    >
      {busy ? busyLabel : label}
    </button>
  );
}
