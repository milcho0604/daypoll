# 배포 가이드 — 맥미니 + Cloudflare Tunnel ($0)

프론트는 **Vercel**, 백엔드(NestJS)와 **Postgres**는 **맥미니 Docker**에서 돌리고,
외부 노출은 **Cloudflare Tunnel**이 담당한다. DB가 API와 같은 머신 localhost라 쿼리가 빠르고,
하드웨어가 내 것이라 트래픽이 늘어도 추가 비용이 없다.

```
브라우저 → Vercel(Next.js) → api.yourdomain.com
        → Cloudflare 엣지 → [Tunnel] → 맥미니 cloudflared → localhost:3001 (NestJS)
                                                          → postgres(컨테이너, localhost)
```

배포 파이프라인:
- **CI** (`.github/workflows/ci.yml`): PR/püsh 시 lint + build + test(e2e 포함)
- **Deploy** (`.github/workflows/deploy.yml`): `main` 머지 시 맥미니 self-hosted 러너가
  `docker compose up -d --build` 로 재배포 (마이그레이션은 컨테이너 기동 시 자동)
- **Vercel**: GitHub 연동으로 프론트 자동 배포

---

## 1. 맥미니 1회 설정

### 1-1. Docker
- Docker Desktop 설치 후 **"로그인 시 자동 시작"** 켜기 (월 1회 재시작해도 컨테이너가 `restart: unless-stopped`로 자동 복구됨)

### 1-2. 저장소 클론 + 운영 env
```bash
git clone https://github.com/milcho0604/daypoll.git
cd daypoll
cp .env.prod.example .env.prod
# .env.prod 편집: POSTGRES_PASSWORD, ADMIN_TOKEN(둘 다 openssl rand -hex 24),
#                 CORS_ORIGIN(Vercel 도메인) 채우기
```
첫 기동 테스트:
```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
curl localhost:3001/health   # {"status":"ok","db":"ok",...}
```

### 1-3. Cloudflare Tunnel
```bash
brew install cloudflared
cloudflared tunnel login
cloudflared tunnel create whenever-api
cloudflared tunnel route dns whenever-api api.yourdomain.com
cp deploy/cloudflared/config.example.yml ~/.cloudflared/config.yml
#  ~/.cloudflared/config.yml 의 <TUNNEL_UUID>, <you>, hostname 채우기
sudo cloudflared service install     # 부팅 시 자동 실행 등록
```
확인: `https://api.yourdomain.com/health` 가 응답하면 성공.

### 1-4. GitHub self-hosted 러너
GitHub → 저장소 → Settings → Actions → Runners → **New self-hosted runner** → macOS 선택 후
안내대로 설치. 데몬으로 등록(재부팅 자동 시작):
```bash
cd actions-runner
./svc.sh install
./svc.sh start
```
> 러너는 GitHub로 **아웃바운드**만 하므로 공유기 포트포워딩/인바운드 오픈이 필요 없다.

---

## 2. GitHub Secrets (Deploy용)

Settings → Secrets and variables → Actions → **New repository secret**:

| 이름 | 값 |
|---|---|
| `POSTGRES_PASSWORD` | `.env.prod`와 동일한 DB 비밀번호 |
| `ADMIN_TOKEN` | `.env.prod`와 동일한 어드민 토큰 |
| `CORS_ORIGIN` | Vercel 프론트 도메인 (예: `https://daypoll.vercel.app`) |
| `POSTGRES_USER` | (선택, 기본 `whenever`) |
| `POSTGRES_DB` | (선택, 기본 `whenever`) |

> deploy 워크플로가 이 시크릿으로 러너 작업공간에 `.env.prod`를 매번 생성한다.

---

## 3. Vercel (프론트)

1. Vercel에서 이 저장소 import → **Root Directory: `apps/web`**
2. 환경변수:
   - `NEXT_PUBLIC_API_BASE_URL` = `https://api.yourdomain.com`
   - `NEXT_PUBLIC_SITE_URL` = `https://<your-vercel-domain>` (OG 메타데이터용)
3. 빌드/배포는 push 시 Vercel이 자동 수행.
4. 배포 후 그 Vercel 도메인을 백엔드 `CORS_ORIGIN`(.env.prod + GitHub Secret)에 반영.

---

## 4. 운영 메모

- **수동 재배포**: `docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build`
- **로그**: `docker compose -f docker-compose.prod.yml logs -f api`
- **DB 백업**(권장, cron):
  ```bash
  docker exec whenever-postgres pg_dump -U whenever whenever | gzip > backup_$(date +%F).sql.gz
  ```
- **오래된 방 정리**(선택): `node apps/api/scripts/cleanup-old-rooms.mjs --days 90`
- **월 1회 재시작**: Docker Desktop 자동 시작 + `restart: unless-stopped` + cloudflared 서비스로
  사람 개입 없이 전부 자동 복구된다.

---

## 5. 백업 & 정리 자동화 (launchd)

매일 자동으로 DB 백업 + 오래된 방 정리를 돌리려면 launchd 에이전트를 등록한다.

```bash
# 1) plist 의 <REPO_PATH>, <YOU> 를 실제 값으로 치환 후 복사
#    (REPO_PATH 예: /Users/you/daypoll, YOU 예: you)
cp deploy/launchd/com.whenever.backup.plist  ~/Library/LaunchAgents/
cp deploy/launchd/com.whenever.cleanup.plist ~/Library/LaunchAgents/

# 2) 로드 (등록 즉시 + 매일 예약)
launchctl load ~/Library/LaunchAgents/com.whenever.backup.plist
launchctl load ~/Library/LaunchAgents/com.whenever.cleanup.plist

# 수동 실행/테스트
bash deploy/scripts/backup-db.sh            # ~/whenever-backups 에 .sql.gz
bash deploy/scripts/cleanup-old-rooms.sh 90 # 90일 지난 방 삭제
```

- **백업**: 매일 04:30, `~/whenever-backups/whenever-<날짜>.sql.gz`, 14일 보관 후 자동 삭제
- **정리**: 매일 04:00, 90일 지난 방 CASCADE 삭제 (api 컨테이너 내부에서 실행)
- **복원**: `gunzip -c <백업>.sql.gz | docker exec -i whenever-postgres psql -U whenever -d whenever`
- launchd 는 PATH 가 최소라 plist 에 docker CLI 경로(`/opt/homebrew/bin` 등)를 명시해 둠
