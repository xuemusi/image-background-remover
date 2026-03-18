"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Uploader } from "./uploader";
import { copy, type Locale } from "../lib/i18n";

const STORAGE_KEY = "image-bg-remover-locale";

type SessionUser = {
  name?: string;
  email?: string;
  picture?: string;
};

export function HomeClient() {
  const [locale, setLocale] = useState<Locale>("en");
  const [authLoading, setAuthLoading] = useState(true);
  const [authRedirecting, setAuthRedirecting] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "zh") {
      setLocale(saved);
    }
  }, []);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const response = await fetch("/api/auth/session", { credentials: "include" });
        if (!response.ok) return;
        const data = await response.json();
        setUser(data?.authenticated ? data.user : null);
      } finally {
        setAuthLoading(false);
      }
    };

    loadSession();
  }, []);

  const toggleLocale = () => {
    setLocale((prev) => {
      const next = prev === "en" ? "zh" : "en";
      window.localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  };

  const handleSignIn = () => {
    setAuthRedirecting(true);
    window.location.href = `/api/auth/google/start?locale=${locale}`;
  };

  const handleSignOut = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include"
    });
    window.location.reload();
  };

  const t = copy[locale];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.18),_transparent_30%),linear-gradient(180deg,_#020617_0%,_#020617_100%)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-16 px-6 py-10 sm:px-10 lg:px-12">
        <header className="flex flex-col gap-6 rounded-[2rem] border border-slate-800 bg-slate-900/60 p-8 shadow-soft backdrop-blur sm:p-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex w-fit rounded-full border border-brand-400/30 bg-brand-500/10 px-4 py-1 text-sm text-brand-100">
              {t.heroBadge}
            </div>
            <div className="flex items-center gap-3 self-end sm:self-auto">
              <button
                type="button"
                onClick={toggleLocale}
                className="rounded-full border border-slate-600 px-4 py-1 text-sm font-medium text-slate-100 transition hover:border-slate-400"
              >
                {t.localeLabel} → {t.switchTo}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 sm:p-5">
            {user ? (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  {user.picture ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.picture} alt={user.name || "avatar"} className="h-10 w-10 rounded-full border border-slate-700" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 text-xs text-slate-300">
                      G
                    </div>
                  )}
                  <div>
                    <p className="text-xs uppercase tracking-[0.15em] text-slate-400">{t.signedInAs}</p>
                    <p className="text-sm text-slate-100">{user.name || user.email || "Google User"}</p>
                    {user.email ? <p className="text-xs text-slate-400">{user.email}</p> : null}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href="/dashboard"
                    className="rounded-full border border-slate-600 px-4 py-1 text-sm font-medium text-slate-100 transition hover:border-slate-400"
                  >
                    {t.dashboard}
                  </Link>
                  <Link
                    href="/dashboard#buy"
                    className="rounded-full border border-emerald-500/50 px-4 py-1 text-sm font-medium text-emerald-200 transition hover:border-emerald-300"
                  >
                    Buy Credits
                  </Link>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="rounded-full border border-slate-600 px-4 py-1 text-sm font-medium text-slate-100 transition hover:border-slate-400"
                  >
                    {t.signOut}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-300">{authLoading ? "..." : t.notSignedIn}</p>
                <button
                  type="button"
                  onClick={handleSignIn}
                  disabled={authRedirecting}
                  className="rounded-full bg-white px-4 py-1 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {authRedirecting ? t.signingIn : t.signInWithGoogle}
                </button>
              </div>
            )}
          </div>

          <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
            <div className="space-y-5">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">{t.heroTitle}</h1>
              <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">{t.heroDescription}</p>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-400">{t.howItWorks}</p>
              <ol className="mt-4 space-y-3 text-sm text-slate-300">
                {t.steps.map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-semibold text-white">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </header>

        <Uploader t={t.uploader} />

        <section className="grid gap-6 md:grid-cols-3">
          {t.features.map((feature) => (
            <article key={feature.title} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
              <h2 className="text-lg font-semibold text-white">{feature.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">{feature.text}</p>
            </article>
          ))}
        </section>

        <section id="faq" className="rounded-[2rem] border border-slate-800 bg-slate-900/60 p-8 sm:p-10">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold text-white">{t.faqTitle}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">{t.faqIntro}</p>
          </div>
          <div className="mt-8 grid gap-4">
            {t.faqs.map((faq) => (
              <article key={faq.question} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
                <h3 className="text-lg font-medium text-white">{faq.question}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{faq.answer}</p>
              </article>
            ))}
          </div>
        </section>

        <footer className="border-t border-slate-800 pb-6 pt-2 text-sm text-slate-500">{t.footer}</footer>
      </div>
    </main>
  );
}
