import Link from 'next/link';

export const metadata = {
  title: '개인정보처리방침 · 언제모여',
  description: '언제모여 서비스의 개인정보 수집 및 처리 방침.',
};

const LAST_UPDATED = '2026-06-15';

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-16 sm:pt-12 sm:pb-20">
      <header className="mb-8">
        <Link
          href="/"
          className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          ← 홈으로
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          개인정보처리방침
        </h1>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          최종 개정일: {LAST_UPDATED}
        </p>
      </header>

      <article className="space-y-6 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        <p>
          언제모여(이하 &ldquo;서비스&rdquo;)는 회원가입 없이 친구들과 모일
          날짜를 정하는 도구입니다. 개인정보를 최소한으로만 수집하며, 본
          처리방침에 따라 보호합니다.
        </p>

        <Section title="1. 수집하는 개인정보 항목 및 수집 방법">
          <p>다음 항목을 사용자가 직접 입력하거나 자동으로 수집합니다.</p>
          <Table
            rows={[
              ['닉네임', '방 참여 시 사용자가 직접 입력', '필수 — 누가 가능한 날짜를 골랐는지 표시'],
              ['선택 PIN (4자리)', '사용자가 직접 입력 (선택)', '선택 — 다른 기기에서 본인 표 복원용. scrypt 단방향 해시로 저장'],
              ['IP 주소', '자동 (HTTP 요청)', '오남용 방지(rate limit)에만 사용. 저장하지 않음'],
              ['브라우저 로컬 토큰', '서비스가 자동 발급', '닉네임 + 표를 본인 브라우저에 묶기 위해 브라우저 localStorage 에 저장. 서버 DB에도 저장됨'],
              ['투표 데이터', '사용자가 직접 선택', '어떤 후보 날짜에 가능 표시했는지'],
            ]}
            headers={['항목', '수집 방법', '용도']}
          />
        </Section>

        <Section title="2. 개인정보의 이용 목적">
          <ul className="ml-5 list-disc space-y-1">
            <li>방 생성·참여·투표·결과 집계 등 서비스 본질적 기능 제공</li>
            <li>다른 기기에서 본인 식별 (PIN 입력 시)</li>
            <li>오남용 방지 (IP 기반 rate limit)</li>
          </ul>
          <p className="mt-2">
            <strong>광고·마케팅·외부 판매·프로파일링에 일절 사용하지 않습니다.</strong>
          </p>
        </Section>

        <Section title="3. 개인정보의 보유 및 이용 기간">
          <ul className="ml-5 list-disc space-y-1">
            <li>
              <strong>방·참여자·투표 데이터</strong>: 방 생성 시점으로부터
              <strong> 90일</strong> 후 자동 삭제. 매일 새벽 04:00에 일괄 정리.
            </li>
            <li>
              <strong>IP 주소</strong>: 메모리상 rate limit 카운터로만 사용,
              DB에 저장하지 않음.
            </li>
            <li>
              <strong>DB 백업</strong>: 운영용 백업은 14일간 보관 후 자동 삭제.
            </li>
          </ul>
        </Section>

        <Section title="4. 개인정보의 제3자 제공">
          <p>
            서비스는 사용자의 개인정보를 <strong>제3자에게 제공하지
            않습니다.</strong> 법령에 따른 수사기관의 적법한 요청이 있는
            경우에 한해 제공할 수 있습니다.
          </p>
        </Section>

        <Section title="5. 개인정보 처리 위탁">
          <p>다음 서비스 인프라를 사용하며, 각 사업자의 보안 정책을 따릅니다.</p>
          <Table
            headers={['수탁 사업자', '위탁 업무']}
            rows={[
              ['Vercel Inc. (미국)', '프론트엔드 호스팅 (Next.js)'],
              ['Cloudflare, Inc. (미국)', '백엔드 네트워크 터널링 · CDN · WAF'],
              ['자체 운영 (대한민국)', 'PostgreSQL 데이터베이스 (맥 서버)'],
              ['Sentry (Functional Software, Inc., 미국)', '오류 모니터링 — 장애 발생 시 진단 정보(요청 경로 등) 일시 수집'],
              ['Vercel Analytics', '익명 트래픽 통계 (쿠키 미사용, 개인 식별 X)'],
            ]}
          />
        </Section>

        <Section title="6. 정보주체의 권리">
          <p>
            본인의 개인정보에 대해 다음 권리를 행사할 수 있습니다.
          </p>
          <ul className="ml-5 list-disc space-y-1">
            <li>
              <strong>표 삭제</strong>: 방 화면에서 본인 닉네임 옆 강퇴 버튼은 개설자만
              사용 가능. 본인이 직접 삭제를 원할 경우 아래 문의처로 연락하시면
              방 ID와 함께 처리합니다.
            </li>
            <li>
              <strong>방 전체 삭제</strong>: 개설자(creator_token 보유)는 어드민
              API를 통해 본인이 만든 방을 삭제할 수 있습니다.
            </li>
            <li>
              <strong>로컬 데이터 삭제</strong>: 브라우저 설정에서 사이트
              데이터 삭제 시 localStorage 의 토큰도 함께 삭제됩니다.
            </li>
          </ul>
        </Section>

        <Section title="7. 개인정보의 안전성 확보 조치">
          <ul className="ml-5 list-disc space-y-1">
            <li>PIN은 scrypt 단방향 해시로 저장 (원본 비밀번호 저장 X)</li>
            <li>모든 통신 HTTPS / TLS 1.3</li>
            <li>어드민 페이지는 토큰 기반 가드 + timingSafeEqual 비교</li>
            <li>외부 노출 표면 최소화 (DB 호스트 비공개, 백엔드는 Cloudflare Tunnel 통함)</li>
          </ul>
        </Section>

        <Section title="8. 14세 미만 아동의 개인정보">
          <p>
            본 서비스는 14세 미만 아동을 대상으로 하지 않으며, 14세 미만
            아동의 개인정보를 의도적으로 수집하지 않습니다. 14세 미만의
            정보가 수집된 사실을 인지하면 즉시 삭제합니다.
          </p>
        </Section>

        <Section title="9. 개인정보 보호 책임자">
          <p>
            서비스 운영 및 개인정보 관련 문의는 아래 이메일로 연락 부탁드립니다.
          </p>
          <ul className="ml-5 list-disc space-y-1">
            <li>
              이메일:{' '}
              <a
                href="mailto:hello.mealplan@gmail.com"
                className="text-zinc-700 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
              >
                hello.mealplan@gmail.com
              </a>
            </li>
            <li>
              GitHub Issues:{' '}
              <a
                href="https://github.com/milcho0604/daypoll/issues/new"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-700 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
              >
                milcho0604/daypoll
              </a>
            </li>
          </ul>
        </Section>

        <Section title="10. 변경 고지">
          <p>
            본 처리방침이 변경될 경우 변경 사항을 본 페이지 상단의 &ldquo;최종
            개정일&rdquo; 갱신과 함께 공지합니다. 중요한 변경은 서비스 내
            안내를 병행합니다.
          </p>
        </Section>
      </article>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Table({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-left text-xs">
        <thead className="bg-zinc-50 dark:bg-zinc-900">
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="px-3 py-2 font-semibold text-zinc-700 dark:text-zinc-300"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className="px-3 py-2 align-top text-zinc-700 dark:text-zinc-300">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
