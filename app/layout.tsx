import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Hanken_Grotesk } from "next/font/google";
import "./globals.css";

const display = Barlow_Condensed({
  variable: "--font-bigshoulders",
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const sans = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Five Stats",
  description: "Retrouvez vos stats après chaque match de five.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0e1322",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${display.variable} ${sans.variable}`}
    >
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}