"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    if (typeof window !== "undefined") {
      console.error("[whenever] global error:", error);
    }
  }, [error]);

  return (
    <html lang="ko">
      <body>
        <main
          style={{
            minHeight: "60vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1.5rem",
            padding: "0 1.25rem",
            textAlign: "center",
            fontFamily: "system-ui, -apple-system, sans-serif",
            color: "#18181b",
          }}
        >
          <div style={{ fontSize: "3.75rem" }} aria-hidden="true">🌧️</div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>
            앗, 뭔가 잘못됐어요
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#71717a" }}>
            새로고침 한 번이면 보통 풀려요.
          </p>
          {error.digest && (
            <p style={{ fontFamily: "ui-monospace", fontSize: "0.6875rem", color: "#a1a1aa" }}>
              ref: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              height: "3rem",
              padding: "0 1.5rem",
              borderRadius: "9999px",
              background: "#18181b",
              color: "white",
              fontSize: "0.875rem",
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
            }}
          >
            새로고침
          </button>
        </main>
      </body>
    </html>
  );
}
