import Image from "next/image";
import Link from "next/link";
import { HomeLink } from "./HomeLink";

export function SiteHeader({ current }: { current: "home" | "about" | "mission" }) {
  const cls = (page: typeof current) => (page === current ? "site-nav-current" : undefined);
  return (
    <header className="mb-6">
      <div className="site-masthead py-6">
        <Link href="/" aria-label="LifeLine home">
          <Image src="/lifeline-logo.png" alt="LifeLine" width={1000} height={1000} className="site-brand" priority />
        </Link>
        <nav aria-label="Main navigation" className="site-nav">
          <span className={cls("home")}>
            <HomeLink />
          </span>
          <Link href="/about" className={cls("about")} aria-current={current === "about" ? "page" : undefined}>
            About
          </Link>
          <Link href="/mission" className={cls("mission")} aria-current={current === "mission" ? "page" : undefined}>
            Our mission
          </Link>
        </nav>
      </div>
    </header>
  );
}
