# 前端：鉴权状态与 API 封装

## 鉴权状态（Pinia Store）
入口：[auth.ts](file:///f:/C/frontend/src/stores/auth.ts#L15-L163)

- token 存储：`localStorage('token')` → `token` ref：[auth.ts](file:///f:/C/frontend/src/stores/auth.ts#L16-L21)
- 登录/注册/游客/升级游客：成功后写入 token，并初始化 Socket：[auth.ts](file:///f:/C/frontend/src/stores/auth.ts#L32-L112)
- 初始化拉取
  - `fetchUserInfo()`：`GET /auth/me`：[auth.ts](file:///f:/C/frontend/src/stores/auth.ts#L114-L128)
  - `fetchUserSettings()`：`GET /settings/user`（读取默认落地页）：[auth.ts](file:///f:/C/frontend/src/stores/auth.ts#L130-L138)
- 管理员判断：`user.id === 1` 或 roles 中包含 `admin/super_admin`：[auth.ts](file:///f:/C/frontend/src/stores/auth.ts#L22-L30)
- 退出：清 token + 断开 Socket：[auth.ts](file:///f:/C/frontend/src/stores/auth.ts#L140-L146)

## API 封装（axios 实例）
入口：[api.ts](file:///f:/C/frontend/src/utils/api.ts#L1-L68)

- baseURL：`VITE_API_BASE_URL || '/api'`：[api.ts](file:///f:/C/frontend/src/utils/api.ts#L3-L9)
- 请求拦截器：自动加 `Authorization: Bearer <token>`：[api.ts](file:///f:/C/frontend/src/utils/api.ts#L13-L22)
- 响应拦截器
  - 房间残留状态自愈：400 且 message=“已在房间中”且当前不在房间页 → `POST /rooms/leave-all` 后重试原请求：[api.ts](file:///f:/C/frontend/src/utils/api.ts#L36-L54)
  - 401：移除 token，并跳转 `/login?redirect=...`：[api.ts](file:///f:/C/frontend/src/utils/api.ts#L56-L65)

