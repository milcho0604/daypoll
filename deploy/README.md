# 배포 가이드 — 맥미니 + Tailscale Funnel ($0, 도메인 없이)

프론트는 **Vercel**, 백엔드(NestJS)와 **Postgres**는 **맥미니 Docker**에서 돌리고,
외부 노출은 **Tailscale Funnel** 이 담당한다. 도메인을 사지 않아도 `*.ts.net` 의
무료 영구 HTTPS URL 을 발급받을 수 있어 가장 적은 비용으로 운영할 수 있다.

```
브라우저
  → Vercel (Next.js, *.vercel.app)
  → https://<머신>.<tailnet>.ts.net    ← Tailscale Funnel 발급
  → Tailscale 엣지 → 맥미니 tailscaled → localhost:3001 (whenever-api 컨테이너)
                                       → whenever-postgres 컨테이너 (호스트 비노출)
```

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

### 1-4. Tailscale Funnel
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

## 5. 백업 & 정리 자동화 (launchd, 권장)

매일 자동으로 DB 백업 + 오래된 방 정리를 돌린다.

```bash
cp deploy/launchd/com.whenever.backup.plist  ~/Library/LaunchAgents/
cp deploy/launchd/com.whenever.cleanup.plist ~/Library/LaunchAgents/
sed -i '' "s|<REPO_PATH>|$PWD|g; s|<YOU>|$USER|g" \
  ~/Library/LaunchAgents/com.whenever.{backup,cleanup}.plist
launchctl load ~/Library/LaunchAgents/com.whenever.backup.plist
launchctl load ~/Library/LaunchAgents/com.whenever.cleanup.plist
```

- **백업**: 매일 04:30, `~/whenever-backups/whenever-<날짜>.sql.gz`, 14일 보관 후 자동 삭제
- **정리**: 매일 04:00, 90일 지난 방 CASCADE 삭제 (api 컨테이너 안에서 실행)
- **복원**:
  ```bash
  gunzip -c <백업>.sql.gz | docker exec -i whenever-postgres psql -U whenever -d whenever
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

## 7. 대안: Cloudflare Tunnel (도메인 있을 때)

`*.ts.net` 이 보기 싫고 `api.yourdomain.com` 처럼 깔끔하게 가고 싶다면:

```bash
brew install cloudflared
cloudflared tunnel login
cloudflared tunnel create whenever-api
cloudflared tunnel route dns whenever-api api.yourdomain.com
cp deploy/cloudflared/config.example.yml ~/.cloudflared/config.yml
# config.yml 의 <TUNNEL_UUID>, <you>, hostname 채우기
sudo cloudflared service install
```
Vercel `NEXT_PUBLIC_API_BASE_URL` 를 그 도메인으로. 나머지 흐름은 동일.

> Cloudflare Free 는 WebSocket idle 6시간 후 끊김 — socket.io-client 자동 재연결이라
> UX 영향은 거의 없음.

---

## 8. 트러블슈팅

| 증상 | 원인 / 대처 |
|---|---|
| 첫 `up -d --build` 가 `tsconfig.json` 없다고 실패 | Dockerfile 의 `--ignore-scripts` 누락. 최신 main 으로 pull. |
| `tailscale funnel --bg 3001` 가 "not enabled" | 명령이 출력해주는 활성화 URL 을 브라우저로 클릭. |
| `curl <ts.net URL>/health` timeout | `tailscale funnel status` 로 매핑 확인. tailscaled 가 떠있는지 메뉴바 확인. |
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
| Tailscale 머신 | `milcho0604-macmini` |
| 백엔드 URL | `https://milcho0604-macmini.tailcdf6c2.ts.net` |
| 백엔드 컨테이너 | `whenever-api` (127.0.0.1:3001), `whenever-postgres` (호스트 비노출) |
| 프론트 URL | `https://web-milcho0604s-projects.vercel.app` |
| 프론트 별칭(짧음) | `https://web-nine-swart-97.vercel.app` |
| Vercel 프로젝트 | `web` (Root Directory: `apps/web`, Git 연동 main → 자동 배포) |
| 어드민 토큰 | `.env.prod` 의 `ADMIN_TOKEN` |
| 백업 위치 | `~/whenever-backups/whenever-<날짜>.sql.gz` (14일 보관, launchd 자동) |

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
- [x] launchd 백업/cleanup 등록 + 첫 백업 동작 검증

---

## 10. 운영 위생 — 사고 예방

| 우선순위 | 항목 | 상태 |
|---|---|---|
| 🔴 높음 | launchd 백업/cleanup 등록 (`~/whenever-backups/`, 14일 보관) | ✅ 완료 |
| 🟡 중간 | `ADMIN_TOKEN` 을 1Password / Apple 키체인에 백업 — 분실 시 `.env.prod` 갈아끼우고 재기동 필요 | 사용자 작업 |
| 🟢 낮음 | TLS 인증서 만료(2026-09-04) 자동 갱신 확인 — Tailscale 이 자동으로 갱신하지만 그 즈음 한 번 점검 | 캘린더 메모 |
| 🟢 낮음 | Tailscale auth key 만료(2026-09-05) — 발급 90일이 Free 플랜 한계. 만료 전 새 키 발급 + `gh secret set TS_AUTHKEY` | 캘린더 메모 |
| 🟢 낮음 | Vercel Deployment Protection 해제는 **의도적** — 어드민 페이지는 `ADMIN_TOKEN` 가드(없으면 503, 잘못이면 401)로 자체 보호되어 데이터 누출 없음 | 메모 |

### 백업 복원 절차 (사고 시)
```bash
ls ~/whenever-backups/                 # 가장 최신 파일 찾기
gunzip -c ~/whenever-backups/<파일>.sql.gz \
  | docker exec -i whenever-postgres psql -U whenever -d whenever
```

### launchd 상태 확인
```bash
launchctl list | grep whenever         # com.whenever.backup, com.whenever.cleanup 두 줄
ls -la ~/whenever-backups/             # 매일 04:30 새 파일 추가, 14일 지나면 삭제
```
