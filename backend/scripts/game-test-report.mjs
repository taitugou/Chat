import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function ts() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function runNodeScript({ cwd, script, env }) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(process.execPath, [script], {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (b) => (stdout += b.toString('utf8')));
    child.stderr.on('data', (b) => (stderr += b.toString('utf8')));

    child.on('close', (code) => {
      resolve({
        script,
        code: Number(code ?? 0),
        durationMs: Date.now() - startedAt,
        stdout,
        stderr
      });
    });
  });
}

function mdEscape(s) {
  return String(s || '').replace(/\|/g, '\\|');
}

async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const backendRoot = dirname(here);
  const reportDir = join(backendRoot, 'reports', 'game-tests', ts());
  await mkdir(reportDir, { recursive: true });

  const baseUrl = process.env.BASE_URL || 'https://localhost:888';
  const env = { BASE_URL: baseUrl };

  const suite = [
    { name: 'game-e2e', script: join(here, 'game-e2e.mjs') },
    { name: 'game-scenarios', script: join(here, 'game-scenarios.mjs') }
  ];

  const results = [];
  for (const t of suite) {
    process.stdout.write(`run: ${t.name}\n`);
    const r = await runNodeScript({ cwd: backendRoot, script: t.script, env });
    results.push({ name: t.name, ...r });
    await writeFile(join(reportDir, `${t.name}.stdout.log`), r.stdout, 'utf8');
    await writeFile(join(reportDir, `${t.name}.stderr.log`), r.stderr, 'utf8');
  }

  const summary = {
    baseUrl,
    reportDir,
    generatedAt: new Date().toISOString(),
    results: results.map((r) => ({
      name: r.name,
      exitCode: r.code,
      durationMs: r.durationMs
    }))
  };
  await writeFile(join(reportDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');

  const lines = [];
  lines.push(`# 游戏规则验证测试报告`);
  lines.push(``);
  lines.push(`- BASE_URL: ${baseUrl}`);
  lines.push(`- 生成时间: ${summary.generatedAt}`);
  lines.push(`- 报告目录: ${reportDir}`);
  lines.push(``);
  lines.push(`| 套件 | 退出码 | 耗时(ms) | 标准输出 | 标准错误 |`);
  lines.push(`|---|---:|---:|---|---|`);
  for (const r of results) {
    lines.push(
      `| ${mdEscape(r.name)} | ${r.code} | ${r.durationMs} | ${mdEscape(`${r.name}.stdout.log`)} | ${mdEscape(`${r.name}.stderr.log`)} |`
    );
  }
  lines.push(``);
  lines.push(`## 判定规则`);
  lines.push(`- 退出码为 0 代表通过；非 0 代表失败。`);
  lines.push(`- 若出现网络/证书类错误，请先确认后端服务已启动且 BASE_URL 可访问。`);
  lines.push(``);
  await writeFile(join(reportDir, 'summary.md'), lines.join('\n'), 'utf8');

  const ok = results.every((r) => r.code === 0);
  if (!ok) process.exit(1);
  process.stdout.write(`game-test-report: ok\n`);
}

main().catch((e) => {
  process.stderr.write(`${e?.stack || e}\n`);
  process.exit(1);
});

