import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "../components/SiteHeader";

export const metadata: Metadata = {
  title: "Our mission — LifeLine",
  description: "Why we built LifeLine and what we promise the people who use it.",
};

export default function MissionPage() {
  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-5 pb-16 sm:px-10">
      <SiteHeader current="mission" />

      <article className="mx-auto max-w-3xl space-y-8">
        <header>
          <h1 className="headline-georgia text-3xl sm:text-4xl text-accent-700">Our mission</h1>
          <p className="mt-3 text-xl leading-relaxed text-neutral-800">
            When the stakes are high, everyone deserves a clear next step.
          </p>
        </header>

        <section className="space-y-4 leading-relaxed text-neutral-800">
          <p>
            Hard moments are not rare. In the Bay Area, where we live, a single missed paycheck or an
            unexpected bill can put a family a few weeks away from an eviction notice, an empty fridge, or a
            shut-off. The programs designed to catch people in those moments exist, but finding the right one
            means knowing what to search for, decoding eligibility rules, and calling around while the clock
            runs.
          </p>
          <p>
            We are Caleb Suh and Lior Balan, two juniors at Los Altos High School. We care about the decisions
            people make under pressure, and we noticed that the people facing the hardest ones were getting the
            least help making them. Our mission is to give anyone in a tough spot a plan they can act on in
            minutes: the right programs, in the right order, with the reasoning laid out plainly. Housing was
            our starting point because it is where the stakes are highest, and the same approach now covers food,
            utilities, legal help, health care, benefits, and support for families, veterans, and older adults.
            We started in the Bay Area because it is home, and we are building toward verified, up-to-date
            listings that can serve more communities over time.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-neutral-900">What we promise</h2>
          <ul className="list-disc space-y-3 pl-6 text-neutral-800 leading-relaxed marker:text-accent-700">
            <li>
              Clarity over cleverness. Resources are chosen by transparent rules, not by a black
              box. You can see why every program is on your list.
            </li>
            <li>
              Honesty about uncertainty. We will never tell you that you qualify. We show what
              matched, what still needs confirming, and who makes the final call.
            </li>
            <li>
              Respect for your time. One description, a short set of focused questions, and a plan. No
              accounts, no forms that take an hour.
            </li>
            <li>
              Privacy by default. Nothing you type is stored. Your situation is yours.
            </li>
          </ul>
        </section>

        <p className="text-neutral-700">
          Learn <Link href="/about" className="underline text-accent-700">how LifeLine works</Link>, or{" "}
          <Link href="/" className="underline text-accent-700">get your plan</Link>.
        </p>
      </article>
    </main>
  );
}
