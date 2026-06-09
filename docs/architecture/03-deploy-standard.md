# 배포 아키텍처 — 표준 다이어그램

`git push main` 한 번에 무엇이 자동으로 일어나는가.

```mermaid
flowchart TB
  classDef dev fill:#dbe4ff,stroke:#4a9eed,color:#1e3a5f,font-weight:bold
  classDef vcs fill:#e9d5ff,stroke:#7c3aed,color:#3b0764,font-weight:bold
  classDef ci fill:#fed7aa,stroke:#ea580c,color:#7c2d12,font-weight:bold
  classDef target fill:#bbf7d0,stroke:#16a34a,color:#14532d,font-weight:bold

  Dev([👨‍💻 로컬 변경<br/>git push main]):::dev

  subgraph GH["🐙 GitHub"]
    Repo[milcho0604/daypoll]:::vcs
  end

  subgraph GHA["⚙️ GitHub Actions (자동)"]
    direction TB
    CI[ci.yml<br/>lint · test · build<br/>~2분]:::ci
    Deploy[deploy.yml<br/>백엔드 경로 변경 시<br/>~45초]:::ci
    Uptime[uptime.yml<br/>매 10분 cron]:::ci
    Cert[cert-check.yml<br/>매일 11:00 KST]:::ci
  end

  subgraph Vercel["☁️ Vercel"]
    direction TB
    Build[Next.js 빌드<br/>주변 변경 감지 자동]:::target
    Prod[moilga.com<br/>+ 옛 daypoll → 308 redirect]:::target
  end

  subgraph MacMini["🖥 Mac Mini"]
    direction TB
    Runner[Tailnet ssh<br/>ubuntu runner 통해]:::target
    Compose[docker-compose<br/>up -d --build]:::target
    API[whenever-api]:::target
  end

  Dev ==> Repo

  Repo -->|push 감지| CI
  Repo -->|push 감지| Build

  CI -->|✅ pass| Deploy

  Build --> Prod
  Deploy -->|ssh| Runner
  Runner --> Compose
  Compose --> API

  Uptime -.->|/health 체크| API
  Cert -.->|TLS 검사| Prod
```

## 두 가지 별도 흐름

### 1. 프론트엔드 (Vercel)
```
git push → Vercel webhook → 빌드 → CDN 반영 (~3분)
```
**완전 자동**. 우리는 아무 GitHub Actions 안 씀 — Vercel 이 알아서.

### 2. 백엔드 (맥미니)
```
git push (백엔드 경로 변경) → ci.yml → deploy.yml
   → ubuntu runner → Tailnet ssh → 맥미니 docker compose up
```
**Tailscale Tailnet** 만 사용 — Funnel 은 안 씀 (Cloudflare Tunnel 으로 바뀌었음). 단순히 GitHub Actions runner 가 맥미니에 ssh 하기 위한 길.

### 3. 모니터링 (백그라운드)
| 워크플로 | 주기 | 어디 감시 |
|---|---|---|
| `uptime.yml` | 매 10분 | `api.moilga.com/health` 3-try |
| `cert-check.yml` | 매일 11:00 | TLS · TS_AUTHKEY 잔여일 |

→ 다운 / D-30 임박 → GitHub Issue 자동 → 본인 모바일 푸시.

## 사람 손이 닿는 시점
- ❌ Vercel 배포 — 자동
- ❌ 백엔드 배포 — 자동
- ❌ 모니터링 — 자동
- ✅ `.env.prod` 시크릿 회전 — 수동 (~분기 1회)
- ✅ Tailscale auth key 갱신 — 수동 (90일마다, 알림 옴)
