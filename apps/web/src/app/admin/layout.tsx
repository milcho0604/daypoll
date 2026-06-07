import type { ReactNode } from 'react';
import AdminTopbar from './admin-topbar';

export const metadata = {
  title: '어드민 · 언제모여',
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-950">
      <AdminTopbar />
      <div className="mx-auto w-full max-w-6xl px-5 py-6">{children}</div>
    </div>
  );
}
