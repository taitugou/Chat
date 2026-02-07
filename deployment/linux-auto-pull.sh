#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${REPO_DIR:-}"
POST_PULL_CMD="${POST_PULL_CMD:-}"
RETRIES="${RETRIES:-3}"
RETRY_SLEEP_SEC="${RETRY_SLEEP_SEC:-5}"

usage() {
  cat <<'EOF'
用法:
  REPO_DIR=/path/to/repo POST_PULL_CMD="..." ./deployment/linux-auto-pull.sh
  ./deployment/linux-auto-pull.sh /path/to/repo

环境变量:
  REPO_DIR        仓库目录（可用第一个参数替代）
  POST_PULL_CMD   拉取成功且有更新后执行的命令（可选）
  RETRIES         git 拉取失败重试次数（默认 3）
  RETRY_SLEEP_SEC 每次重试间隔秒数（默认 5）

说明:
  - 默认使用 git pull --ff-only（避免自动合并/变基）
  - 若工作区不干净（有未提交改动），脚本会直接退出避免覆盖
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ -z "$REPO_DIR" ]]; then
  REPO_DIR="${1:-}"
fi

if [[ -z "$REPO_DIR" ]]; then
  usage
  exit 2
fi

cd "$REPO_DIR"

retry() {
  local -r max="${1}"
  local -r sleepSec="${2}"
  shift 2
  local attempt=1
  while true; do
    if "$@"; then
      return 0
    fi
    if [[ "$attempt" -ge "$max" ]]; then
      return 1
    fi
    echo "git 操作失败，${sleepSec}s 后重试（${attempt}/${max}）..." >&2
    sleep "$sleepSec"
    attempt=$((attempt + 1))
  done
}

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "错误: $REPO_DIR 不是 Git 仓库" >&2
  exit 1
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  echo "错误: 未配置 origin 远端" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "错误: 工作区不干净（有未提交改动），为安全起见终止" >&2
  exit 1
fi

before="$(git rev-parse HEAD)"

retry "$RETRIES" "$RETRY_SLEEP_SEC" git fetch --prune origin
retry "$RETRIES" "$RETRY_SLEEP_SEC" git pull --ff-only

after="$(git rev-parse HEAD)"

if [[ "$before" != "$after" ]]; then
  echo "已更新: $before -> $after"
  if [[ -n "$POST_PULL_CMD" ]]; then
    bash -lc "$POST_PULL_CMD"
  fi
else
  echo "无更新"
fi
