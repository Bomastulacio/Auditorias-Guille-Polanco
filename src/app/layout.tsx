import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Space_Mono } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/Navigation";
import { ThemeProvider } from "@/components/ThemeProvider";
import FloatingControls from "@/components/FloatingControls";
import QueryProvider from "@/components/QueryProvider";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  display: "swap",
});

const spaceMono = Space_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Auditoría HC | Guillermo Polanco",
  description: "Registro y auditoría de historias clínicas — Base Río Gallegos",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Auditoría HC",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning className={`${spaceGrotesk.variable} ${spaceMono.variable}`}>
      <body className="antialiased bg-background text-text-primary min-h-screen overflow-x-hidden flex">
        <QueryProvider>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
            <Navigation />
            <main id="main-content" className="flex-1 flex flex-col min-h-screen pb-20 md:pb-0 h-screen overflow-y-auto scroll-smooth">
              {children}
              <FloatingControls />
            </main>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
