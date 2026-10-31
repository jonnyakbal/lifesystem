import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/fraunces/wght.css";
import "@fontsource-variable/jetbrains-mono/wght.css";
import "@fontsource-variable/pixelify-sans/wght.css";
import "@fontsource/silkscreen/400.css";
import "@fontsource/vt323/400.css";
import "./globals.css";
import "./astral.css";
import "./retro.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import { ChromeGate } from "@/components/layout/chrome-gate";
import { PWARegister } from "@/components/pwa-register";
import { getPublicBranding } from '@/lib/public-branding';

const branding = getPublicBranding();

export const metadata: Metadata = {
  title: branding.name,
  description: branding.tagline,
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: branding.name,
  },
  icons: {
    icon: branding.icon,
    shortcut: branding.icon,
    apple: branding.appleIcon,
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: 'device-width', initialScale: 1,
  themeColor: [{ media: '(prefers-color-scheme: dark)', color: '#070A1C' }, { media: '(prefers-color-scheme: light)', color: '#F6F7FC' }],
};

// This is a personal, password-gated app — every page is behind the Basic
// Auth middleware, so nothing here should ever be a cacheable static
// artifact. Static generation produced a page that got cached (by an
// intermediary in front of the Node process) BEFORE auth was configured,
// and kept serving that stale unauthenticated copy of "/" after the fact.
// Forcing dynamic rendering means every request is always evaluated fresh.
export const dynamic = 'force-dynamic';

const themeBootScript = `try{var d=document.documentElement,t=localStorage.getItem('lifesystem-theme');if(t==='system')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';if(t==='light'){d.classList.remove('dark');d.classList.add('light')}if(localStorage.getItem('lifesystem-skin')==='retro')d.dataset.skin='retro'}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        {/* Aplica tema e visual salvos antes da primeira pintura (evita piscar). */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body
        className="min-h-screen bg-background font-sans antialiased"
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
