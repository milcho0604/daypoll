import Link from 'next/link';

export const metadata = {
  title: '이용약관 · 언제모여',
  description: '언제모여 서비스 이용약관.',
};

const LAST_UPDATED = '2026-06-08';

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-16 sm:pt-12 sm:pb-20">
      <header className="mb-8">
        <Link
          href="/"
          className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          ← 홈으로
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">이용약관</h1>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          최종 개정일: {LAST_UPDATED}
        </p>
      </header>

      <article className="space-y-6 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        <Section title="제1조 (목적)">
          <p>
            본 약관은 언제모여(이하 &ldquo;서비스&rdquo;)를 이용함에 있어 운영자와
            이용자 간의 권리·의무 및 책임 사항을 규정함을 목적으로 합니다.
          </p>
        </Section>

        <Section title="제2조 (서비스의 내용)">
          <ol className="ml-5 list-decimal space-y-1">
            <li>
              회원가입 없이 링크 하나로 친구들과 모일 날짜를 정하는 도구를
              제공합니다.
            </li>
            <li>
              제공되는 주요 기능: 방 생성, 후보 날짜 등록, 닉네임 기반 투표,
              결과 집계, 마감일 관리, .ics 캘린더 파일 내보내기.
            </li>
            <li>
              서비스는 무료로 제공되며, 운영 사정에 따라 일시 중단되거나 종료될
              수 있습니다.
            </li>
          </ol>
        </Section>

        <Section title="제3조 (회원가입 없음)">
          <p>
            본 서비스는 회원가입 절차가 없습니다. 이용자는 닉네임만 입력하여
            즉시 참여할 수 있으며, 선택적으로 4자리 PIN을 설정하여 다른
            기기에서 본인 표를 복원할 수 있습니다.
          </p>
        </Section>

        <Section title="제4조 (이용자의 의무)">
          <p>이용자는 다음 행위를 해서는 안 됩니다.</p>
          <ul className="ml-5 list-disc space-y-1">
            <li>타인의 명예를 훼손하거나 모욕적인 닉네임 사용</li>
            <li>서비스를 영리 목적으로 무단 이용</li>
            <li>
              자동화 도구로 다량의 방을 생성하거나 비정상적인 호출을 시도하는
              행위 (rate limit 으로 차단됨)
            </li>
            <li>서비스의 안정적 운영을 방해하는 행위</li>
          </ul>
        </Section>

        <Section title="제5조 (운영자의 권한)">
          <p>
            운영자는 본 약관 또는 관련 법령을 위반한 이용자의 방·표를 사전 통지
            없이 삭제하거나 IP 차단할 수 있습니다. 90일이 지난 방은 자동 삭제
            정책에 따라 일괄 정리됩니다.
          </p>
        </Section>

        <Section title="제6조 (책임 한계)">
          <ol className="ml-5 list-decimal space-y-1">
            <li>
              본 서비스는 친구간 일정 조율을 돕는 보조 도구로, 결정된 모임의
              실제 진행과 결과에 대한 책임은 이용자 본인에게 있습니다.
            </li>
            <li>
              천재지변, 정전, 서비스 인프라(Vercel, Tailscale, 운영 서버 등)의
              장애로 인한 서비스 중단에 대해 운영자는 책임을 지지 않습니다.
            </li>
            <li>
              이용자가 입력한 닉네임·날짜 등의 정확성에 대한 책임은 입력한
              이용자에게 있습니다.
            </li>
          </ol>
        </Section>

        <Section title="제7조 (저작권 및 라이선스)">
          <p>
            본 서비스의 소스코드는 GitHub 에 MIT 라이선스로 공개되어 있습니다.
            서비스 상의 디자인·문구·로고에 대한 권리는 운영자에게 있습니다.
          </p>
          <p>
            소스코드:{' '}
            <a
              href="https://github.com/milcho0604/daypoll"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-700 underline-offset-2 hover:underline dark:text-amber-300"
            >
              milcho0604/daypoll
            </a>
          </p>
        </Section>

        <Section title="제8조 (개인정보 보호)">
          <p>
            개인정보의 수집·이용·보관에 관한 사항은 별도의{' '}
            <Link
              href="/privacy"
              className="text-amber-700 underline-offset-2 hover:underline dark:text-amber-300"
            >
              개인정보처리방침
            </Link>
            을 따릅니다.
          </p>
        </Section>

        <Section title="제9조 (약관의 변경)">
          <p>
            본 약관은 운영 사정에 따라 변경될 수 있으며, 변경 시 본 페이지
            상단의 &ldquo;최종 개정일&rdquo; 갱신과 함께 공지합니다. 변경 후
            서비스 이용을 계속하는 경우 변경된 약관에 동의한 것으로 간주합니다.
          </p>
        </Section>

        <Section title="제10조 (문의)">
          <ul className="ml-5 list-disc space-y-1">
            <li>
              일반 문의:{' '}
              <a
                href="mailto:hello.mealplan@gmail.com"
                className="text-amber-700 underline-offset-2 hover:underline dark:text-amber-300"
              >
                hello.mealplan@gmail.com
              </a>
            </li>
            <li>
              버그·기능 제안:{' '}
              <a
                href="https://github.com/milcho0604/daypoll/issues/new"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-700 underline-offset-2 hover:underline dark:text-amber-300"
              >
                GitHub Issues
              </a>
            </li>
          </ul>
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
