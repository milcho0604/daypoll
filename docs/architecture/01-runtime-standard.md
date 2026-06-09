# 런타임 아키텍처 — 표준 박스 다이어그램

## 친구가 `moilga.com` 에 접속하면 어떤 일이 일어나는가

```mermaid
flowchart LR
  classDef client fill:#dbe4ff,stroke:#4a9eed,color:#1e3a5f,font-weight:bold
  classDef edge fill:#ffe8d6,stroke:#ea580c,color:#7c2d12,font-weight:bold
  classDef compute fill:#ffd8a8,stroke:#f59e0b,color:#5c3d1a,font-weight:bold
  classDef data fill:#c3fae8,stroke:#0e7490,color:#0c4a4a,font-weight:bold

  Friend([👤 친구<br/>브라우저]):::client

  subgraph Vercel["☁️ Vercel (글로벌 CDN)"]
    direction TB
    Frontend[Next.js 16<br/>moilga.com<br/>SSR + 정적]
  end

  subgraph CF["🟠 Cloudflare Edge"]
    direction TB
    CFEdge[api.moilga.com<br/>cf-connecting-ip 헤더<br/>WAF · DDoS 흡수]
  end

  subgraph MacMini["🖥 Mac Mini (집)"]
    direction TB
    Cloudflared[cloudflared<br/>호스트 데몬<br/>QUIC outbound only]
    subgraph Docker["🐳 Docker"]
      API[whenever-api<br/>NestJS 11<br/>:3001]
      PG[(PostgreSQL 16<br/>호스트 비노출)]
    end
  end

  class Frontend client
  class CFEdge edge
  class Cloudflared,API compute
  class PG data

  Friend ==>|① HTTPS GET /| Frontend
  Friend ==>|② HTTPS GET /rooms/:id<br/>SSR or client fetch| CFEdge
  CFEdge ==>|③ tunnel<br/>real IP 보존| Cloudflared
  Cloudflared ==>|④ localhost:3001| API
  API ==>|⑤ pg query| PG
  PG ==>|⑥ rows| API
  API ==>|⑦ JSON| Cloudflared
  Cloudflared ==>|⑧| CFEdge
  CFEdge ==>|⑨ JSON + 캐싱| Friend
```

## 데이터 흐름 (수신·송신)

| # | 통신 | 비고 |
|---|---|---|
| ① | 브라우저 → Vercel CDN | HTTPS, 글로벌 PoP |
| ② | 브라우저(또는 Vercel SSR) → Cloudflare Edge | `Origin: https://moilga.com` 헤더 |
| ③ | Cloudflare Edge → cloudflared | **QUIC 터널 (outbound only)** · `cf-connecting-ip` 자동 추가 |
| ④ | cloudflared → API | `127.0.0.1:3001` Docker port |
| ⑤–⑦ | API ↔ PostgreSQL | Docker 내부 네트워크 |

## 보안 표면

| 표면 | 노출 |
|---|---|
| `moilga.com` | 공개 (Vercel) |
| `api.moilga.com` | 공개 (Cloudflare proxied) |
| 맥미니 인터넷 inbound | **없음** — cloudflared 가 outbound 만 함 |
| Postgres 포트 | **호스트 비노출** — Docker 내부 only |
| `.env.prod` | chmod 600, gitignored |

## 핵심 특성

- **실 IP 보존**: `cf-connecting-ip` 헤더가 백엔드까지 도달 → IP 기반 rate limit 정상 작동
- **DDoS 방어**: Cloudflare edge 가 흡수
- **재기동 0 중단**: cloudflared launchd 자동 재시작
- **글로벌 PoP**: Vercel + Cloudflare 둘 다 한국 노드 (icn) 가까움
