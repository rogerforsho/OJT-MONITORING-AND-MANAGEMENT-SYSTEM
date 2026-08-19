import type { Metadata } from "next";
import { Suspense } from "react";
import TopProgressBar from "@/src/components/ui/TopProgressBar";
import NetworkToast from "@/src/components/ui/NetworkToast";
import "./globals.css";

export const metadata: Metadata = {
  title: "Colegio de Montalban — OJT Monitoring System",
  description: "Cross-Platform OJT Monitoring and Management System for ICS & IBE Trainees — Colegio de Montalban",
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
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#F4F6F9] text-slate-900">
        <Suspense fallback={null}>
          <TopProgressBar />
        </Suspense>
        <NetworkToast />
        {children}
      </body>
    </html>
  );
}
