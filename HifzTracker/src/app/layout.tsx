import type { Metadata, Viewport } from "next";
import { Geist, Amiri_Quran } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { SyncBanner } from "@/components/Account";
import { MovedBanner } from "@/components/Moved";
import { ServiceWorker } from "@/components/ServiceWorker";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const amiriQuran = Amiri_Quran({ variable: "--font-amiri-quran", weight: "400", subsets: ["arabic"] });

export const metadata: Metadata = {
  title: "Hifz Tracker",
  description: "Plan, memorize and revise the Quran at a sustainable pace.",
  applicationName: "Hifz Tracker",
  // iPhone: "Add to Home Screen" opens it full screen, named "Hifz".
  appleWebApp: { capable: true, title: "Hifz", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f5f0" },
    { media: "(prefers-color-scheme: dark)", color: "#121614" },
  ],
};

// Applies the saved theme before paint to avoid a flash.
const themeScript = `(function(){try{var t=localStorage.getItem('hifz:theme')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${amiriQuran.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full">
        <ServiceWorker />
        <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 pb-24 pt-4 sm:pb-8 sm:pt-20">
          <Nav />
          <main className="flex-1">
            <MovedBanner />
            <SyncBanner />
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
