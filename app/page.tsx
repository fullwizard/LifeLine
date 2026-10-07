import { geminiEnabled } from "@/lib/gemini/client";
import { LifeLineApp } from "./components/LifeLineApp";
import { SiteHeader } from "./components/SiteHeader";

export default function Home() {
  return (
    <main id="home" className="flex-1 w-full max-w-6xl mx-auto px-4 pb-16 sm:px-8">
      <SiteHeader current="home" />
      <LifeLineApp aiEnabled={geminiEnabled()} />
    </main>
  );
}
