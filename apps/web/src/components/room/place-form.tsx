'use client';

import { PLACE_MEMO_MAX, PLACE_NAME_MAX } from '@whenever/shared';
import { useEffect, useRef, useState } from 'react';
import { mapSearchLinks, parsePlaceShare } from '@/lib/place-share';

export type PlaceInput = { name: string; url: string; memo: string };

// 장소 후보 입력 폼 — 방 화면의 추가·수정, 방 만들기의 "미리 넣기" 가 같이 쓴다.
//
// 편의 장치:
//  - 지도 앱 "공유 → 복사" 텍스트를 이름·링크 칸 어디에 붙여도 이름/링크로 나눠 채움
//  - 이름만 적었으면 "지도에서 찾기" 링크 — 찾은 곳의 공유 링크를 복사해 오면 된다
//  - 이미 손으로 고친 이름은 붙여넣기가 덮지 않는다
export default function PlaceForm({
  initial,
  submitLabel,
  busyLabel,
  onSubmit,
  onCancel,
  onDraftChange,
  compact = false,
}: {
  initial?: PlaceInput;
  submitLabel: string;
  busyLabel: string;
  onSubmit: (input: PlaceInput) => Promise<string | null>; // 실패 메시지 또는 null
  onCancel?: () => void;
  compact?: boolean; // 방 만들기 폼 안 — 테두리 카드 없이, 안내 문구 짧게
  // 적어놓고 아직 안 넣은 게 있는지 — 방 만들기가 "넣기" 안 누른 후보를 조용히
  // 버리지 않게 바깥에서 막는 데 쓴다.
  onDraftChange?: (hasDraft: boolean) => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [nameTouched, setNameTouched] = useState(!!initial?.name);
  const [url, setUrl] = useState(initial?.url ?? '');
  const [urlChoices, setUrlChoices] = useState<string[]>([]);
  const [memo, setMemo] = useState(initial?.memo ?? '');
  const [pasteNote, setPasteNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasDraft = !initial && (name.trim() !== '' || url.trim() !== '');
  useEffect(() => {
    onDraftChange?.(hasDraft);
  }, [hasDraft, onDraftChange]);
  // 언마운트(예: 20번째를 넣어 폼이 사라짐)되면 남은 초안도 없는 것 — 안 알리면
  // 바깥이 "적어둔 장소가 있어요" 에 갇힌다.
  useEffect(() => () => onDraftChange?.(false), [onDraftChange]);

  // 같은 틱에 두 번 들어오는 제출(한글 IME 의 Enter 이중 keydown 등)을 막는다.
  // busy state 는 클로저라 같은 틱의 두 번째 호출을 못 막는다.
  const busyRef = useRef(false);
  const onEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!compact || e.key !== 'Enter') return;
    e.preventDefault(); // compact(div) 모드: 바깥 방 만들기 폼 제출 방지
    if (e.nativeEvent.isComposing || e.keyCode === 229) return; // 한글 조합 중
    void submit(e);
  };

  function onPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text/plain');
    if (!/https?:\/\//i.test(text)) return; // 링크 없는 평범한 붙여넣기는 그대로
    const parsed = parsePlaceShare(text);
    if (parsed.urls.length === 0) return;
    e.preventDefault();
    if (parsed.url) {
      setUrl(parsed.url);
      setUrlChoices([]);
    } else {
      setUrlChoices(parsed.urls.slice(0, 4));
    }
    const canFillName = !nameTouched || name.trim() === '';
    if (parsed.name && canFillName) {
      setName(parsed.name.slice(0, PLACE_NAME_MAX));
      setPasteNote('이름이랑 링크를 채웠어요. 맞는지 한 번 봐주세요');
    } else if (parsed.url) {
      setPasteNote(
        name.trim() ? '링크를 채웠어요' : '링크를 채웠어요. 이름은 직접 적어주세요',
      );
    } else {
      setPasteNote('링크가 여러 개예요. 하나 골라주세요');
    }
  }

  async function submit(e: React.SyntheticEvent) {
    e.preventDefault();
    e.stopPropagation(); // 방 만들기 폼 안에 있을 때 바깥 폼 제출로 새지 않게
    if (!name.trim() || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    const err = await onSubmit({ name, url, memo });
    busyRef.current = false;
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    if (!initial) {
      setName('');
      setNameTouched(false);
      setUrl('');
      setMemo('');
      setPasteNote(null);
      setUrlChoices([]);
    }
  }

  const searchLinks = !url.trim() && name.trim() ? mapSearchLinks(name) : [];
  const inputCls =
    'h-12 rounded-xl border border-zinc-200 bg-white px-4 text-base outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/40 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/40';

  // 방 만들기 폼 안에서는 <form> 을 중첩할 수 없어 div + 명시적 버튼 처리.
  const Wrapper = compact ? 'div' : 'form';
  return (
    <Wrapper
      {...(compact ? {} : { onSubmit: (e: React.SyntheticEvent) => void submit(e) })}
      className={`flex flex-col gap-3 ${
        compact
          ? ''
          : 'fade-up rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900'
      }`}
    >
      <p className="break-keep text-xs text-zinc-500 dark:text-zinc-400">
        💡 네이버 지도·카카오맵에서 <b>공유 → 복사</b> 한 걸 그대로 붙여넣으면 이름이랑 링크가 채워져요
      </p>
      <input
        type="text"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setNameTouched(true);
        }}
        onPaste={onPaste}
        onKeyDown={onEnter}
        placeholder="가게·장소·메뉴 (예: 을지로 노가리골목)"
        maxLength={PLACE_NAME_MAX}
        aria-label="장소 이름"
        className={inputCls}
      />
      <input
        // type="url" 이면 바깥 폼 제출 때 브라우저 기본 검증 말풍선이 우리 안내보다 먼저 뜬다.
        type="text"
        inputMode="url"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={url}
        onChange={(e) => {
          setUrl(e.target.value);
          setUrlChoices([]);
        }}
        onPaste={onPaste}
        onKeyDown={onEnter}
        placeholder="지도·가게 링크 (선택)"
        aria-label="링크"
        className={inputCls}
      />
      {searchLinks.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
          <span>링크가 없으면</span>
          {searchLinks.map((l) => (
            <a
              key={l.label}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="press underline underline-offset-2 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              {l.label}에서 찾기 ↗
            </a>
          ))}
        </div>
      )}
      {urlChoices.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {urlChoices.map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => {
                setUrl(u);
                setUrlChoices([]);
                setPasteNote(null);
              }}
              className="press inline-flex h-9 max-w-full items-center truncate rounded-full border border-zinc-200 bg-white px-3 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
            >
              {u}
            </button>
          ))}
        </div>
      )}
      <input
        type="text"
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        onKeyDown={onEnter}
        placeholder="한 줄 메모 (선택) — 예: 1인 2만 원, 룸 있음"
        maxLength={PLACE_MEMO_MAX}
        aria-label="메모"
        className={inputCls}
      />
      {pasteNote && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">{pasteNote}</p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
        >
          {error}
        </p>
      )}
      <div className="flex gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="press h-12 flex-1 rounded-xl border border-zinc-200 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
          >
            취소
          </button>
        )}
        <button
          type={compact ? 'button' : 'submit'}
          onClick={compact ? (e) => void submit(e) : undefined}
          disabled={busy || !name.trim()}
          className="press h-12 flex-1 rounded-xl bg-zinc-900 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-300 dark:bg-white dark:text-zinc-900 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-500"
        >
          {busy ? busyLabel : submitLabel}
        </button>
      </div>
    </Wrapper>
  );
}
