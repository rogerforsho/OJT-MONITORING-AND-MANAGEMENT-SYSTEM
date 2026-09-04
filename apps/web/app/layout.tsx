import type { Metadata } from "next";
import { Suspense } from "react";
import { Plus_Jakarta_Sans, Outfit } from "next/font/google";
import ClientProviders from "@/src/components/providers/ClientProviders";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geometric-sans",
  weight: ["300", "400", "500", "600", "700", "800"],
});

const outfit = Outfit({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geometric-display",
  weight: ["500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Colegio de Montalban - OJT Monitoring System",
  description: "Cross-Platform OJT Monitoring and Management System for ICS & IBE Trainees - Colegio de Montalban",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full antialiased ${plusJakartaSans.variable} ${outfit.variable}`}>
      <body className="min-h-full flex flex-col bg-[#F4F6F9] text-slate-900 font-sans">
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
