# 배포 가이드 — 맥미니 + Cloudflare Tunnel ($11.25/년, 도메인만)

프론트는 **Vercel**, 백엔드(NestJS)와 **Postgres**는 **맥미니 Docker**에서 돌리고,
외부 노출은 **Cloudflare Tunnel** (`cloudflared` 호스트 데몬) 이 담당한다.
`cf-connecting-ip` 헤더로 실 클라이언트 IP 가 보존되어 IP-기반 rate limit 가 동작.

```
브라우저
  → Vercel (Next.js, moilga.com)
  → Cloudflare Edge (api.moilga.com, WAF/DDoS 흡수)
  → 맥미니 cloudflared 데몬 (outbound QUIC)
  → localhost:3001 (whenever-api 컨테이너)
                 → whenever-postgres   (호스트 비노출, 컨테이너 네트워크 only)
                 → whenever-backup     (매일 pg_dump → 외장 디스크)
                 → whenever-cleanup    (매일 90일 지난 방 DELETE)
```

> 옛 방식: Tailscale Funnel (`*.ts.net`) — 무료지만 클라이언트 IP 가 가려져
> rate limit 무력화 → 2026-06-09 Cloudflare 로 마이그레이션. Tailnet 자체는
> `deploy.yml` 의 ssh 통로로 계속 유지 (Funnel 만 끔).

## 파이프라인
- **CI** (`.github/workflows/ci.yml`): PR/push 시 lint + build + test(e2e 포함)
- **Deploy** (`.github/workflows/deploy.yml`, 선택): `main` 머지 시 self-hosted 러너가
  `docker compose up -d --build` 로 재배포
- **Vercel**: GitHub 연동으로 프론트 자동 배포

---

## 1. 맥미니 1회 설정

### 1-1. Docker
- Docker Desktop 설치 후 **"로그인 시 자동 시작"** 켜기 (월 1회 재시작해도 컨테이너가
  `restart: unless-stopped` 로 자동 복구됨).

### 1-2. 저장소 + 운영 env
```bash
git clone https://github.com/milcho0604/daypoll.git
cd daypoll

cp .env.prod.example .env.prod
# .env.prod 편집:
#   POSTGRES_PASSWORD=$(openssl rand -hex 24)
#   ADMIN_TOKEN=$(openssl rand -hex 24)
#   CORS_ORIGIN=   ← 비워두고 4단계에서 Vercel 도메인으로 채움
chmod 600 .env.prod   # 시크릿이라 그룹/타인 읽기 차단
```

### 1-3. 첫 기동
```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
curl localhost:3001/health   # {"status":"ok","db":"ok",...}
```

> **첫 빌드 함정**: Dockerfile 의 `pnpm install` 단계에서 `packages/shared` 의 `prepare`
> 훅이 호출되는데 그 시점엔 `tsconfig.json` 이 아직 복사되어 있지 않다. 그래서
> `--ignore-scripts` 로 prepare 를 건너뛰고 source 복사 후 명시적으로 빌드한다
> (`apps/api/Dockerfile` 의 `RUN pnpm install ... --ignore-scripts` + 그 다음 `RUN pnpm --filter @whenever/shared build`).

### 1-4. Tailscale Funnel (⚠️ 옛 방식 — 참고용)

> **현재 운영은 Cloudflare Tunnel — §7 을 우선 따르세요.** 이 절은 Tailscale Funnel
> 옛 셋업 (`*.ts.net` 무료 무도메인) 기록. Tailnet 자체는 `deploy.yml` ssh 통로로
> 살아있고 Funnel 만 끔.

```bash
brew install --cask tailscale
open -a Tailscale            # 메뉴바 아이콘 → Log in (Google 등 무료)
```
**MagicDNS / HTTPS Cert 는 macOS 앱이 자동 활성화**한다. Funnel 만 추가로 켜야 한다:

```bash
tailscale funnel --bg 3001
# Funnel is not enabled on your tailnet.
# To enable, visit:  https://login.tailscale.com/f/funnel?node=<NODE>
```
→ **출력된 URL 을 브라우저로 열어 Enable** (ACL JSON 안 만져도 됨). 다시 실행:
```bash
tailscale funnel --bg 3001
# Available on the internet:
#   https://<머신>.<tailnet>.ts.net/
```
백엔드 URL 확정. 외부에서 `curl <URL>/health` 로 검증.

> `--bg` 는 재부팅 후에도 유지된다. tailscaled 가 macOS 자동 시작이라 무인 운영.

---

## 2. Vercel — 프론트 배포

1. Vercel → New Project → `daypoll` repo import
2. **Root Directory: `apps/web`** (반드시 변경)
3. 환경변수:
   - `NEXT_PUBLIC_API_BASE_URL` = `https://<머신>.<tailnet>.ts.net` (1-4 의 URL)
   - `NEXT_PUBLIC_SITE_URL` = `https://<your>.vercel.app` (Deploy 후 받은 도메인)
4. Deploy → 5~8분.

> `apps/web/package.json` 의 build 스크립트가 `pnpm --filter @whenever/shared build &&
> next build` 로 shared 를 먼저 빌드하도록 되어있어, Vercel 의 install/build 기본값으로
> 충분하다.

---

## 3. CORS 연결
- 맥미니 `.env.prod` 의 `CORS_ORIGIN` 을 Vercel 도메인으로 채움
- 백엔드 재기동: `docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build`
  (캐시 있어 1~2분)
- 브라우저로 Vercel 도메인 열어 방 생성 → 투표 → 결과 확인 (골든 플로우)

---

## 4. 운영 메모

- **수동 재배포**: `docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build`
- **로그**: `docker compose -f docker-compose.prod.yml logs -f api`
- **마이그레이션**: 컨테이너 기동 시 `migrate.mjs` 가 자동 적용 (멱등, `_migrations` 테이블 추적)
- **재부팅 시나리오**: Docker Desktop 자동 시작 + `restart: unless-stopped` + tailscaled
  자동 실행 + funnel `--bg` 영속 → 사람 개입 0.

---

## 5. 백업 & 정리 자동화 (Docker 컨테이너)

`docker-compose.prod.yml` 안 `backup` / `cleanup` 두 서비스가 자동으로 돈다.
별도 셋업 없음 — `docker compose up -d` 만 하면 됨.

> 옛 방식: 호스트 `launchctl` 로 plist 두 개 (`com.whenever.backup` / `com.whenever.cleanup`)
> 등록 → 외장 디스크 (`/Volumes/*`) 에 대한 macOS TCC 차단으로 `EX_CONFIG (78)` 실패.
> `/bin/bash` + `/sbin/launchd` 에 Full Disk Access 부여해도 해결 안 됨 → 2026-06-14
> Docker 컨테이너로 이전. macOS 정책 의존성 0.

### 백업 — `whenever-backup`
- 이미지: `prodrigestivill/postgres-backup-local:16`
- 스케줄: 매일 04:30 (`SCHEDULE: "30 4 * * *"`)
- 저장 위치: `/Volumes/milcho_ex/whenever-backups/` (외장)
  - `daily/whenever-<YYYYMMDD>.sql.gz` — 14일 rotation
  - `weekly/whenever-<YYYYWW>.sql.gz` — 4주 rotation
  - `last/whenever-latest.sql.gz` — 가장 최근 백업 심볼릭
- healthcheck 내장 (`HEALTHCHECK_PORT=8080`)

### 정리 — `whenever-cleanup`
- 이미지: `postgres:16-alpine` (재활용, `psql` 만 필요)
- 스케줄: 24시간 sleep loop (정확한 cron 보장 X, but 매일 1회 보장)
- 동작: `DELETE FROM rooms WHERE created_at < now() - 90 days` — CASCADE 로 candidates/votes/voter_picks 동시 삭제
- 임계일 변경: `CLEANUP_DAYS` 환경변수 (`docker-compose.prod.yml`)

### 검증
```bash
docker ps --format "table {{.Names}}\t{{.Status}}" | grep whenever
# whenever-backup    Up X minutes (healthy)
# whenever-cleanup   Up X minutes
docker exec whenever-backup /backup.sh   # 즉시 백업 트리거 (테스트)
ls -lh /Volumes/milcho_ex/whenever-backups/daily/
```

### 복원
```bash
# 가장 최근 백업으로 복원
gunzip -c /Volumes/milcho_ex/whenever-backups/last/whenever-latest.sql.gz \
  | docker exec -i whenever-postgres psql -U whenever -d whenever

# 특정 날짜
gunzip -c /Volumes/milcho_ex/whenever-backups/daily/whenever-20260614.sql.gz \
  | docker exec -i whenever-postgres psql -U whenever -d whenever
```

### 수동 cleanup (즉시)
```bash
# 컨테이너 안에서 (cleanup 컨테이너의 cron 기다리지 않고)
docker exec whenever-cleanup sh -c \
  'psql -At -c "DELETE FROM rooms WHERE created_at < now() - (90 * INTERVAL '\''1 day'\'')"'
```

---

## 6. 백엔드 CD — ubuntu runner → Tailscale → mac mini ssh

`main` 머지 시 맥미니가 자동 재배포되게 하는 방식. 처음엔 self-hosted runner
on launchd 를 썼지만 Docker Desktop 의 keychain 정책에 막혀 작동하지 않았다.
대신 클라우드 ubuntu runner 가 ephemeral Tailscale 노드로 들어와 ssh 만
보내는 식으로 우회한다.

```
git push → ubuntu runner → tailscale up (ephemeral)
                        → ssh milcho0604-macmini "git pull && docker-compose up -d --build"
                        → curl /health 폴링 (60s)
```
평균 **45초** 안에 끝나고, 사람 개입 0.

### 사전 준비
1. **맥미니에서 sshd 켜기** — 시스템 설정 → 일반 → 공유 → "원격 로그인" ON
   (CLI: `sudo systemsetup -setremotelogin on`)
2. **ssh key 쌍 생성 + 등록** (deploy 전용, passphrase 없음):
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/daypoll_deploy -N "" -C github-actions-deploy
   cat ~/.ssh/daypoll_deploy.pub >> ~/.ssh/authorized_keys
   ```
3. **Tailscale auth key 발급** — https://login.tailscale.com/admin/settings/keys
   - Reusable ✓ · Ephemeral ✓ · Expiration 90 days (Free 플랜 한계)
   - 발급 직후 다이얼로그에 표시되는 `tskey-auth-...` 값을 통째로 복사 (한 번만 보임)

### GitHub Secrets

| Secret | 값 |
|---|---|
| `TS_AUTHKEY` | 위에서 발급한 `tskey-auth-...` |
| `SSH_PRIVATE_KEY` | `cat ~/.ssh/daypoll_deploy` 내용 통째로 |
| `SSH_HOST` | `milcho0604-macmini` (Tailscale 머신 이름) |
| `SSH_USER` | `milcho0604` (맥미니 사용자명) |
| `POSTGRES_PASSWORD` | `.env.prod` 와 동일 — `.env.prod` 는 runner workspace 에 다시 만들어지지 않으므로 사실상 unused, 하지만 secrets 라인 호환 위해 유지 |
| `ADMIN_TOKEN` | 동일 |
| `CORS_ORIGIN` | Vercel 도메인 |

> 이 방식의 deploy.yml 은 `.env.prod` 를 만들지 않는다. 맥미니에 이미 있는
> `/Volumes/milcho_ex/project/whenever/.env.prod` 를 `docker-compose` 가 직접
> 사용한다. (`Build & start` 가 아니라 ssh 로 mac 의 명령 실행이라 가능.)

### Tailscale ACL 한 줄 — funnel 노드 권한
처음 셋업 시 한 번:
```json
{ "nodeAttrs": [{ "target": ["*"], "attr": ["funnel"] }] }
```
또는 `tailscale funnel --bg 3001` 출력의 활성화 URL 클릭.

---

## 7. Cloudflare Tunnel (현재 운영 — 백엔드 공개 노출)

**옛 방식**: Tailscale Funnel(`*.ts.net`) — 무도메인 무료 HTTPS 지만 클라이언트 IP 가
백엔드에 도달하지 못해 IP 기반 rate limit / 어뷰즈 방어가 무력화되는 한계.
**현재 방식**: `api.moilga.com` → Cloudflare Edge → `cloudflared` (호스트 데몬)
→ `localhost:3001`. `cf-connecting-ip` 헤더로 실 IP 보존 + 무료 DDoS 흡수 + WAF.

### 셋업 (한 번)
1. Cloudflare 가입 → moilga.com 추가 → nameserver 를 Cloudflare 의 것으로 변경 (Vercel Registrar UI).
2. Cloudflare 대시보드 → Zero Trust → Networks → Tunnels → "Create a tunnel" (Cloudflared) →
   이름 `moilga-api` → **토큰(`eyJ...`)** 복사.
3. Public hostname 등록: `api` + `moilga.com` → `HTTP` → `localhost:3001`.
4. 맥미니에서:
   ```bash
   brew install cloudflared
   sudo cloudflared service install <TOKEN>
   ```
   → cloudflared 가 launchd 데몬으로 자동 등록 (재부팅 후 자동 시작).
5. 검증:
   ```bash
   curl https://api.moilga.com/health    # 200 ok
   sudo launchctl list | grep cloudflared
   ```

### 운영 메모
- TLS: Cloudflare Universal SSL 가 자동 발급/갱신 (사람 손 X).
- WebSocket: Free 플랜 idle 6h 끊김 — `socket.io-client` 자동 재연결 + 폴링 fallback 으로 흡수.
- 실 IP: 백엔드의 `apps/api/src/common/client-ip.ts` 가 `cf-connecting-ip` 헤더 보고 추출.
- Tailscale 자체는 그대로 유지 — Tailnet 안 SSH (deploy.yml 가 의존) 용. `tailscale funnel off` 로 Funnel 만 끔.

---

## 8. 트러블슈팅

| 증상 | 원인 / 대처 |
|---|---|
| 첫 `up -d --build` 가 `tsconfig.json` 없다고 실패 | Dockerfile 의 `--ignore-scripts` 누락. 최신 main 으로 pull. |
| `curl https://api.moilga.com/health` timeout | `launchctl list \| grep cloudflared` 로 데몬 가동 확인. 떴는데도 안 되면 `cloudflared tunnel list` + 토큰/route 매핑 점검. |
| Cloudflare 대시보드의 SSL/TLS 가 "Not Active" | DNS propagation 미완 또는 SSL/TLS mode 설정 X. Edge Certificates 의 "Always Use HTTPS" + SSL/TLS Mode `Full` 권장. |
| 프론트에서 CORS 에러 | `.env.prod` 의 `CORS_ORIGIN` 과 실제 Vercel 도메인 일치 확인 + 백엔드 재기동 |
| 어드민 페이지 503 | `ADMIN_TOKEN` 이 비어있거나 8자 미만. `.env.prod` 확인 후 재기동. |
| Vercel 빌드 실패 (shared 미빌드) | Root Directory 가 `apps/web` 인지 확인. `apps/web/package.json` 의 build 가 shared 빌드 포함. |
| 백엔드 health 가 503 + `db:"down"` | `whenever-postgres` 컨테이너 죽음. `docker ps` 확인. healthy 안 뜨면 `docker compose -f docker-compose.prod.yml logs postgres`. |

---

## 9. 현재 프로덕션 인스턴스

> 다음 셋업 때 참고. 시크릿은 이 파일에 적지 말 것 — `.env.prod` (chmod 600) 에만.

| 항목 | 값 |
|---|---|
| 호스트 | 맥미니 (macOS) |
| Tailscale 머신 | `milcho0604-macmini` (Funnel 끔, Tailnet 만 — deploy.yml ssh 용) |
| 백엔드 URL | `https://api.moilga.com` (Cloudflare Tunnel · cloudflared 호스트 데몬) |
| 백엔드 컨테이너 | `whenever-api` (127.0.0.1:3001), `whenever-postgres` (호스트 비노출) |
| 프론트 URL | `https://moilga.com` (Vercel 구매, 자동 연결) |
| 프론트 별칭 | `daypoll.vercel.app` → **308 → moilga.com** 영구 리다이렉트 (`next.config.ts` 의 host-based redirect). 옛 포트폴리오 링크 호환 + SEO 권위 통합. |
| Vercel 프로젝트 | `moilga` (Root Directory: `apps/web`, Git 연동 main → 자동 배포) |
| 어드민 토큰 | `.env.prod` 의 `ADMIN_TOKEN` |
| 백업 위치 | `/Volumes/milcho_ex/whenever-backups/{daily,weekly,last,monthly}/` (외장, 14일/4주 rotation, Docker 컨테이너 자동) |

### 진행 체크리스트
- [x] Docker Desktop 설치 + 자동 시작
- [x] `.env.prod` 작성 + chmod 600
- [x] prod compose 첫 빌드 + 기동 (Dockerfile `--ignore-scripts` fix)
- [x] Tailscale 설치/로그인
- [x] Funnel 활성화 (콘솔 URL 클릭)
- [x] `tailscale funnel --bg 3001` → 영구 URL 발급 + 외부 검증
- [x] Vercel 프로젝트 import + Git 연동 + Root Directory `apps/web`
- [x] Vercel 환경변수 `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_SITE_URL`
- [x] Deployment Protection 의도적 해제 (#10 참조)
- [x] `.env.prod` 의 `CORS_ORIGIN` 채우고 백엔드 재기동
- [x] 끝-to-끝 골든 플로우 검증 (방 생성 → 입장 → 투표 → 결과)
- [x] Docker `whenever-backup` / `whenever-cleanup` 컨테이너 + 첫 백업 동작 검증 (외장 디스크 저장)
- [x] **맥미니 슬립 비활성화** — `sudo pmset -a sleep 0 disksleep 0 hibernatemode 0 autorestart 1`
- [x] 약관 페이지 (`/privacy` `/terms`) 배포 + footer 링크
- [x] PWA manifest + icon + apple-icon (홈 화면 추가)
- [x] 메인 OG image (`/opengraph-image`)
- [x] Vercel Analytics 활성화
- [x] Security headers (X-Frame-Options, Referrer-Policy, Permissions-Policy)
- [x] `uptime.yml` 헬스 모니터 (매 10분, 다운 시 Issue 자동)
- [x] 도메인 전환: `moilga.com` Vercel 구매·자동 연결, `daypoll.vercel.app` → 308 redirect
- [x] CORS_ORIGIN 갱신 (`moilga.com,daypoll.vercel.app,web-milcho0604s-projects.vercel.app`)
- [x] 시크릿 회전 (`POSTGRES_PASSWORD` + `ADMIN_TOKEN`) — dangling commit 노출 대응 + OPS.md 갱신
- [x] Dependabot security updates 활성화 (취약점 자동 PR)
- [x] postcss 취약점 패치 (`pnpm.overrides` 로 >=8.5.10 강제)

---

## 10. 운영 위생 — 사고 예방

| 우선순위 | 항목 | 상태 |
|---|---|---|
| 🔴 높음 | **맥미니 슬립 비활성화** — `sudo pmset -a sleep 0 disksleep 0 hibernatemode 0 autorestart 1`. 슬립 들어가면 Docker 컨테이너가 paused 되어 Tailscale Funnel 이 incoming 요청을 거절 → 친구는 "Failed to fetch" 만 봄. 셋업 직후 반드시. | ✅ 완료 |
| 🔴 높음 | Docker `whenever-backup` + `whenever-cleanup` 컨테이너 (`/Volumes/milcho_ex/whenever-backups/`, daily 14일 + weekly 4주 rotation) | ✅ 완료 |
| 🟡 중간 | `ADMIN_TOKEN` 을 1Password / Apple 키체인에 백업 — 분실 시 `.env.prod` 갈아끼우고 재기동 필요 | 사용자 작업 |
| 🟢 낮음 | TLS 인증서 만료(2026-09-04) — Tailscale 자동 갱신 | **자동 감시** (§11) |
| 🟢 낮음 | Tailscale auth key 만료(2026-09-05) — Free 플랜 90일 한계 | **자동 감시** (§11) |
| 🟢 낮음 | Vercel Deployment Protection 해제는 **의도적** — 어드민 페이지는 `ADMIN_TOKEN` 가드(없으면 503, 잘못이면 401)로 자체 보호되어 데이터 누출 없음 | 메모 |
| 🟡 중간 | 시크릿 노출 사고 대응 절차 — `.env.prod*` 가 commit 되면: ① force push 로 history 정리 ② 즉시 시크릿 회전 (DB `ALTER USER`, ADMIN_TOKEN 새로) ③ GitHub Support 에 dangling commit 영구 삭제 요청 (선택, 안 해도 90일 자동 만료) | 절차 |
| 🟢 낮음 | Dependabot security updates — 의존성 취약점 발견 시 자동 PR 생성. `pnpm audit` 로 수동 확인도 가능. 우리 예: postcss `<8.5.10` → `pnpm.overrides` 로 강제 업그레이드 | **자동 감시** |

### 슬립 설정 검증
```bash
pmset -g | grep -E "^ (sleep |disksleep|autorestart) "
#  sleep        0   ← 0 이어야 함
#  disksleep    0
#  autorestart  1
pmset -g log | grep "^[0-9].*Sleep " | tail -5   # 적용 후엔 새 Sleep 이벤트가 없어야 함
```
슬립이 다시 발생하면 `uptime.yml` 워크플로 (§11) 가 10분 내 GitHub Issue 자동 생성 → 메일/푸시 알림.

### 백업 복원 절차 (사고 시)
```bash
# 가장 최신 백업
gunzip -c /Volumes/milcho_ex/whenever-backups/last/whenever-latest.sql.gz \
  | docker exec -i whenever-postgres psql -U whenever -d whenever

# 특정 날짜
ls /Volumes/milcho_ex/whenever-backups/daily/
gunzip -c /Volumes/milcho_ex/whenever-backups/daily/whenever-<YYYYMMDD>.sql.gz \
  | docker exec -i whenever-postgres psql -U whenever -d whenever
```

### 백업/정리 컨테이너 상태 확인
```bash
docker ps --format "table {{.Names}}\t{{.Status}}" | grep whenever
# whenever-backup    Up X minutes (healthy)
# whenever-cleanup   Up X minutes
ls -lh /Volumes/milcho_ex/whenever-backups/daily/   # 매일 04:30 새 파일 추가
docker logs whenever-backup --tail 20               # 마지막 백업 로그
docker logs whenever-cleanup --tail 20              # 마지막 cleanup 로그
```

---

## 11. GitHub Actions 워크플로 한눈에

| 파일 | 트리거 | 동작 |
|---|---|---|
| `ci.yml` | 모든 push / PR | lint + unit + e2e + build (양쪽 패키지) |
| `deploy.yml` | `main` 의 백엔드 관련 경로 push | ubuntu runner → Tailscale ephemeral → mac mini ssh → `git pull && docker-compose up -d --build` → `/health` 폴링. 평균 45초. |
| `cert-check.yml` | 매일 11:00 KST + 수동 | TLS 인증서·Tailscale auth key 잔여일 점검. 30일 이내 → `auto-alert` 라벨 이슈 자동 생성/갱신 (GitHub 이메일·모바일 푸시). 7일 이내 → 🔴 강한 메시지. 30일 이상 회복 → 이슈 자동 close. **사람 메모 불필요.** |
| `uptime.yml` | 매 10분 (cron) + 수동 | 백엔드 `/health` 3회 retry. 모두 실패 → `uptime-down` 라벨 이슈 자동 생성/갱신 (GitHub 이메일·모바일 푸시). 복귀 → 이슈에 코멘트 후 자동 close. GHA cron 은 best-effort 라 실제 firing 간격은 5~15분 변동. |

### TS_AUTHKEY 갱신 절차 (만료 알림 받았을 때)
1. https://login.tailscale.com/admin/settings/keys 에서 새 키 발급 (Reusable ✓, Ephemeral ✓, 90 days)
2. 새 키를 GitHub secret 으로 등록:
   ```bash
   printf '%s' '<KEY>' | gh secret set TS_AUTHKEY -R milcho0604/daypoll
   ```
3. `.github/workflows/cert-check.yml` 의 `TS_AUTHKEY_EXPIRY` 를 새 만료일(발급일+90일)로 갱신해서 push
4. 옛 키 revoke (`Auth keys` 목록에서)
