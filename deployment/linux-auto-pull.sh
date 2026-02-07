#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${REPO_DIR:-}"
POST_PULL_CMD="${POST_PULL_CMD:-}"

usage() {
  cat <<'EOF'
用法:
  REPO_DIR=/path/to/repo POST_PULL_CMD="..." ./deployment/linux-auto-pull.sh
  ./deployment/linux-auto-pull.sh /path/to/repo

环境变量:
  REPO_DIR        仓库目录（可用第一个参数替代）
  POST_PULL_CMD   拉取成功且有更新后执行的命令（可选）

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

git fetch --prune origin
git pull --ff-only

after="$(git rev-parse HEAD)"

if [[ "$before" != "$after" ]]; then
  echo "已更新: $before -> $after"
  if [[ -n "$POST_PULL_CMD" ]]; then
    bash -lc "$POST_PULL_CMD"
  fi
else
  echo "无更新"
fi

