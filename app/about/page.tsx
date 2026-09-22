import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "../components/SiteHeader";

export const metadata: Metadata = {
  title: "About — LifeLine",
  description: "Who built LifeLine and how it works.",
};

export default function AboutPage() {
  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-5 pb-16 sm:px-10">
      <SiteHeader current="about" />

      <article className="mx-auto max-w-3xl space-y-8">
        <header>
          <h1 className="headline-georgia text-3xl sm:text-4xl text-accent-700">About LifeLine</h1>
          <p className="mt-3 text-lg leading-relaxed text-neutral-700">
            LifeLine turns a few sentences about your housing situation into a clear, ordered plan of local
            programs that may be able to help, with an honest account of why each one is on the list.
          </p>
        </header>

        <section className="rounded-none bg-sunflower p-5 sm:p-8 space-y-3">
          <h2 className="text-2xl font-semibold text-neutral-900">Who we are</h2>
          <p className="leading-relaxed text-neutral-800">
            We are <strong>Caleb Suh</strong> and <strong>Lior Balan</strong>, juniors at Los Altos High School. We
            are drawn to the moments when people have to make a decision and a lot rides on getting it right. Few
            decisions are heavier than what to do when you might lose your home.
          </p>
          <p className="leading-relaxed text-neutral-800">
            We grew up in Los Altos, where the cost of housing is among the highest in the country. Watching
            families around us stretch to stay put made one thing obvious: the help that exists is scattered across
            dozens of websites, hotlines, and PDFs, and the people who need it most have the least time to hunt for
            it. LifeLine is our attempt to close that gap.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-neutral-900">How it works</h2>
          <ol className="space-y-3 text-neutral-800 leading-relaxed">
            <li className="rounded-none bg-neutral-50 p-4">
              <strong>1. You describe what is going on.</strong> Plain language is fine. If we need one more detail
              to narrow things down, we ask a single follow-up question, never a long form.
            </li>
            <li className="rounded-none bg-neutral-50 p-4">
              <strong>2. Rules pick and rank the programs.</strong> Every resource is checked against fixed,
              transparent criteria: where you live, whether the program is open, and whether anything you told us
              rules it out. Programs are ordered by how well they fit and how quickly they can respond.
            </li>
            <li className="rounded-none bg-neutral-50 p-4">
              <strong>3. You see the reasoning.</strong> Each program shows exactly which facts matched, which we
              could not confirm, and what documents to bring. AI only helps read your description and write the
              summary. It never chooses or invents a resource.
            </li>
          </ol>
        </section>

        <section className="rounded-none bg-accent-50 p-5 sm:p-6 space-y-2">
          <h2 className="text-xl font-semibold text-accent-900">What LifeLine is not</h2>
          <p className="leading-relaxed text-neutral-800">
            LifeLine does not decide who qualifies for anything. Every organization makes its own decision, and
            program details change with funding. We mark what still needs to be verified so you can walk in
            prepared instead of surprised.
          </p>
        </section>

        <p className="text-neutral-700">
          Read more about <Link href="/mission" className="underline text-accent-700">why we built this</Link>, or{" "}
          <Link href="/" className="underline text-accent-700">get your plan</Link>.
        </p>
      </article>
    </main>
  );
}
