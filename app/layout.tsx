import type { Metadata } from "next";
import { Fraunces, DM_Sans } from "next/font/google";
import "./globals.css";
import ErrorBoundary from "./components/ErrorBoundary";
import { ToastProvider } from "./contexts/ToastContext";
import ToastContainer from "./components/ToastContainer";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Smart Asset Studio",
  description: "Automated asset processing for professionals.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Smart Asset Studio",
    statusBarStyle: "black-translucent",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${fraunces.variable} ${dmSans.variable}`}>
      <body>
        <ErrorBoundary>
          <ToastProvider>
            {children}
            <ToastContainer />
          </ToastProvider>
        </ErrorBoundary>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js');
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
