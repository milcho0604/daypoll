# 배포 — 사다리타기 스타일

`git push main` 한 줄이 어느 사다리를 타고 내려가는지.

```
                          👨‍💻 git push main
                              │
                              │
                ┌─────────────┴─────────────────┐
                │                               │
                │ Vercel webhook                │ GitHub Actions
                │ (자동)                         │
                ▼                               ▼
            ☁️ Vercel 빌드                   ⚙️ ci.yml
            │                                  │
            │ lint, test                       │ lint + test + build
            │ Turbopack 빌드                    │ (양쪽 패키지)
            │ Edge Network 반영                 │
            │                                  ▼
            ▼                                ✅ pass?
       🌐 moilga.com                            │
       (3~5분 후)                          ┌────┴────┐
                                          │         │
                                          │ Yes     │ No
                                          ▼         ▼
                                     ⚙️ deploy.yml   ❌ 멈춤
                                          │         (PR 머지 안 됨)
                                          │
                                          │ ubuntu runner
                                          │ Tailscale ephemeral
                                          │
                                          ▼
                                     🌐 Tailnet 접속
                                          │
                                          │ ssh milcho0604-macmini
                                          │
                                          ▼
                                     🖥 맥미니 (Docker)
                                          │
                                          │ git pull
                                          │ docker-compose up -d --build
                                          │
                                          ▼
                                     🐳 whenever-api 재기동
                                          │
                                          │ /health 폴링 (~30초)
                                          │
                                          ▼
                                     ✅ 배포 완료 (45초)
                                          │
                                          ▼
                                     📩 본인 메일에 알림 없음
                                     (조용히 끝)


   별도 백그라운드 (사람 개입 0):

   ⏰ 매 10분           ⏰ 매일 11:00 KST
       │                       │
       ▼                       ▼
   ⚙️ uptime.yml          ⚙️ cert-check.yml
       │                       │
       │ curl /health 3-try    │ TLS / TS_AUTHKEY 잔여일
       │                       │
       ▼                       ▼
       OK?                     D-30 임박?
       │                       │
   ┌───┴───┐               ┌───┴───┐
   │       │               │       │
   Yes     No              No      Yes
   │       │               │       │
   조용    ⚠️ GitHub Issue  조용    ⚠️ GitHub Issue
           자동 생성                자동 생성
           │                       │
           ▼                       ▼
       📩 본인 메일/모바일 푸시     📩 본인 메일/모바일 푸시
```

## 한 줄 요약 (어떤 분기로 가는지)

- **`apps/web/**` 만 변경** → 왼쪽 사다리만 (Vercel 자동)
- **`apps/api/**` 변경** → 양쪽 다 (Vercel + 백엔드 재기동)
- **`docs/**`, `README.md`** 만 변경 → 왼쪽만 (Vercel 빌드 — 사실 영향 X)
- **`.github/workflows/**`** 변경 → 다음 push 부터 새 워크플로 적용

## 왜 사다리타기?
- "Yes/No" 분기가 핵심 (CI 실패면 멈춤)
- 두 흐름 (프론트/백엔드) 가 평행하게 가다 다른 종점
- 한국인이 가장 빨리 이해하는 도식
