import type { Metadata } from "next";
// import { Outfit, Inter } from "next/font/google";
import "./globals.css";

/*
const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
*/

export const metadata: Metadata = {
  title: "Smart Asset Studio",
  description: "Automated asset processing for professionals.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body style={{fontFamily: 'system-ui, -apple-system, sans-serif'}} className="antialiased">
        {children}
      </body>
    </html>
  );
}
