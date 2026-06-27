import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import SiteHeader from "@/components/site-header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://moilga.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "모일까 — 회원가입 없이 날짜 맞추기",
    template: "%s",
  },
  description:
    "친구들이랑 모일 날짜, 회원가입 없이 링크 하나로. 단톡방 일정 조율, 모임 약속 잡기를 1분 컷으로.",
  keywords: [
    "모일까",
    "언제모여",
    "모임 날짜 정하기",
    "약속 날짜 정하기",
    "친구 약속",
    "단톡방 일정 조율",
    "회원가입 없이 일정 조율",
    "when2meet 한국어",
    "daypoll",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: "모일까",
    url: SITE_URL,
    title: "모일까 — 회원가입 없이 날짜 맞추기",
    description:
      "친구들이랑 모일 날짜, 회원가입 없이 링크 하나로. 단톡방 일정 조율 1분 컷.",
    locale: "ko_KR",
  },
  twitter: {
    card: "summary_large_image",
    title: "모일까",
    description: "링크 하나로 친구들이랑 모일 날짜를 정해보세요.",
  },
  // Google 은 도메인 속성 + Cloudflare DNS 로 인증(메타태그 불필요).
  // 네이버 서치어드바이저는 HTML 태그 방식이라 여기 메타로 소유확인.
  verification: {
    other: { "naver-site-verification": "74082209ea94d4bf49632edbd17a5beb56348351" },
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
        <SiteHeader />
        <div className="flex-1">{children}</div>
        {/* 자연 흐름 끝에 깔리는 글로벌 footer. fixed bottom 바가 있는 페이지에서는
            그 바가 z-20 으로 footer 위에 올라가 자동으로 가려진다 (안전). */}
        <footer
          className="relative z-0 border-t border-zinc-100 bg-white/60 px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] text-center text-[11px] text-zinc-400 backdrop-blur dark:border-zinc-900 dark:bg-zinc-950/60"
        >
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
          <Analytics />
          <p className="mt-1">
            <a
              href="/privacy"
              className="underline-offset-2 hover:text-zinc-700 hover:underline dark:hover:text-zinc-200"
            >
              개인정보처리방침
            </a>
            <span aria-hidden className="mx-1.5">
              ·
            </span>
            <a
              href="/terms"
              className="underline-offset-2 hover:text-zinc-700 hover:underline dark:hover:text-zinc-200"
            >
              이용약관
            </a>
          </p>
        </footer>
      </body>
    </html>
  );
}
