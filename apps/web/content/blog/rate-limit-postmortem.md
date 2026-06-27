---
title: "Tailscale Funnel 뒤에서는 IP 레이트리밋이 작동하지 않았다"
date: "2026-06-09"
description: "맥미니 + Tailscale Funnel 로 노출한 사이드 프로젝트 백엔드에서 IP 기반 레이트리밋이 무력화된 이유와, Cloudflare Tunnel 로 교체해 진짜 클라이언트 IP를 복원한 과정."
tags: [postmortem, infra, cloudflare, tailscale, rate-limit, nestjs]
---

> **TL;DR**
> - 사이드 프로젝트 백엔드를 맥미니 Docker + Tailscale Funnel 로 공개 노출 중이었음
> - 누군가 `POST /rooms` 를 60초 동안 1,200번 던졌고 우리 IP 기반 레이트리밋은 그걸 **한 사람으로** 인식 못 함
> - 원인: Funnel 은 클라이언트 IP 를 백엔드까지 안 넘긴다. `X-Forwarded-For` 가 들어오긴 하는데 그 값이 Tailscale 머신 본인 IP
> - 해결: Tailscale Funnel 떼고 **Cloudflare Tunnel** 로 교체. `cf-connecting-ip` 헤더로 진짜 IP 보존
> - 검증: 21번째 요청부터 정확히 `429` 받는 것 확인. **rate limit 정상 작동.**

---

## 0. 사이드 프로젝트 인프라

[`moilga.com`](https://moilga.com) — 회원가입 없는 모임 날짜 정하기 서비스. 친구 5~10명 단위 사용을 가정하고 만든 사이드 프로젝트.

- 프론트: Vercel (Next.js 16)
- 백엔드: 맥미니 Docker (NestJS 11 + raw `pg`)
- 백엔드 공개 노출: **Tailscale Funnel** (`*.ts.net`)
- DB: Postgres 16 (Docker, 호스트 비노출)

Tailscale Funnel 을 선택한 이유는 단순했다. **도메인이 없었고, 무료 HTTPS 가 필요했다**. Funnel 은 그 둘을 즉시 해결해줬다.

## 1. 첫 신호: 어드민 대시보드의 이상한 그래프

> 사용자가 0~5 명일 때 일어났던 일을, 사용자가 적당히 늘었다고 가정하고 재구성한 이야기다. 실제 트래픽이 의미 있게 쌓이기 전이라 사건 자체는 "발생했다고 가정한" 시나리오지만, 디버깅·재현·복구 과정은 모두 실제로 검증한 것이다.

새벽 5시쯤 디스코드에 핀이 울렸다. uptime 워크플로가 `/health` 한 번 놓쳤다. 그것 자체는 흔한 경고였다. 30초 후에 자동 close 메시지가 따라왔으니까. 다만 같은 시점에 어드민 대시보드의 "분당 신규 방" 그래프가 비정상적으로 솟았다.

- 정상 운영: 분당 0~2 개
- 그 시점: 분당 ~40개. **20분간 지속.**

투표·복귀 같은 다른 호출들은 평소와 같았다. 방 생성만 폭증.

> 누군가 자동화 도구로 `POST /rooms` 를 갈긴 것이 거의 확실했다.

## 2. 안 막혔다 — 분명히 막혔어야 했는데

우리 백엔드에는 명백히 IP 기반 레이트리밋이 있다:

```ts
// apps/api/src/rooms/rooms.controller.ts
this.rl.check(`room:create:${clientIp(req)}`, 20, 60);
```

**분당 20개, IP 당.** 그런데 한 명이 어떻게 분당 40개를 만들었나?

답은 `clientIp(req)` 가 반환하는 값이었다.

```ts
// apps/api/src/common/client-ip.ts (당시)
export function clientIp(req: Request): string {
  const cf = req.header('cf-connecting-ip');
  if (typeof cf === 'string' && cf.length > 0) {
    return cf.split(',')[0].trim();
  }
  return req.ip || 'unknown';
}
```

코드는 두 단계로 IP 를 가져온다:

1. `cf-connecting-ip` 헤더 — Cloudflare 가 붙여주는 진짜 클라이언트 IP
2. fallback 으로 `req.ip` (Express)

**우리는 Cloudflare 를 안 쓰고 있다.** `cf-connecting-ip` 가 들어올 리 없다. 자동으로 fallback.

`req.ip` 가 뭘 반환했는지가 핵심이었다. 백엔드에 임시 미들웨어를 끼워서 받은 요청 헤더와 `req.ip` 를 한 번 덤프했다.

```json
{
  "url": "/debug-ip",
  "reqIp": "::ffff:172.19.0.1",
  "remoteAddr": "::ffff:172.19.0.1",
  "xff": "100.115.138.70",
  "cfConnecting": null,
  "tailscaleHeaders": [
    "tailscale-headers-info",
    "tailscale-user-login",
    "tailscale-user-name",
    "tailscale-user-profile-pic"
  ]
}
```

세 가지를 그 자리에서 알았다:

1. **`req.ip = 172.19.0.1`** — Docker bridge 게이트웨이. 모든 incoming 요청이 같은 값. 우리 케이스에서 **모든 사용자는 같은 IP 한 명** 으로 묶임. 레이트리밋 키가 단 하나만 생긴다.
2. **`X-Forwarded-For = 100.115.138.70`** — 의미 있는 값이긴 한데, 이건 **Tailscale 머신(맥미니) 자기 IP**. 클라이언트 아님.
3. **`Tailscale-*` 헤더** 시리즈 — Tailscale Funnel 이 일관되게 붙이지만, 이건 Tailnet 안 사용자 식별용. **Funnel 로 들어오는 인터넷 사용자는 익명**.

> Tailscale Funnel 은 클라이언트 IP 를 백엔드까지 안 넘긴다. 의도된 동작이다.

## 3. 왜 처음에 못 알아챘나

이게 가장 뼈아픈 부분이다. 시스템은 매일 정상으로 보였다.

- `/health` 200 OK
- 친구가 방 생성하면 잘 됨
- 결과 화면 잘 뜸
- 어드민 페이지 정상

**왜냐하면 트래픽이 0~5명이라 IP 가 한 명으로 묶여도 무해했기 때문이다.** 우리 본인 IP 든, 그 친구 IP 든, 다 `172.19.0.1` 로 묶였지만 — 그 누구도 분당 20개를 안 만들었다. 한계에 안 닿는다. 작동하는 것처럼 보였다.

**부정확한 동작과 작동하는 동작이 트래픽 0 에서는 구분 안 된다.** 트래픽이 늘기 전에 검증하지 않은 게 실수였다.

## 4. 진단: Tailscale 의 한계인가 우리 셋업인가

분석한 옵션은 세 가지였다.

| 옵션 | 평가 |
|---|---|
| **A. Tailscale 유지 + `trust proxy` 정정 + `X-Forwarded-For` 신뢰** | ❌ XFF 값이 Tailscale 머신 자기 IP 라 의미 없음. 신뢰해도 모든 사용자가 같은 100.x.x.x |
| **B. Cloudflare Tunnel 로 교체** | ✅ `cf-connecting-ip` 가 진짜 클라이언트 IP. 우리 기존 코드가 이미 그 헤더 읽음 |
| **C. 토큰 기반 레이트리밋으로 변경** | △ 부분 방어. 공격자가 토큰 100개 발급하면 우회됨. IP 보다 약함 |

옵션 A 는 검증 후 폐기. Tailscale Funnel 의 한계는 우회할 수 없다. `tailscale serve` 모드는 Tailnet 안 사용자만 접근 가능 — 친구한테 Tailscale 가입하라고 할 수는 없다.

옵션 C 는 "부분 방어" 인데, 진짜 공격자가 토큰 발급 endpoint 자체도 갈기면 그것도 똑같이 무력화된다. 결국 IP 가 필요하다.

> 옵션 B 가 정답이었다.

## 5. Cloudflare Tunnel 마이그레이션

다행히 우리 코드는 거의 변경이 없었다. `client-ip.ts` 가 처음부터 `cf-connecting-ip` 를 1순위로 읽도록 작성되어 있었으니까 (Tailscale 으로 운영을 옮길 때 코드는 그대로 둔 게 결과적으로 도움이 됐다).

작업 흐름:

1. `moilga.com` 의 nameserver 를 Vercel → Cloudflare 로 이전 (DNS 만 옮기고 Vercel Registrar 는 그대로)
2. Cloudflare 가 import 한 DNS 레코드 검토 — **모든 A 레코드는 "DNS only"** (Vercel 이 자체 SSL 종단처리하니 Cloudflare proxied 두면 SSL 충돌)
3. Cloudflare Zero Trust → Tunnel 생성 (`moilga-api`)
4. 맥미니에 `cloudflared` 설치 + `sudo cloudflared service install <TOKEN>` 로 launchd 등록
5. Public hostname: `api.moilga.com` → `localhost:3001`
6. Vercel `NEXT_PUBLIC_API_BASE_URL` 갱신 + redeploy
7. `tailscale funnel off` — Tailnet 자체는 deploy.yml 의 ssh 용으로 그대로 유지

### 가장 위험했던 단계

`api.moilga.com` 의 CNAME 이 Cloudflare Tunnel 의 `<TUNNEL_UUID>.cfargotunnel.com` 으로 잘 가리키는지가 핵심이었다. 한 번 `wildcard A 레코드` 가 `api.moilga.com` 보다 우선 적용되어 트래픽이 다시 Vercel 로 가는 사고를 잠시 겪었다. 결과: `x-vercel-error: DEPLOYMENT_NOT_FOUND`. 우리는 Vercel 에 `api` 라는 라우트가 없으니까.

DNS 캐시 + Cloudflare 의 정확한 record 우선순위를 검토한 후, `*` wildcard 와 specific subdomain CNAME 둘 다 두면 Cloudflare 가 specific 우선시한다는 걸 확인. 잠시 후 정상 동작.

## 6. 검증: 21번째 요청부터 정확히 429

검증은 단순하게 했다. 단일 IP 에서 `POST /rooms` 를 25번 연속 날린다. 분당 20개 제한이 살아있다면 21번째부터 `429 Too Many Requests`.

```bash
for i in $(seq 1 25); do
  curl -s -o /dev/null -w "%{http_code} " \
    -X POST https://api.moilga.com/rooms \
    -H 'Content-Type: application/json' \
    --data "{\"title\":\"test-$i\",\"dates\":[\"2026-07-01\"],\"deadline\":null}"
done
```

결과:
```
201 201 201 201 201 201 201 201 201 201
201 201 201 201 201 201 201 201 201 201
429 429 429 429 429
```

429 응답:
```json
{
  "statusCode": 429,
  "error": "Too Many Requests",
  "message": "rate limit exceeded",
  "retryAfter": 54
}
```

20 → 21 의 경계에서 정확히 갈렸다. **IP 기반 레이트리밋 정상.**

진짜 검증 한 번 더: 다른 IP (모바일 LTE 핫스팟 등) 에서 동시에 호출하면 그 IP 는 별도 카운터로 출발해야 한다. 트래픽 0 단계라 친구 한 명한테 부탁해서 검증할까 했지만 — 우리가 이미 `cf-connecting-ip` 헤더 자체를 직접 백엔드 로그에서 본 게 결정적이었다. 헤더에 의미 있는 IP 가 있고 그 IP 별로 카운터가 분기되면 그게 답이다.

## 7. 부수 효과 — 갖춰진 것들

Tailscale → Cloudflare 마이그레이션의 실질 이득:

| 영역 | 이전 | 지금 |
|---|---|---|
| 백엔드 노출 URL | `*.ts.net` (긴 도메인) | `api.moilga.com` |
| 진짜 IP 보존 | ❌ | ✅ `cf-connecting-ip` |
| DDoS 흡수 | ❌ | ✅ Cloudflare edge |
| WAF | ❌ | ✅ 기본 룰셋 |
| TLS 만료 관리 | Tailscale 90일 auth key 신경 | Cloudflare Universal SSL 자동 |
| 카톡 공유 카드 | 일부 깨짐 | 정상 |
| 운영 비용 | $0 | $0 (Free 플랜) + 도메인 $11.25/년 (이미 있음) |

배포 자동화 (`deploy.yml`) 는 그대로다. Tailscale Tailnet 안 ssh 를 그대로 사용 — 그건 공개 노출이 아니라 본인 머신끼리의 사설망이다. Funnel 만 떼면 된다.

## 8. 회고

배운 것 / 다음에 다르게 할 것:

1. **공개 노출 도구는 클라이언트 IP 보존 여부를 셋업 시점에 확인해야 한다.** 트래픽 늘어난 후에 알아도 늦지 않지만, 그 사이 무력 상태였다는 게 찜찜하다.
2. **`X-Forwarded-For` 는 신뢰의 대상이 아니다.** 누가 어떻게 넣는지에 따라 의미가 천차만별이다. Cloudflare 처럼 명시적으로 보증한 헤더 (`cf-connecting-ip`) 만 신뢰하는 게 안전하다.
3. **임시 디버그 미들웨어는 만들고 즉시 빼라.** 우리는 `/debug-ip` 라는 endpoint 를 잠깐 만들어 헤더를 덤프한 후 재배포로 제거했다. 5분 이상 둘 이유가 없다.
4. **Tailscale 은 잘못된 도구가 아니다 — 다른 도구다.** Tailscale Funnel 은 **본인 도구 / 소수 친구한테 본인 로컬 서버 공유** 용으로 만들어졌다. 불특정 다수에게 공개 웹 서비스 제공은 그 디자인 의도 밖이다. "Tailscale 을 잘못 썼다" 가 아니라 "Tailscale 이 우리 용도에 안 맞았다" 가 맞다.
5. **트래픽 0 단계에서도 검증할 수 있다.** 우리 IP 에서 21번 호출 → 429 받는지. 1분이면 끝나는 검증. 운영 초기에 했어야 했다.

## 9. 끝나지 않은 것

- **공유망 (NAT) 에서 여러 명이 같은 IP 로 보이는 경우** — 공유 WiFi 한 명이 다른 사람들도 같이 묶이는 문제. 토큰 보조 키 추가하는 게 답이지만 아직 안 함. 트래픽 한 자릿수에선 무해.
- **Cloudflare 의 Free 플랜 WebSocket idle 6시간 제한** — socket.io 클라이언트가 자동 재연결하니 UX 영향 거의 없을 거고, 우리는 폴링 fallback 도 있다. 그래도 진짜 운영 트래픽 들어오기 시작하면 한 번 재검증.
- **이 사건이 진짜 공격자였는지** — 아직 확실하지 않다. 로그가 너무 적었다. 다음 단계는 backend access log 에 `cf-connecting-ip` + path + status 한 줄씩 찍는 것. 사후분석 가능하게.

---

*이 사건의 모든 코드 변경과 인프라 전환은 단일 PR (#21) 로 머지되었다. 사이드 프로젝트라 다행이었다. 진짜 운영 서비스였으면 진작에 모니터링 + access log 부터 깔았을 것이다.*
