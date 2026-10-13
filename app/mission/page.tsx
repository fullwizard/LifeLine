import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "../components/SiteHeader";

export const metadata: Metadata = {
  title: "Our mission — LifeLine",
  description: "Why we built LifeLine and what we promise the people who use it.",
};

export default function MissionPage() {
  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-4 pb-16 sm:px-8">
      <SiteHeader current="mission" />

      <article className="mx-auto max-w-3xl space-y-10 py-2 sm:py-6">
        <header className="max-w-2xl">
          <p className="text-sm font-semibold text-accent-700">Our mission</p>
          <h1 className="mt-2 text-4xl font-semibold leading-[1.08] tracking-[-0.035em] text-neutral-950 sm:text-5xl">
            A clear next step when it matters most.
          </h1>
        </header>

        <p className="max-w-2xl text-lg leading-relaxed text-neutral-800">
          Useful programs already exist. Finding the right one should not require hours of searching through government pages. LifeLine turns a difficult situation into a short, practical plan.
        </p>

        <section className="grid gap-3 sm:grid-cols-[10rem_1fr] sm:gap-6">
          <h2 className="text-base font-semibold text-neutral-950">What we promise</h2>
          <ul className="space-y-3 text-neutral-800">
            <li className="flex gap-3"><span className="mt-2 h-2 w-2 shrink-0 bg-signal" aria-hidden />Show why each program fits.</li>
            <li className="flex gap-3"><span className="mt-2 h-2 w-2 shrink-0 bg-signal" aria-hidden />Mark what still needs confirmation.</li>
            <li className="flex gap-3"><span className="mt-2 h-2 w-2 shrink-0 bg-signal" aria-hidden />Ask only for details that improve the plan.</li>
            <li className="flex gap-3"><span className="mt-2 h-2 w-2 shrink-0 bg-signal" aria-hidden />Do not save what you type.</li>
          </ul>
        </section>

        <p className="pt-2 text-neutral-700">
          Learn <Link href="/about" className="underline text-accent-700">how LifeLine works</Link>, or{" "}
          <Link href="/" className="underline text-accent-700">get your plan</Link>.
        </p>
      </article>
    </main>
  );
}
