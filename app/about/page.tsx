import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "../components/SiteHeader";

export const metadata: Metadata = {
  title: "About — LifeLine",
  description: "Who built LifeLine and how it works.",
};

export default function AboutPage() {
  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-4 pb-16 sm:px-8">
      <SiteHeader current="about" />

      <article className="mx-auto max-w-3xl space-y-10 py-2 sm:py-6">
        <header className="max-w-2xl">
          <h1 className="text-4xl font-semibold tracking-[-0.035em] text-neutral-950 sm:text-5xl">About LifeLine</h1>
          <p className="mt-4 text-lg leading-relaxed text-neutral-600">
            Describe what is happening. LifeLine finds relevant California programs and puts the next steps in order.
          </p>
        </header>

        <section className="grid gap-3 sm:grid-cols-[10rem_1fr] sm:gap-6">
          <h2 className="text-base font-semibold text-neutral-950">Who we are</h2>
          <p className="max-w-2xl leading-relaxed text-neutral-800">
            Caleb Suh and Lior Balan are students at Los Altos High School. We built LifeLine after seeing how hard it can be to find useful help across scattered websites, phone lines, and PDFs.
          </p>
        </section>

        <section className="grid gap-3 sm:grid-cols-[10rem_1fr] sm:gap-6">
          <h2 className="text-base font-semibold text-neutral-950">How it works</h2>
          <ol className="space-y-4 text-neutral-800">
            <li className="grid grid-cols-[2rem_1fr] gap-3"><span className="text-sm text-accent-700">01</span><span>Tell us what you need in plain language.</span></li>
            <li className="grid grid-cols-[2rem_1fr] gap-3"><span className="text-sm text-accent-700">02</span><span>Answer a few questions that change which programs fit.</span></li>
            <li className="grid grid-cols-[2rem_1fr] gap-3"><span className="text-sm text-accent-700">03</span><span>Get an ordered plan with links, calls, and documents.</span></li>
          </ol>
        </section>

        <p className="pt-2 text-neutral-700">
          Read more about <Link href="/mission" className="underline text-accent-700">why we built this</Link>, or{" "}
          <Link href="/" className="underline text-accent-700">get your plan</Link>.
        </p>
      </article>
    </main>
  );
}
