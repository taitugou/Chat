# TTG Chat

TTG Chat 是一个全栈社交聊天应用：前端使用 Vue + Vite，后端为 Node.js 服务，并包含多人房间与对局玩法模块。

## 文档

- 项目文档入口：[docs/README.md](./docs/README.md)
- OAuth 第三方登录集成：[OAUTH_INTEGRATION_GUIDE.md](./OAUTH_INTEGRATION_GUIDE.md)
- 部署与运维脚本说明：见 [deployment/](./deployment/)
- 源码导读（按主题拆分）：[yuanma/README.md](./yuanma/README.md)

## 快速开始（本地开发）

1. 安装依赖（根目录 + 前端 + 后端）：

```powershell
npm run install:all
```

2. 启动后端（新终端）：

```powershell
cd backend
npm run dev
```

3. 启动前端（新终端）：

```powershell
cd frontend
npm run dev
```

## 目录结构

```
.
├── frontend/          # 前端 Vue 应用（Vite）
├── backend/           # 后端 Node.js 服务
├── database/          # 数据库脚本与迁移
├── deployment/        # 部署/同步/运维脚本与文档
├── docs/              # 项目文档（推荐从 docs/README.md 开始）
└── nginx/             # Nginx 配置
```
