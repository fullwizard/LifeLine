import type { Metadata } from "next";
import { Playfair_Display, Rubik } from "next/font/google";
import { LanguageProvider } from "./components/LanguageProvider";
import "./globals.css";

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["latin"],
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LifeLine — Help, explained",
  description:
    "Describe what you are facing and get a prioritized, explained plan of local assistance programs: housing, food, bills, legal, health, and more.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${rubik.variable} ${playfairDisplay.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-paper text-neutral-900">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
