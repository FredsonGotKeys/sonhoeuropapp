import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage" });

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
    <html lang="pt" className={`${bricolage.variable} h-full`}>
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
