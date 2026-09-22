import { LifeLineApp } from "./components/LifeLineApp";
import { SiteHeader } from "./components/SiteHeader";

export default function Home() {
  return (
    <main id="home" className="flex-1 w-full max-w-6xl mx-auto px-5 pb-10 sm:px-10">
      <SiteHeader current="home" />
      <LifeLineApp />
    </main>
  );
}
