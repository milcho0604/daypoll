import CreateRoomForm from './create-room-form';

export const metadata = { title: '방 만들기 · 모일까' };

export default function NewRoomPage() {
  return (
    <main className="flex min-h-dvh flex-col px-5 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-md flex-1">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">방 만들기</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            제목과 후보 날짜만 정하면 끝. 마감일은 선택입니다.
          </p>
        </header>
        <CreateRoomForm />
      </div>
    </main>
  );
}
