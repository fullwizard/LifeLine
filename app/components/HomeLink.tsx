"use client";

import Link from "next/link";

export function HomeLink() {
  return (
    <Link
      href="/"
      onClick={(event) => {
        if (window.location.pathname === "/") {
          event.preventDefault();
          window.location.reload();
        }
      }}
    >
      Home
    </Link>
  );
}
