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
            Housing insecurity is not a rare problem. In the Bay Area, where we live, a single missed paycheck or
            an unexpected bill can put a family a few weeks away from an eviction notice. The programs designed to
            catch people in that moment exist, but finding the right one means knowing what to search for,
            decoding eligibility rules, and calling around while the clock runs.
          </p>
          <p>
            We are Caleb Suh and Lior Balan, two juniors at Los Altos High School. We care about the decisions
            people make under pressure, and we noticed that the people facing the hardest one, how to keep a roof
            overhead, were getting the least help making it. Our mission is to give anyone facing housing
            instability a plan they can act on in minutes: the right programs, in the right order, with the
            reasoning laid out plainly.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-neutral-900">What we promise</h2>
          <ul className="space-y-3 text-neutral-800 leading-relaxed">
            <li className="rounded-none bg-sunflower p-4">
              <strong>Clarity over cleverness.</strong> Resources are chosen by transparent rules, not by a black
              box. You can see why every program is on your list.
            </li>
            <li className="rounded-none bg-sunflower p-4">
              <strong>Honesty about uncertainty.</strong> We will never tell you that you qualify. We show what
              matched, what still needs confirming, and who makes the final call.
            </li>
            <li className="rounded-none bg-sunflower p-4">
              <strong>Respect for your time.</strong> One description, at most one question, and a plan. No
              accounts, no forms that take an hour.
            </li>
            <li className="rounded-none bg-sunflower p-4">
              <strong>Privacy by default.</strong> Nothing you type is stored. Your situation is yours.
            </li>
          </ul>
        </section>

        <section className="rounded-none bg-neutral-50 p-5 sm:p-6 space-y-2">
          <h2 className="text-xl font-semibold text-neutral-900">Where we are headed</h2>
          <p className="leading-relaxed text-neutral-800">
            LifeLine started with the Bay Area because it is home. The approach works anywhere there is a
            directory of local programs to draw from, and we are building the tools to bring in verified,
            up-to-date listings for more communities. If you run a program or know one that should be here, we
            want to hear from you.
          </p>
        </section>

        <p className="text-neutral-700">
          Learn <Link href="/about" className="underline text-accent-700">how LifeLine works</Link>, or{" "}
          <Link href="/" className="underline text-accent-700">get your plan</Link>.
        </p>
      </article>
    </main>
  );
}
