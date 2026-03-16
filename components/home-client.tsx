"use client";

import { useEffect, useState } from "react";
import { Uploader } from "./uploader";
import { copy, type Locale } from "../lib/i18n";

const STORAGE_KEY = "image-bg-remover-locale";

export function HomeClient() {
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "zh") {
      setLocale(saved);
    }
  }, []);

  const toggleLocale = () => {
    setLocale((prev) => {
      const next = prev === "en" ? "zh" : "en";
      window.localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  };

  const t = copy[locale];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.18),_transparent_30%),linear-gradient(180deg,_#020617_0%,_#020617_100%)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-16 px-6 py-10 sm:px-10 lg:px-12">
        <header className="flex flex-col gap-6 rounded-[2rem] border border-slate-800 bg-slate-900/60 p-8 shadow-soft backdrop-blur sm:p-10">
          <div className="flex items-center justify-between gap-4">
            <div className="inline-flex w-fit rounded-full border border-brand-400/30 bg-brand-500/10 px-4 py-1 text-sm text-brand-100">
              {t.heroBadge}
            </div>
            <button
              type="button"
              onClick={toggleLocale}
              className="rounded-full border border-slate-600 px-4 py-1 text-sm font-medium text-slate-100 transition hover:border-slate-400"
            >
              {t.localeLabel} → {t.switchTo}
            </button>
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
