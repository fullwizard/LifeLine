import { Barlow_Condensed } from "next/font/google";
import { LifeLineApp } from "./components/LifeLineApp";

const headlineFont = Barlow_Condensed({
  subsets: ["latin"],
  weight: "600",
  display: "swap",
});

export default function Home() {
  const aiEnabled = Boolean(process.env.GEMINI_API_KEY?.trim());
  return (
    <main id="home" className="flex-1 w-full max-w-6xl mx-auto px-5 pb-10 sm:px-10">
      <header className="mb-12 md:mb-16">
        <div className="site-masthead py-6">
          <span aria-label="LifeLine" className="site-brand font-bold tracking-tight text-accent-700">LifeLine<span aria-hidden="true">.</span></span>
          <nav aria-label="Main navigation" className="site-nav">
            <span>Home</span>
            <span>About</span>
            <span>Our mission</span>
          </nav>
        </div>
        <div className="mt-12 grid gap-6 md:mt-20 md:grid-cols-[1.58fr_1fr] md:gap-8">
          <h1 className={`${headlineFont.className} text-5xl sm:text-6xl lg:text-7xl leading-[1.05] text-balance`}>
            Housing help, in the right order.
          </h1>
          <p className="intro-brush text-neutral-900 leading-relaxed md:self-end">
            Tell us what is going on. We will match you with local programs, explain why each one is on
            your list, and be clear about what still needs to be confirmed.
          </p>
        </div>
      </header>
      <LifeLineApp aiEnabled={aiEnabled} />
    </main>
  );
}
