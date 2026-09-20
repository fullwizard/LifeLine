import { LifeLineApp } from "./components/LifeLineApp";

export default function Home() {
  const aiEnabled = Boolean(process.env.GEMINI_API_KEY?.trim());
  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-10 sm:py-14">
      <header className="mb-8">
        <p className="text-sm font-medium tracking-wide text-teal-700 uppercase">LifeLine</p>
        <h1 className="mt-1 text-3xl sm:text-4xl font-semibold tracking-tight">
          Housing help, in the right order.
        </h1>
        <p className="mt-3 text-stone-600 leading-relaxed">
          Tell us what is going on. We will match you with local programs, explain why each one is on
          your list, and be clear about what still needs to be confirmed.
        </p>
      </header>
      <LifeLineApp aiEnabled={aiEnabled} />
      <footer className="mt-16 text-xs text-stone-500 leading-relaxed">
        Nothing you type is saved. LifeLine is an MVP running on sample resource data for the Seattle
        area. Always confirm program details with the organization.
      </footer>
    </main>
  );
}
