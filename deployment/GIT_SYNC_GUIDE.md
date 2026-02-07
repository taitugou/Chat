# Git 自动上传/下载（同步）指南

## 你要的“自动上传/下载”是什么

- “下载”：把远端最新代码拉到本地，常用命令是 `git pull`（或先 `git fetch` 再合并/变基）
- “上传”：把本地提交推到远端，常用命令是 `git push`
- 真正意义的“自动”：把这两步包装成一键命令，或用定时任务周期执行

## 推荐的一键同步方式（本项目已内置）

项目已提供脚本：`deployment/git-sync.mjs`，并在根 `package.json` 增加了 npm 脚本。

### 仅同步（不自动提交）

```bash
npm run git:sync
```

等价于：

- `git pull --rebase --autostash`
- `git push`

### 同步前自动 add/commit（有改动才提交）

```bash
npm run git:sync -- --commit -m "chore: sync"
```

说明：

- 会先执行 `git add -A`
- 若存在改动则提交；若无改动则跳过提交

### 只看会执行什么（不实际执行）

```bash
npm run git:sync -- --dry-run
```

## 更“自动”的做法（可选）

### 方式 A：Windows 自动上传（任务计划程序）

目标：Windows 机器定时把本地改动自动提交并推送到远端（上传）。

项目已提供脚本：[windows-auto-push.ps1](file:///f:/C/deployment/windows-auto-push.ps1)。

- 程序/脚本：`powershell`
- 参数（示例：每 2 分钟自动 add/commit/push）：  
  `-NoProfile -ExecutionPolicy Bypass -File "F:\C\deployment\windows-auto-push.ps1" -Commit`
- 触发器：按分钟/小时重复（建议先用 2~5 分钟测试稳定后再拉长）

可选参数：

- `-NoPull`：只 push 不 pull（远端若领先会导致 push 被拒绝）
- `-Message "xxx"`：自定义提交信息
- `-DryRun`：只打印将执行的 git 命令（不实际执行）

建议：

- 如果你的“上传机”是唯一写入源，Linux 服务器只读拉取，那么冲突概率很低
- 不建议对包含敏感信息的目录做自动提交（比如本地私钥、只应存在于服务器的配置文件）

### 方式 B：Linux 服务器自动下载（systemd timer 或 cron）

目标：Linux 服务器定时拉取远端最新代码（下载），可选在有更新后执行重启命令。

项目已提供脚本：[linux-auto-pull.sh](file:///f:/C/deployment/linux-auto-pull.sh)。它默认使用 `git pull --ff-only`，并在工作区不干净时直接退出，避免覆盖服务器本地改动。

#### systemd timer（推荐）

1）把模板复制到服务器：

- [ttg-chat-pull.service](file:///f:/C/deployment/systemd/ttg-chat-pull.service)
- [ttg-chat-pull.timer](file:///f:/C/deployment/systemd/ttg-chat-pull.timer)

2）修改 `WorkingDirectory` / `REPO_DIR` / `User` 为你的实际路径与用户，例如：

- 仓库路径：`/opt/ttg-chat`
- 用户：`ttg`

3）启用定时器：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now ttg-chat-pull.timer
sudo systemctl list-timers | grep ttg-chat-pull
```

#### cron（备选）

每 2 分钟拉取一次（示例）：

```bash
*/2 * * * * REPO_DIR=/opt/ttg-chat /usr/bin/env bash /opt/ttg-chat/deployment/linux-auto-pull.sh >> /var/log/ttg-chat-pull.log 2>&1
```

### 方式 B：Git Hooks 自动 push（不推荐默认启用）

你可以在 `.git/hooks/post-commit` 里写入 `git push`，实现“提交即上传”。

风险点：

- 提交后自动 push 可能把未审核的提交推上去
- 网络波动会导致提交后出现额外失败提示

一般更建议你用 `npm run git:sync` 作为显式动作。

## 常见问题

### 1）第一次 push 报错没有上游分支

执行一次：

```bash
git push -u origin <你的分支名>
```

后续再用一键同步即可。

### 2）pull 出现冲突怎么办

- 先解决冲突文件
- 再 `git add -A`
- 再 `git rebase --continue`（如果是 rebase 过程）
- 最后 `git push`

一键脚本会在冲突时退出，避免自动把错误状态继续推送。

### 3）服务器只需要“下载”，权限怎么配更安全

推荐做法：

- 给服务器用只读的 Deploy Key（SSH 公钥）或只读 Token
- 服务器上只配置 `git pull` 所需的权限，不给 push 权限
