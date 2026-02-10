# 上传/下拉（Windows → GitHub → Linux 服务器）说明

本文按你现在的使用方式整理：先在 Windows 开发机把代码上传到 GitHub，再让 Linux 服务器从 GitHub 下拉并覆盖到最新版本。

## 1. Windows：上传到 GitHub（push）

### 1.1 常规上传（推荐，保留历史）

```powershell
cd F:\C
git status
git add -A
git commit -m "sync"
git push -u origin main
```

### 1.2 只想一键（本项目内置）

```powershell
cd F:\C
npm run git:sync -- --commit -m "sync"
```

### 1.3 强制用本地覆盖 GitHub（危险，改历史）

仅当你明确要以本地为准覆盖远端时使用：

```powershell
cd F:\C
git push --force-with-lease origin main
```

## 2. Linux：从 GitHub 下拉并覆盖（pull + reset）

### 2.1 只下拉（工作区必须干净）

```bash
cd ~/ttg-chat
git pull --ff-only
```

### 2.2 强制用 GitHub 覆盖服务器（推荐服务器只读模式）

会丢弃服务器本地改动，把服务器代码强制对齐到远端：

```bash
cd ~/ttg-chat
git fetch --all --prune
git reset --hard origin/main
git clean -fd
```

验证是否对齐：

```bash
cd ~/ttg-chat
git status
git log -1 --oneline
```

## 3. 自动化（可选）

### 3.1 Windows 自动上传（任务计划程序执行）

测试（只打印不执行）：

```powershell
cd F:\C
powershell -NoProfile -ExecutionPolicy Bypass -File .\deployment\windows-auto-push.ps1 -Commit -DryRun
```

真实执行（自动 add/commit/push）：

```powershell
cd F:\C
powershell -NoProfile -ExecutionPolicy Bypass -File .\deployment\windows-auto-push.ps1 -Commit -Message "auto sync"
```

### 3.2 Linux 自动下拉（脚本）

```bash
cd ~/ttg-chat
REPO_DIR="$PWD" bash ./deployment/linux-auto-pull.sh
```

也可用 cron / systemd 定时运行（详见 `deployment/GIT_SYNC_GUIDE.md`）。

## 4. 常见问题

### 4.0 Windows push 显示 Everything up-to-date

说明 GitHub 已经是最新，不需要覆盖。

你可以用下面命令核对差异：

```powershell
cd F:\C
git status
git log -1 --oneline
git ls-remote --heads origin main
```

### 4.1 Linux pull 报：You have unstaged changes

服务器只负责下拉时，通常直接丢弃本地改动：

```bash
cd ~/ttg-chat
git reset --hard HEAD
git clean -fd
git pull --ff-only
```

若需要保留改动，先 stash：

```bash
cd ~/ttg-chat
git stash push -u -m "server backup before pull"
git pull --rebase
```

### 4.2 Linux 拉取 GitHub 报 TLS/GnuTLS 错误

这是网络/SSL 连接不稳定导致，建议长期把服务器远端切换到 SSH Deploy Key（只读）以提高稳定性。

### 4.3 “Windows 覆盖 GitHub → GitHub 覆盖服务器”标准流程（最少命令）

Windows：

```powershell
cd F:\C
git add -A
git commit -m "sync"
git push
```

Linux：

```bash
cd ~/ttg-chat
git fetch --all --prune
git reset --hard origin/main
git clean -fd
```
