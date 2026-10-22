import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Providers from "@/components/Providers";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
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
  title: { default: "BOMA – Property for sale and rent in Tanzania", template: "%s | BOMA" },
  description: "Find houses, apartments, land and commercial property for sale and rent across Tanzania.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <Providers>
          <Header />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
