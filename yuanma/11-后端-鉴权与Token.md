# 后端：鉴权与 Token（JWT）

## Token 的来源（签发）
主要都在 [routes/auth.js](file:///f:/C/backend/routes/auth.js#L1-L463)：

- 注册 `/api/auth/register`：校验字段 → 写 users → 生成 JWT（`expiresIn: config.jwt.expiresIn`）
  - 代码段：[auth.js](file:///f:/C/backend/routes/auth.js#L92-L193)
- 游客登录 `/api/auth/guest-login`：创建 `guest_*` 用户（`is_guest=true`）→ 生成 JWT（更长有效期）
  - 代码段：[auth.js](file:///f:/C/backend/routes/auth.js#L195-L250)
- 游客升级 `/api/auth/upgrade-guest`：需要先鉴权（说明游客也持 token）→ 更新资料与密码 → 重新签发 token
  - 代码段：[auth.js](file:///f:/C/backend/routes/auth.js#L252-L331)
- 登录 `/api/auth/login`：支持用户名/手机/邮箱 → bcrypt 校验 → rememberMe 决定 token 过期
  - 代码段：[auth.js](file:///f:/C/backend/routes/auth.js#L333-L463)

## REST 鉴权中间件：middleware/auth.js
入口：[authenticate](file:///f:/C/backend/middleware/auth.js#L6-L62)

- 取 token 的位置
  - Header：`Authorization: Bearer <token>`：[auth.js](file:///f:/C/backend/middleware/auth.js#L8-L14)
  - Query：`?token=...`：[auth.js](file:///f:/C/backend/middleware/auth.js#L14-L16)
- 校验过程
  - `jwt.verify(token, config.jwt.secret)`：[auth.js](file:///f:/C/backend/middleware/auth.js#L20-L22)
  - 查 users（存在性 + 状态 active）：[auth.js](file:///f:/C/backend/middleware/auth.js#L23-L37)
  - 查询角色并填充 `req.user`（含 `isAdmin`）：[auth.js](file:///f:/C/backend/middleware/auth.js#L38-L46)
- 典型失败返回
  - 401：未提供 token / token 过期 / token 无效 / 用户不存在
  - 403：账号冻结

可选鉴权：[optionalAuth](file:///f:/C/backend/middleware/auth.js#L64-L99)（没有 token 也放行，能解析就写 `req.user`）

## Socket.IO 鉴权中间件：middleware/socketAuth.js
入口：[socketAuth](file:///f:/C/backend/middleware/socketAuth.js#L1-L51)

- 取 token 的位置
  - `socket.handshake.auth.token`（前端传 `auth: { token }`）
  - `socket.handshake.headers.authorization`（Bearer，代码里直接 `substring(7)`）
- 校验过程：同 REST（verify → 查 users → status active）
- 赋值：`socket.userId/socket.username` 与 `socket.data.*`：[socketAuth.js](file:///f:/C/backend/middleware/socketAuth.js#L32-L36)

