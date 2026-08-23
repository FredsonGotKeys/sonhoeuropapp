import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope, IBM_Plex_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["opsz", "SOFT", "WONK"],
});
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-mono" });

export const viewport: Viewport = {
  themeColor: '#0D1117',
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  title: "SonhoEuropa",
  description: "O teu sonho começa aqui. Deposita, acompanha o fundo e concorre a 200 000 MT para a Europa.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SonhoEuropa",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt" className={`${fraunces.variable} ${manrope.variable} ${plexMono.variable} h-full`}>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-full antialiased">
        {children}
        <Script id="security-cleanup" strategy="afterInteractive">{`
          try{Object.keys(localStorage).forEach(function(k){if(k.indexOf('sb-')===0||k.indexOf('supabase')===0)localStorage.removeItem(k)})}catch(e){}
        `}</Script>
      </body>
    </html>
  );
}
