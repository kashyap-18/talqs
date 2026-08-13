import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import MotionCursor from "./motion-cursor";
import { AuthProvider } from "./auth-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "talqs-consumer-demo.kashyapauppuluri.chatgpt.site";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const origin = `${protocol}://${host}`;
  const description =
    "A bounded Indian consumer-dispute research prototype with configurable retrieval, visible source passages, and explicit no-answer decisions.";

  return {
    title: "TALQS | Consumer Dispute Research Demo",
    description,
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title: "TALQS | Consumer Dispute Research Demo",
      description,
      type: "website",
      images: [{ url: `${origin}/og.png`, width: 1200, height: 630, alt: "TALQS consumer judgment research interface" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "TALQS | Consumer Dispute Research Demo",
      description,
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <MotionCursor />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
