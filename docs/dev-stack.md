# 로컬 개발 & 운영 스택 운영 가이드

이 머신(맥미니) 한 대에서 **운영(prod)** 과 **로컬 개발(dev)** 이 동시에 돈다.
둘은 docker 프로젝트명·컨테이너명·포트를 전부 분리해서 서로 절대 안 건드린다.

|        | 운영 (prod)                          | 로컬 dev (`scripts/dev.sh`)        |
|--------|--------------------------------------|------------------------------------|
| 관리   | `docker-compose.prod.yml` (CI 자동 배포) | `scripts/dev.sh` (수동)          |
| 프로젝트 | `moilga`                            | `moilga-dev`                       |
| DB     | `moilga-postgres` (내부망 5432, 호스트 비노출) | `moilga-dev-postgres` `:5433` |
| API    | `moilga-api` `:3001` (cloudflared → moilga.com) | `pnpm dev:api` `:3011`  |
| Web    | Vercel (원격)                         | `pnpm dev:web` `:3000` → API `:3011` |
| 데이터  | docker 볼륨 `moilga_pgdata`           | bind mount `./pgdata`              |

> 포트가 겹치는 건 API 뿐이라(운영 3001 ↔ dev 3011) 분리했고, web(3000)·dev DB(5433)는
> 원래 비어 있어 그대로 쓴다.

---

## 1. 로컬 개발 — `scripts/dev.sh`

```bash
scripts/dev.sh start   [all|db|api|web]   # 시작 (기본 all)
scripts/dev.sh stop    [all|db|api|web]   # 중지 (기본 all)
scripts/dev.sh restart [all|db|api|web]   # 재시작 (기본 all)
scripts/dev.sh status                     # 로컬 dev + 운영 스택 상태 한눈에
scripts/dev.sh logs    [api|web|db]       # 로그 follow (기본 api)
```

- **DB**: docker compose(`-p moilga-dev`)로 `:5433` 에 postgres 기동, healthcheck 통과까지 대기.
- **API/Web**: `pnpm dev:*` 를 백그라운드로 띄우고 PID 를 `logs/api.pid`·`logs/web.pid` 에 기록,
  로그는 `logs/api.log`·`logs/web.log` 로 남긴다. (둘 다 `.gitignore` 처리됨)
- **stop**: 프로세스 후손 트리(pnpm→node→nest/next)까지 전부 종료해 고아 프로세스를 안 남긴다
  (macOS 엔 `setsid` 가 없어 `pgrep -P` 로 트리를 직접 훑는다).
- 운영 스택(`moilga`)은 `status` 에서 **읽기 전용으로 표시만** 하고 절대 start/stop 하지 않는다.

### zsh alias (`~/.zshrc` 에 등록됨)

```
start_moilga   stop_moilga   restart_moilga   status_moilga
logWAS_moilga  (백엔드 로그)   logWEB_moilga (프론트)   logDB_moilga (DB)
```

`MOILGA_DIR=/Volumes/milcho_ex/project/whenever` 로 고정돼 어느 디렉터리에서 쳐도 동작하고,
뒤에 인자도 그대로 넘어간다 (예: `start_moilga db`).

> alias 를 갓 추가/변경했으면 새 터미널을 열거나 `source ~/.zshrc`.

---

## 2. 운영(prod) 스택

배포는 GitHub Actions(`.github/workflows/deploy.yml`)가 맥미니에 ssh 로 들어와
`docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build` 를 돌린다.
수동으로 만질 때:

```bash
cd /Volumes/milcho_ex/project/whenever
# 상태
docker compose -p moilga ps
# 재시작 / 로그
docker compose -p moilga restart api
docker compose -p moilga logs -f api
# 전체 재기동 (배포와 동일)
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

- 외부 노출은 cloudflared(호스트 서비스)가 `localhost:3001` 만 담당 → `moilga.com`.
- DB 백업: `moilga-backup` 컨테이너가 매일 04:30 `/Volumes/milcho_ex/whenever-backups` 로 덤프.
- 오래된 방 정리: `moilga-cleanup` 컨테이너가 90일 지난 rooms 를 매일 DELETE.

---

## 3. `whenever` → `moilga` 리네임 메모

docker 식별자를 `whenever-*` → `moilga-*` (프로젝트 `whenever`→`moilga`)로 옮겼다.
**데이터 보존을 위해** 운영 DB 볼륨은 정지 상태에서 `whenever_pgdata` → `moilga_pgdata` 로
복제했다.

> ⚠️ **볼륨 즉시 롤백은 더 이상 불가 (2026-06-27 롤백 자산 삭제됨).**
> 리네임 직후엔 원본 `whenever_pgdata` 볼륨 + `whenever-api` 이미지를 롤백용으로
> 남겨 뒀으나, 3일 안정 운영 확인 후 정리했다. 현재 남은 자산은 `moilga_pgdata`
> 볼륨 + `moilga-api:latest` 이미지 **단일본뿐**이다.
> → "구 볼륨으로 스왑" 롤백 경로는 없고, 복구는 아래 **매일 .sql.gz 백업 복원**으로 한다.
> (데이터 자체는 살아있고 매일 백업도 도니 복구는 가능 — 다만 *즉시* 스왑이 아니라
> *백업 복원* 절차다.)

의도적으로 **안 바꾼 것**(내부 식별자라 외부에 안 보이고, 바꾸면 위험/광범위):

- Postgres 내부 DB명·롤(`whenever`) 및 `DATABASE_URL` — 운영 연결 문자열 그대로.
- npm 워크스페이스 스코프 `@whenever/*` — 코드 전반 + Dockerfile 필터 영향이라 별도 작업.
- 레포 디렉터리명 `.../project/whenever` — 경로·alias·worktree 가 묶여 있어 유지.
- 백업 호스트 경로 `/Volumes/milcho_ex/whenever-backups` — 기존 백업 보존 위해 유지.

### 복구 (운영 DB 손상 시) — 백업 복원

`moilga-backup` 컨테이너가 매일 04:30 `/Volumes/milcho_ex/whenever-backups/daily/` 로
`whenever-YYYYMMDD.sql.gz` 덤프(plain SQL, 14일 보존 + 주/월 롤업, `whenever-latest.sql.gz`
= 당일 심링크). 덤프가 plain 포맷이라 **빈 DB 에 복원**하는 게 충돌 없이 안전하다:

```bash
ls -lt /Volumes/milcho_ex/whenever-backups/daily/ | head   # 최신 백업 확인

# 1) 손상 DB 비우고 새로 생성 (파괴적 — 복원 성공 확인 전엔 신중)
docker exec moilga-postgres psql -U whenever -d postgres \
  -c "DROP DATABASE whenever WITH (FORCE);" -c "CREATE DATABASE whenever;"

# 2) 최신 백업 적용
gunzip -c /Volumes/milcho_ex/whenever-backups/daily/whenever-latest.sql.gz \
  | docker exec -i moilga-postgres psql -U whenever -d whenever
```

> 복구 후 API 가 스키마 마이그레이션을 자동 재확인한다(Dockerfile CMD `migrate && serve`).
> 백업 복원이 의심되면 먼저 일회용 컨테이너에 복원해 행 수를 검증한 뒤 운영에 적용할 것.
