import { Uploader } from "../components/uploader";

const faqs = [
  {
    question: "What image formats are supported?",
    answer: "JPG, PNG, and WebP are supported in this MVP. Keep files within 10MB."
  },
  {
    question: "Do you store my images?",
    answer: "No. Images are only forwarded in-memory during the request lifecycle and are not persisted by this app."
  },
  {
    question: "Is this free?",
    answer: "This MVP is built for validation. Usage cost depends on remove.bg API pricing, so limits may be added later."
  }
];

const steps = [
  "Upload a product shot, portrait, or avatar.",
  "The server forwards it to remove.bg securely using a server-side API key.",
  "Preview the transparent PNG and download it instantly."
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.18),_transparent_30%),linear-gradient(180deg,_#020617_0%,_#020617_100%)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-16 px-6 py-10 sm:px-10 lg:px-12">
        <header className="flex flex-col gap-6 rounded-[2rem] border border-slate-800 bg-slate-900/60 p-8 shadow-soft backdrop-blur sm:p-10">
          <div className="inline-flex w-fit rounded-full border border-brand-400/30 bg-brand-500/10 px-4 py-1 text-sm text-brand-100">
            Cloudflare-ready MVP · Next.js + Tailwind CSS
          </div>
          <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
            <div className="space-y-5">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Image Background Remover
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                Remove background from images instantly. This MVP focuses on the fastest possible flow: upload,
                process, preview, and download a transparent PNG.
              </p>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-400">How it works</p>
              <ol className="mt-4 space-y-3 text-sm text-slate-300">
                {steps.map((step, index) => (
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

        <Uploader />

        <section className="grid gap-6 md:grid-cols-3">
          {[
            ["Fast MVP", "Designed for Cloudflare deployment with a minimal moving-parts stack."],
            ["No persistent storage", "Images stay in request memory only. No history, no user accounts, no database."],
            ["SEO-ready homepage", "Static marketing copy, FAQ, metadata, and room for future landing pages."]
          ].map(([title, text]) => (
            <article key={title} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
              <h2 className="text-lg font-semibold text-white">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">{text}</p>
            </article>
          ))}
        </section>

        <section id="faq" className="rounded-[2rem] border border-slate-800 bg-slate-900/60 p-8 sm:p-10">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold text-white">FAQ</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Short answers for the first release. Expand this into a richer SEO section later.
            </p>
          </div>
          <div className="mt-8 grid gap-4">
            {faqs.map((faq) => (
              <article key={faq.question} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
                <h3 className="text-lg font-medium text-white">{faq.question}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{faq.answer}</p>
              </article>
            ))}
          </div>
        </section>

        <footer className="border-t border-slate-800 pb-6 pt-2 text-sm text-slate-500">
          Built for MVP validation. Privacy-first by design: no account, no storage, server-side API key only.
        </footer>
      </div>
    </main>
  );
}
