import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/layout/nav";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rec Stats",
  description: "Daily recruitment submissions & interviews tracker",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="app-backdrop min-h-full flex flex-col">
        <div className="flex flex-col gap-6 px-4 pb-16">
          <Nav />
          <main className="mx-auto w-full max-w-6xl">{children}</main>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
