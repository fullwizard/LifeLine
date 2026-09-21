import Image from "next/image";
import { HomeLink } from "./components/HomeLink";
import { LifeLineApp } from "./components/LifeLineApp";

export default function Home() {
  const aiEnabled = Boolean(process.env.GEMINI_API_KEY?.trim());
  return (
    <main id="home" className="flex-1 w-full max-w-6xl mx-auto px-5 pb-10 sm:px-10">
      <header className="mb-6">
        <div className="site-masthead py-6">
          <Image src="/lifeline-logo.png" alt="LifeLine" width={1000} height={1000} className="site-brand" priority />
          <nav aria-label="Main navigation" className="site-nav">
            <HomeLink />
            <span>About</span>
            <span>Our mission</span>
          </nav>
        </div>
      </header>
      <LifeLineApp aiEnabled={aiEnabled} />
    </main>
  );
}
