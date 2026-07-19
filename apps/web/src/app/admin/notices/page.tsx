'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { Notice } from '@whenever/shared';
import {
  adminCreateNotice,
  adminDeleteNotice,
  adminListNotices,
  adminPublishNotice,
  adminUpdateNotice,
  getAdminToken,
} from '@/lib/admin';
import { ApiError } from '@/lib/api';
import EmptyState from '@/components/empty-state';
import ConfirmModal from '@/components/confirm-modal';

// datetime-local(타임존 없는 "YYYY-MM-DDTHH:mm") ↔ ISO(UTC) 변환.
// **KST 벽시계로 고정 해석**한다 — 운영자가 한국 밖(다른 타임존)에서 입력해도
// 사용자에게 보이는 시각이 어긋나지 않게. (new Date(local) 은 브라우저 로컬로
// 해석돼 위험 → 명시적으로 +09:00 을 붙인다.)
const pad = (n: number) => String(n).padStart(2, '0');

function localToIso(local: string): string | null {
  if (!local) return null;
  // "YYYY-MM-DDTHH:mm" 를 KST 로 못박아 UTC ISO 로.
  const d = new Date(`${local}:00+09:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
function isoToLocal(iso: string | null): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  // UTC instant → KST 벽시계 (UTC + 9h 후 UTC 컴포넌트를 읽으면 KST 벽시계).
  const k = new Date(t + 9 * 60 * 60 * 1000);
  return `${k.getUTCFullYear()}-${pad(k.getUTCMonth() + 1)}-${pad(k.getUTCDate())}T${pad(k.getUTCHours())}:${pad(k.getUTCMinutes())}`;
}
function formatKST(iso: string): string {
  try {
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

const EMPTY = { title: '', body: '', scheduledLocal: '' };

export default function AdminNoticesPage() {
  const router = useRouter();
  const [list, setList] = useState<Notice[] | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null); // null = 새 공지
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Notice | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await adminListNotices();
      setList(r);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401)
        router.replace('/admin/login');
      else setError('목록을 불러오지 못했어요.');
    }
  }, [router]);

  useEffect(() => {
    if (!getAdminToken()) {
      router.replace('/admin/login');
      return;
    }
    // load() 의 setState 는 모두 await 뒤라 동기 실행 아님 — heuristic false positive.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [router, load]);

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY);
    setError(null);
  };

  const startEdit = (n: Notice) => {
    setEditingId(n.id);
    setForm({
      title: n.title,
      body: n.body,
      scheduledLocal: isoToLocal(n.scheduledAt),
    });
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) {
      setError('제목과 내용을 입력해주세요.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const input = {
        title: form.title.trim(),
        body: form.body,
        scheduledAt: localToIso(form.scheduledLocal),
      };
      if (editingId == null) await adminCreateNotice(input);
      else await adminUpdateNotice(editingId, input);
      resetForm();
      await load();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401)
        router.replace('/admin/login');
      else setError('저장에 실패했어요. 입력을 확인해주세요.');
    } finally {
      setBusy(false);
    }
  };

  const togglePublish = async (n: Notice) => {
    setBusy(true);
    try {
      await adminPublishNotice(n.id, !n.published);
      await load();
    } catch {
      setError('게시 상태 변경에 실패했어요.');
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await adminDeleteNotice(deleteTarget.id);
      if (editingId === deleteTarget.id) resetForm();
      setDeleteTarget(null);
      await load();
    } catch {
      setError('삭제에 실패했어요.');
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    'h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/40';

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-lg font-semibold">공지 관리</h1>
        <p className="mt-1 text-sm text-zinc-500">
          메인 화면 팝업으로 뜨는 공지예요. 게시된 것 중 <strong>가장 최근 1건</strong>이
          노출돼요.
        </p>
      </header>

      {/* 작성/수정 폼 */}
      <form
        onSubmit={submit}
        className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            {editingId == null ? '새 공지 작성' : `공지 #${editingId} 수정`}
          </h2>
          {editingId != null && (
            <button
              type="button"
              onClick={resetForm}
              className="press text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              새로 작성
            </button>
          )}
        </div>
        <input
          type="text"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder="제목 (예: 점검 안내)"
          maxLength={120}
          className={inputCls}
        />
        <textarea
          value={form.body}
          onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
          placeholder={'내용 (줄바꿈 가능)\n예: 7월 20일 밤 12시경 약 5분 점검이 있어요.'}
          rows={4}
          maxLength={2000}
          className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/40"
        />
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-500">점검 예정 시각 (선택 · KST)</span>
          <input
            type="datetime-local"
            value={form.scheduledLocal}
            onChange={(e) =>
              setForm((f) => ({ ...f, scheduledLocal: e.target.value }))
            }
            className="h-12 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy}
            className="press h-12 flex-1 rounded-xl bg-zinc-900 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-zinc-900"
          >
            {busy ? '저장 중…' : editingId == null ? '저장 (초안)' : '수정 저장'}
          </button>
        </div>
        <p className="text-xs text-zinc-400">
          저장하면 초안 상태예요. 아래 목록에서 <strong>게시</strong>를 눌러야 실제로
          팝업이 떠요.
        </p>
      </form>

      {/* 목록 */}
      {list == null ? (
        <p className="text-sm text-zinc-500">불러오는 중…</p>
      ) : list.length === 0 ? (
        <EmptyState emoji="📭" message="아직 공지가 없어요" />
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((n) => (
            <li
              key={n.id}
              className={`rounded-xl border bg-white p-4 dark:bg-zinc-900 ${
                n.published
                  ? 'border-zinc-300 shadow-sm dark:border-zinc-600'
                  : 'border-zinc-200 dark:border-zinc-800'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold">
                      {n.title}
                    </span>
                    {n.published ? (
                      <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                        게시중
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                        초안
                      </span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 whitespace-pre-line text-xs text-zinc-500">
                    {n.body}
                  </p>
                  {n.scheduledAt && (
                    <p className="mt-1 text-xs text-zinc-400">
                      🗓️ {formatKST(n.scheduledAt)}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => void togglePublish(n)}
                    disabled={busy}
                    className={`press h-9 rounded-full px-3 text-xs font-medium disabled:opacity-50 ${
                      n.published
                        ? 'border border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300'
                        : 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                    }`}
                  >
                    {n.published ? '게시 중단' : '게시'}
                  </button>
                  <div className="flex gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => startEdit(n)}
                      className="press text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(n)}
                      className="press text-zinc-400 hover:text-rose-600"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="공지를 삭제할까요?"
        message={deleteTarget ? `"${deleteTarget.title}"` : undefined}
        confirmLabel="삭제"
        danger
        busy={busy}
        onConfirm={() => void doDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
