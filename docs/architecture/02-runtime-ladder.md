# 런타임 — 사다리타기 스타일

요청 한 건이 어디까지 내려가는지 한눈에. 위에서 아래로 따라가면 됨.

```
   👤 친구 브라우저
   │
   │  HTTPS GET /rooms/NClOsdPOViPk
   │
   ├──────────────┐
   │              │
   ▼              ▼
   ☁️ Vercel      🟠 Cloudflare Edge
   moilga.com    api.moilga.com
   (페이지 HTML)  (cf-connecting-ip 추가)
   │              │
   │              │  Cloudflare → 맥미니
   │              │  outbound QUIC 터널 (firewall 안 뚫음)
   │              │
   │              ▼
   │              🖥 cloudflared
   │              (호스트 데몬, launchd)
   │              │
   │              │  localhost:3001
   │              │
   │              ▼
   │              🐳 whenever-api (NestJS)
   │              │
   │              │  pg internal
   │              │
   │              ▼
   │              🗄 PostgreSQL
   │              (호스트 비노출)
   │              │
   │              │  rows
   │              │
   │              ▼
   │              🐳 whenever-api
   │              │
   │              │  JSON
   │              │
   │              ▼
   │              🖥 cloudflared
   │              │
   │              │  반환 QUIC
   │              │
   │              ▼
   │              🟠 Cloudflare Edge
   │              │
   │  (Vercel 도 같은 시점에  ─┘
   │   HTML 렌더링 끝)
   │
   └────► 👤 친구 브라우저 (페이지 + 데이터)
```

## 한 줄 요약
- **왼쪽 사다리** = 정적 페이지 (`/`, `/rooms/new`)
- **오른쪽 사다리** = API 데이터 (`/rooms/<id>` 같은 동적)
- **두 사다리 끝이 같은 친구한테 도달** → 완성

## 왜 이렇게 그렸나
- 한 요청의 흐름이 분기·다시 합치는 걸 시각화
- "어디서 막히면 어디 영향" 한눈에
- 화살표 단순 + 왼/오 분리로 책임 명확
