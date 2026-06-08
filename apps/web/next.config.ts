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
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
