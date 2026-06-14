import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const viewport: Viewport = {
  themeColor: '#003399',
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  title: "SonhoEuropa",
  description: "O teu sonho começa aqui. Deposita, acumula pontos e concorre a 150 000 MT para a Europa.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SonhoEuropa",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt" className={`${geist.variable} h-full`}>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
