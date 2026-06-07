import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "언제모여 — 회원가입 없이 날짜 맞추기",
    template: "%s",
  },
  description: "링크 하나로 친구들이랑 모일 날짜를 정해보세요.",
  openGraph: {
    type: "website",
    siteName: "언제모여",
    title: "언제모여 — 회원가입 없이 날짜 맞추기",
    description: "링크 하나로 친구들이랑 모일 날짜를 정해보세요.",
    locale: "ko_KR",
  },
  twitter: {
    card: "summary_large_image",
    title: "언제모여",
    description: "링크 하나로 친구들이랑 모일 날짜를 정해보세요.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <div className="flex-1">{children}</div>
        <footer className="border-t border-zinc-100 bg-white/60 px-5 py-4 text-center text-[11px] text-zinc-400 backdrop-blur dark:border-zinc-900 dark:bg-zinc-950/60">
          <p>
            문의 ·{' '}
            <a
              href="mailto:hello.mealplan@gmail.com"
              className="underline-offset-2 hover:text-zinc-700 hover:underline dark:hover:text-zinc-200"
            >
              hello.mealplan@gmail.com
            </a>
            <span aria-hidden className="mx-1.5">
              ·
            </span>
            <a
              href="https://github.com/milcho0604/daypoll/issues/new"
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-2 hover:text-zinc-700 hover:underline dark:hover:text-zinc-200"
            >
              버그 제보
            </a>
          </p>
        </footer>
      </body>
    </html>
  );
}
