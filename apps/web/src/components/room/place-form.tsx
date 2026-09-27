'use client';

import { PLACE_MEMO_MAX, PLACE_NAME_MAX } from '@whenever/shared';
import { useEffect, useRef, useState } from 'react';
import {
  mapSearchLinks,
  parsePlaceShare,
  providerOf,
  safeHref,
} from '@/lib/place-share';

export type PlaceInput = { name: string; url: string; memo: string };

const HAS_URL = /https?:\/\//i;

// 장소 후보 입력 — 방 화면의 추가·수정, 방 만들기의 "미리 넣기" 가 같이 쓴다.
//
// 입력칸은 하나. 가게 이름을 적든, 지도 앱 공유 글을 붙이든, "이름 + 링크" 를 한 번에
// 넣든 — http… 부분은 알아서 떼어 링크 칩으로 옮기고 나머지는 이름으로 남긴다.
// (예전엔 이름·링크 칸이 따로라 사용자가 링크를 직접 잘라 옮겨야 했다 — 불편 제보)
// 메모는 대부분 안 쓰니 "+ 메모" 뒤로 접는다.
export default function PlaceForm({
  initial,
  submitLabel,
  busyLabel,
  onSubmit,
  onCancel,
  onDraftChange,
  compact = false,
  autoFocus = false,
}: {
  initial?: PlaceInput;
  submitLabel: string;
  busyLabel: string;
  onSubmit: (input: PlaceInput) => Promise<string | null>; // 실패 메시지 또는 null
  onCancel?: () => void;
  // 적어놓고 아직 안 넣은 게 있는지 — 방 만들기가 "넣기" 안 누른 후보를 조용히
  // 버리지 않게 바깥에서 막는 데 쓴다.
  onDraftChange?: (hasDraft: boolean) => void;
  compact?: boolean; // 방 만들기 폼 안 — <form> 중첩 불가라 div 로, 테두리 카드 없이
  autoFocus?: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [url, setUrl] = useState(initial?.url ?? '');
  const [urlChoices, setUrlChoices] = useState<string[]>([]);
  const [memo, setMemo] = useState(initial?.memo ?? '');
  const [memoOpen, setMemoOpen] = useState(!!initial?.memo);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  // 같은 틱에 두 번 들어오는 제출(한글 IME 의 Enter 이중 keydown 등) 방지.
  // busy state 는 클로저라 같은 틱의 두 번째 호출을 못 막는다.
  const busyRef = useRef(false);

  const hasDraft = !initial && (name.trim() !== '' || url.trim() !== '');
  useEffect(() => {
    onDraftChange?.(hasDraft);
  }, [hasDraft, onDraftChange]);
  // 언마운트(예: 20번째를 넣어 폼이 사라짐)되면 남은 초안도 없는 것 — 안 알리면
  // 바깥이 "적어둔 장소가 있어요" 에 갇힌다.
  useEffect(() => () => onDraftChange?.(false), [onDraftChange]);

  // 링크가 섞인 글 → 링크는 칩으로, 나머지는 이름으로.
  function absorb(text: string, prevName: string): boolean {
    const parsed = parsePlaceShare(text);
    if (parsed.urls.length === 0) return false;
    if (parsed.url) {
      setUrl(parsed.url);
      setUrlChoices([]);
    } else {
      setUrlChoices(parsed.urls.slice(0, 4));
    }
    // 붙인 글에서 이름을 못 찾았으면 이미 적어둔 이름 유지.
    const nextName = (parsed.name ?? prevName).slice(0, PLACE_NAME_MAX);
    setName(nextName);
    setNote(
      parsed.url
        ? nextName.trim()
          ? '링크는 따로 떼어뒀어요. 이름이 맞는지 봐주세요'
          : '링크를 넣었어요. 가게 이름만 적어주세요'
        : '링크가 여러 개예요. 하나 골라주세요',
    );
    return true;
  }

  // 붙여넣기는 클립보드 원문(줄바꿈 살아 있음)으로 나눈다 — 한 줄 입력칸이
  // 줄바꿈을 공백으로 뭉개기 전에.
  function onPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text/plain');
    if (!HAS_URL.test(text)) return;
    const el = e.currentTarget;
    // 커서 앞뒤에 이미 적힌 글도 같이 (예: "을지로 노가리 " 적고 링크 붙이기)
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const merged = `${el.value.slice(0, start)}\n${text}\n${el.value.slice(end)}`;
    e.preventDefault();
    absorb(merged, name);
  }

  // 모바일 키보드의 붙여넣기·자동완성은 paste 이벤트 없이 값만 바뀌기도 한다 —
  // 값에 링크가 생기면 그때도 나눈다.
  function onNameChange(v: string) {
    if (HAS_URL.test(v) && absorb(v, '')) return;
    // maxLength 를 안 건 건 링크째 붙여도 잘리지 않게 하려고 — 이름은 여기서 40자로.
    setName(v.slice(0, PLACE_NAME_MAX));
    if (note) setNote(null);
  }

  async function submit(e?: React.SyntheticEvent) {
    e?.preventDefault();
    e?.stopPropagation(); // 방 만들기 폼 안에 있을 때 바깥 폼 제출로 새지 않게
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
      setUrl('');
      setMemo('');
      setMemoOpen(false);
      setNote(null);
      setUrlChoices([]);
      nameRef.current?.focus(); // 연달아 여러 곳 넣기 편하게
    }
  }

  const onEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault(); // compact(div) 모드: 바깥 방 만들기 폼 제출 방지
    if (e.nativeEvent.isComposing || e.keyCode === 229) return; // 한글 조합 중
    void submit(e);
  };

  const href = safeHref(url);
  const provider = href ? providerOf(href) : null;
  const searchLinks = !url.trim() && name.trim() ? mapSearchLinks(name) : [];
  const inputCls =
    'h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 text-base outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/40 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/40';

  const Wrapper = compact ? 'div' : 'form';
  return (
    <Wrapper
      {...(compact
        ? {}
        : { onSubmit: (e: React.SyntheticEvent) => void submit(e) })}
      className={`flex flex-col gap-3 ${
        compact
          ? ''
          : 'fade-up rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900'
      }`}
    >
      <input
        ref={nameRef}
        type="text"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        onPaste={onPaste}
        onKeyDown={onEnter}
        autoFocus={autoFocus}
        enterKeyHint="done"
        placeholder="가게 이름, 또는 지도 링크 붙여넣기"
        aria-label="장소 이름 또는 링크"
        className={inputCls}
      />

      {/* 떼어낸 링크 — 칩으로 보여주고 ✕ 로 뺀다 */}
      {href && (
        <div className="flex min-w-0">
          <span className="inline-flex h-9 min-w-0 max-w-full items-center gap-1.5 rounded-full bg-zinc-100 pl-3 pr-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            <span aria-hidden>{provider?.kind === 'map' ? '📍' : '🔗'}</span>
            <span className="shrink-0 font-medium">{provider?.label ?? '링크'}</span>
            <span className="truncate text-zinc-400">
              {href.replace(/^https?:\/\/(www\.)?/, '')}
            </span>
            <button
              type="button"
              onClick={() => {
                setUrl('');
                setNote(null);
              }}
              aria-label="링크 빼기"
              className="press ml-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700"
            >
              ✕
            </button>
          </span>
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
                setNote(null);
              }}
              className="press inline-flex h-9 max-w-full items-center truncate rounded-full border border-zinc-200 bg-white px-3 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
            >
              {u}
            </button>
          ))}
        </div>
      )}

      {note ? (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">{note}</p>
      ) : searchLinks.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
          <span>링크는 선택 ·</span>
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
      ) : (
        !href && (
          <p className="break-keep text-xs text-zinc-500 dark:text-zinc-400">
            💡 네이버 지도·카카오맵에서 <b>공유 → 복사</b> 한 걸 그대로 붙여도 돼요
          </p>
        )
      )}

      {memoOpen ? (
        <input
          type="text"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          onKeyDown={onEnter}
          enterKeyHint="done"
          placeholder="한 줄 메모 — 예: 1인 2만 원, 룸 있음"
          maxLength={PLACE_MEMO_MAX}
          aria-label="메모"
          className={inputCls}
        />
      ) : (
        <button
          type="button"
          onClick={() => setMemoOpen(true)}
          className="press self-start text-xs font-medium text-zinc-500 underline underline-offset-2 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          ＋ 메모 (가격·특징)
        </button>
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
