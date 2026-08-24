import type { Metadata } from "next";
import { Space_Grotesk, Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import { ChromeGate } from "@/components/layout/chrome-gate";
import { PWARegister } from "@/components/pwa-register";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LIFESYSTEM",
  description: "Meu ecossistema inteiro num só lugar",
  manifest: "/manifest.json",
  themeColor: "#8B5CF6",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "LIFESYSTEM",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

// This is a personal, password-gated app — every page is behind the Basic
// Auth middleware, so nothing here should ever be a cacheable static
// artifact. Static generation produced a page that got cached (by an
// intermediary in front of the Node process) BEFORE auth was configured,
// and kept serving that stale unauthenticated copy of "/" after the fact.
// Forcing dynamic rendering means every request is always evaluated fresh.
export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body
        className={`${spaceGrotesk.variable} ${fraunces.variable} ${jetbrainsMono.variable} min-h-screen bg-background font-sans antialiased`}
      >
        <TooltipProvider>
          <ChromeGate>{children}</ChromeGate>
          <Toaster richColors position="bottom-right" />
          <PWARegister />
        </TooltipProvider>
      </body>
    </html>
  );
}
