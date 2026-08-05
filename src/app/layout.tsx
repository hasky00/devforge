import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DevForge — AI Developer Agent",
  description:
    "Build, inspect, debug, and improve software with a senior-engineer AI agent. Project explorer, code editor, terminal, and change review in one workspace.",
  keywords: [
    "AI coding assistant",
    "developer agent",
    "debug",
    "code review",
    "DevForge",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full dark`}
    >
      <body className="min-h-full bg-bg font-sans text-text antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
