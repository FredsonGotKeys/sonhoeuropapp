import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Sacramento } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage" });
const sacramento = Sacramento({ subsets: ["latin"], weight: "400", variable: "--font-script" });

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
    <html lang="pt" className={`${bricolage.variable} ${sacramento.variable} h-full`}>
      <head>
        <link rel="apple-touch-icon" href="/icon-192-maskable.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-full antialiased">
        {/* Custom launch splash for the installed PWA only (standalone
            display mode) — replaces the OS's flat square-icon splash with
            a branded, animated one. Invisible in normal browser tabs. */}
        <div id="pwa-splash" aria-hidden="true">
          <div className="pwa-splash-mark">
            <img src="/icon-512-maskable.png" alt="" width={96} height={96} />
          </div>
          <p className="pwa-splash-word">SonhoEuropa</p>
        </div>
        {children}
        <Script id="pwa-splash-hide" strategy="beforeInteractive">{`
          (function () {
            var MIN_MS = 900, MAX_MS = 2500, start = Date.now();
            function hide() {
              var el = document.getElementById('pwa-splash');
              if (!el) return;
              var wait = Math.max(0, MIN_MS - (Date.now() - start));
              setTimeout(function () {
                el.classList.add('pwa-splash-hide');
                setTimeout(function () { el.remove(); }, 500);
              }, wait);
            }
            if (document.readyState === 'complete') hide();
            else window.addEventListener('load', hide);
            setTimeout(hide, MAX_MS);
          })();
        `}</Script>
        <Script id="security-cleanup" strategy="afterInteractive">{`
          try{Object.keys(localStorage).forEach(function(k){if(k.indexOf('sb-')===0||k.indexOf('supabase')===0)localStorage.removeItem(k)})}catch(e){}
        `}</Script>
      </body>
    </html>
  );
}
