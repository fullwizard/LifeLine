import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LifeLine — Help, explained",
  description:
    "Describe what you are facing and get a prioritized, explained plan of local assistance programs: housing, food, bills, legal, health, and more.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-paper text-neutral-900">{children}</body>
    </html>
  );
}
