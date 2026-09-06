import type { Metadata, Viewport } from "next";
import { Newsreader, Manrope } from "next/font/google";
import "./globals.css";
import Nav from "./nav";
import { AuthProvider, AuthGuard } from "../src/lib/AuthContext";
import { LocaleProvider } from "../src/lib/i18n/LocaleContext";
import ServiceWorkerRegister from "../src/lib/ServiceWorkerRegister";

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
  title: "Oliva",
  description: "A personal collection of recipes, saved and savored.",
  manifest: "/manifest.json",
  icons: {
    icon: "/oliva-icon.png",
    apple: "/oliva-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Oliva",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FDF8F5",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${newsreader.variable} ${manrope.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" style={{ fontFamily: 'var(--font-manrope)' }}>
        <ServiceWorkerRegister />
        <AuthProvider>
          <LocaleProvider>
            <AuthGuard>
              <Nav />
              {children}
            </AuthGuard>
          </LocaleProvider>
        </AuthProvider>
      </body>
    </html>
  );
}