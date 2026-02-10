# Linux 服务器运维命令手册

本文档汇总了 TTG Chat 在 Linux 生产环境下的常用运维命令，包含后端 (PM2)、数据库 (Redis/MySQL) 和 Web 服务器 (Nginx) 的管理。

## 1. 后端服务 (Node.js API)

我们使用 **PM2** 进程管理器来运行后端服务。

| 动作 | 命令 | 说明 |
| :--- | :--- | :--- |
| **启动** | `pm2 start server.js --name "ttg-backend"` | 首次启动（在 `backend` 目录下） |
| **重启** | `pm2 restart ttg-backend` | **最常用**。更新代码或修改配置后执行 |
| **停止** | `pm2 stop ttg-backend` | 暂停服务 |
| **查看状态** | `pm2 list` | 查看所有进程状态、内存占用 |
| **查看日志** | `pm2 logs ttg-backend` | 实时查看运行日志 (Ctrl+C 退出) |
| **查看详情** | `pm2 show ttg-backend` | 查看路径、运行时间、重启次数等 |
| **监控面板** | `pm2 monit` | 图形化查看 CPU/内存使用情况 |

> **提示**: 如果修改了 `.env` 配置文件，必须执行 `pm2 restart ttg-backend` 才会生效。

---

## 2. 基础服务 (Redis & Nginx)

这些服务通常使用 Linux 的 `systemd` (systemctl) 管理。

### Redis (缓存与消息队列)

| 动作 | 命令 |
| :--- | :--- |
| **检查状态** | `sudo systemctl status redis-server` |
| **启动** | `sudo systemctl start redis-server` |
| **停止** | `sudo systemctl stop redis-server` |
| **重启** | `sudo systemctl restart redis-server` |
| **开机自启** | `sudo systemctl enable redis-server` |

### Nginx (前端静态托管 & 反向代理)

| 动作 | 命令 |
| :--- | :--- |
| **检查状态** | `sudo systemctl status nginx` |
| **测试配置** | `sudo nginx -t` (修改配置后必做) |
| **重启** | `sudo systemctl reload nginx` (推荐，平滑重启) |
| **强制重启** | `sudo systemctl restart nginx` |

---

## 3. 代码更新流程 (标准发布)

当你从本地推送到 GitHub/GitLab 后，在服务器上执行以下步骤更新：

```bash
# 1. 进入项目目录
cd /path/to/ttg-chat

# 2. 拉取最新代码
git pull

# 3. (可选) 如果更新了依赖包
cd backend
npm install --production

# 4. 重启后端生效
pm2 restart ttg-backend

# 5. 检查日志确认无误
pm2 logs ttg-backend --lines 20 --nostream
```

## 4. 故障排查速查

- **后端连不上数据库?**
  - 检查配置: `cat backend/.env`
  - 检查 MySQL: `sudo systemctl status mysql`
  - 检查 Redis: `sudo systemctl status redis-server`

- **HTTPS 证书过期?**
  - 如果使用 Let's Encrypt: `certbot renew`
  - 如果是手动上传: 替换 `/etc/ssl/taitugou.top/` 下的文件后，执行 `pm2 restart ttg-backend`

- **端口被占用?**
  - 查看 888 端口占用: `sudo lsof -i :888`
  - 杀掉占用进程: `sudo kill -9 <PID>`
