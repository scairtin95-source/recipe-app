import type { Metadata } from "next";
import { Newsreader, Manrope } from "next/font/google";
import "./globals.css";

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "The Olive Table",
  description: "A personal collection of recipes, saved and savored.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${newsreader.variable} ${manrope.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" style={{ fontFamily: 'var(--font-manrope)' }}>
        {children}
      </body>
    </html>
  );
}