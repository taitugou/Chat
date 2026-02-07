import { spawnSync } from 'node:child_process'

function printHelp() {
  const text = `
用法:
  node deployment/git-sync.mjs [选项]

选项:
  --commit                 在同步前自动 git add -A 并提交（若有改动）
  -m, --message <msg>      提交信息（配合 --commit）
  --no-pull                跳过 git pull（默认会 pull --rebase --autostash）
  --no-push                跳过 git push
  --dry-run                仅打印将要执行的命令
  -h, --help               显示帮助

示例:
  npm run git:sync
  npm run git:sync -- --commit -m "chore: sync"
`.trim()
  process.stdout.write(`${text}\n`)
}

function parseArgs(argv) {
  const args = {
    commit: false,
    message: undefined,
    pull: true,
    push: true,
    dryRun: false,
    help: false,
  }

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--commit') args.commit = true
    else if (a === '-m' || a === '--message') args.message = argv[++i]
    else if (a === '--no-pull') args.pull = false
    else if (a === '--no-push') args.push = false
    else if (a === '--dry-run') args.dryRun = true
    else if (a === '-h' || a === '--help') args.help = true
    else throw new Error(`未知参数: ${a}`)
  }

  return args
}

function runGit(commandArgs, { capture = false, dryRun = false } = {}) {
  const printable = `git ${commandArgs.join(' ')}`
  if (dryRun) {
    process.stdout.write(`${printable}\n`)
    return { status: 0, stdout: '', stderr: '' }
  }

  const result = spawnSync('git', commandArgs, {
    shell: false,
    stdio: capture ? 'pipe' : 'inherit',
    encoding: 'utf8',
  })

  if (result.error) throw result.error
  if (result.status !== 0) {
    const stderr = capture ? (result.stderr || '') : ''
    const err = new Error(`命令失败: ${printable}${stderr ? `\n${stderr.trim()}` : ''}`)
    err.exitCode = result.status ?? 1
    throw err
  }

  return {
    status: result.status ?? 0,
    stdout: capture ? (result.stdout || '') : '',
    stderr: capture ? (result.stderr || '') : '',
  }
}

function ensureGitRepo(dryRun) {
  if (dryRun) return
  const res = runGit(['rev-parse', '--is-inside-work-tree'], { capture: true, dryRun })
  const ok = String(res.stdout).trim() === 'true'
  if (!ok) throw new Error('当前目录不是 Git 仓库（找不到 .git）')
}

function ensureOriginRemote(dryRun) {
  const res = runGit(['remote'], { capture: true, dryRun })
  if (dryRun) return
  const remotes = res.stdout
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  if (!remotes.includes('origin')) throw new Error('未配置远端 origin（先执行 git remote add origin <url>）')
}

function formatTimestamp() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const yyyy = d.getFullYear()
  const mm = pad(d.getMonth() + 1)
  const dd = pad(d.getDate())
  const hh = pad(d.getHours())
  const mi = pad(d.getMinutes())
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}

function hasStagedChanges(dryRun) {
  const res = runGit(['diff', '--cached', '--name-only'], { capture: true, dryRun })
  if (dryRun) return false
  return res.stdout.trim().length > 0
}

async function main() {
  let args
  try {
    args = parseArgs(process.argv.slice(2))
  } catch (e) {
    process.stderr.write(`${e.message}\n`)
    printHelp()
    process.exit(2)
  }

  if (args.help) {
    printHelp()
    return
  }

  ensureGitRepo(args.dryRun)
  ensureOriginRemote(args.dryRun)

  if (args.commit) {
    runGit(['add', '-A'], { dryRun: args.dryRun })
    if (hasStagedChanges(args.dryRun)) {
      const message = args.message && args.message.trim()
      const finalMessage = message && message.length > 0 ? message : `chore: sync ${formatTimestamp()}`
      runGit(['commit', '-m', finalMessage], { dryRun: args.dryRun })
    }
  }

  if (args.pull) runGit(['pull', '--rebase', '--autostash'], { dryRun: args.dryRun })
  if (args.push) runGit(['push'], { dryRun: args.dryRun })
}

main().catch((e) => {
  process.stderr.write(`${e.message}\n`)
  process.exit(Number(e.exitCode) || 1)
})
