import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import WaveField from "@/components/WaveField";
import Navigation from "@/components/Navigation";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Auditoría HC | Guillermo Polanco",
  description: "Plataforma premium para la auditoría y gestión de historias clínicas.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Auditoría HC",
  },
};

export const viewport: Viewport = {
  themeColor: "#6366F1",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased bg-background min-h-screen text-foreground relative overflow-x-hidden flex dark">
        <WaveField />
        <Navigation />
        <main className="flex-1 relative z-10 flex flex-col min-h-screen pb-20 md:pb-0 h-screen overflow-y-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
