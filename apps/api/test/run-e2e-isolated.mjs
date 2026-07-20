// e2e 스펙을 파일마다 별도 프로세스로 순차 실행한다.
//
// 왜: 여러 e2e 스위트를 한 프로세스(`jest --runInBand`)에 몰아넣으면, 스위트마다
// NestJS 앱(HTTP + socket.io 게이트웨이)을 만들고 닫는 과정이 서로 간섭해
// ~10~25% 확률로 엉뚱한 401/404 가 튄다(라우트·인증은 결정적이라 실제 버그 아님 —
// 각 스펙을 단독 실행하면 항상 통과). 공유 DB 라 병렬은 truncate 레이스가 나므로,
// "파일별 독립 프로세스 + 순차" 로 격리와 직렬성을 동시에 만족시킨다.
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const testDir = dirname(fileURLToPath(import.meta.url));
const apiDir = join(testDir, '..');
const jestBin = join(
  apiDir,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'jest.cmd' : 'jest',
);
const configPath = join(testDir, 'jest-e2e.json');

const specs = readdirSync(testDir)
  .filter((f) => f.endsWith('.e2e-spec.ts'))
  .sort();

const failed = [];
for (const spec of specs) {
  process.stdout.write(`\n── ${spec} ──\n`);
  const r = spawnSync(
    jestBin,
    ['--config', configPath, '--runInBand', spec],
    { stdio: 'inherit', cwd: apiDir },
  );
  if (r.status !== 0) failed.push(spec);
}

process.stdout.write(
  `\n=== e2e (isolated) ${failed.length ? 'FAILED' : 'OK'} — ` +
    `${specs.length - failed.length}/${specs.length} suites passed ===\n`,
);
if (failed.length) {
  process.stdout.write(`failed: ${failed.join(', ')}\n`);
  process.exit(1);
}
