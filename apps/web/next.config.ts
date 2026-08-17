import type { NextConfig } from "next";

const SECURITY_HEADERS = [
  // clickjacking 차단 — 외부 iframe 에 우리 페이지 띄우지 못함
  { key: "X-Frame-Options", value: "DENY" },
  // MIME sniffing 차단
  { key: "X-Content-Type-Options", value: "nosniff" },
  // 외부 사이트로 referer 누출 최소화 (오리진 동일하면 path 포함, cross-origin 이면 오리진만)
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // 우리는 카메라/마이크/위치 안 씀 — 명시적으로 차단
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  transpilePackages: ["@whenever/shared"],
  // 비공개 글 API는 런타임에 Markdown 원본을 읽는다. Vercel 서버 함수 번들에
  // content/blog 파일을 확실히 포함하되 공개 정적 자산으로 복사하지는 않는다.
  outputFileTracingIncludes: {
    "/api/blog/private/*": ["./content/blog/**/*.md"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: SECURITY_HEADERS,
      },
    ];
  },
  async redirects() {
    return [
      // 옛 도메인(daypoll.vercel.app) 방문 시 새 브랜드 도메인(moilga.com)으로 영구 리다이렉트.
      // 포트폴리오 등에 남아있는 옛 링크가 깨지지 않으면서, 브랜드/SEO 권위는 한 도메인에 집중.
      {
        source: "/:path*",
        has: [{ type: "host", value: "daypoll.vercel.app" }],
        destination: "https://moilga.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
