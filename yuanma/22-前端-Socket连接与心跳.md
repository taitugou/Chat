# 前端：Socket 连接与心跳

客户端封装入口：[socket.ts](file:///f:/C/frontend/src/utils/socket.ts#L1-L125)

## 连接参数
- 服务端 URL：由 `resolveSocketServerUrl()` 从 `VITE_API_BASE_URL` 推导
  - 代码段：[socket.ts](file:///f:/C/frontend/src/utils/socket.ts#L11-L29)
- Socket.IO path：`VITE_SOCKET_IO_PATH || '/socket.io'`：[socket.ts](file:///f:/C/frontend/src/utils/socket.ts#L3-L5)
- 鉴权：`auth: { token }`：[socket.ts](file:///f:/C/frontend/src/utils/socket.ts#L86-L92)
- transport：仅 websocket：[socket.ts](file:///f:/C/frontend/src/utils/socket.ts#L91-L92)

## 在线状态与心跳策略
核心逻辑：`startActivityTracking()`：[socket.ts](file:///f:/C/frontend/src/utils/socket.ts#L31-L64)

- visibilitychange
  - 可见：emit `status:update({ status: 'online' })` 并立即补心跳
  - 不可见：emit `status:update({ status: 'offline' })`
  - 代码段：[socket.ts](file:///f:/C/frontend/src/utils/socket.ts#L35-L46)
- 定时心跳：每 10 秒（仅页面可见）emit `user:heartbeat({ active: true })`
  - 代码段：[socket.ts](file:///f:/C/frontend/src/utils/socket.ts#L50-L55)
- 初始上线：连接成功后，先 emit `user:online({ status })`，再视情况补心跳
  - 代码段：[socket.ts](file:///f:/C/frontend/src/utils/socket.ts#L57-L63)

## 错误处理与断开
- `connect_error`：若提示 token 过期/认证失败，会移除 `localStorage('token')`：[socket.ts](file:///f:/C/frontend/src/utils/socket.ts#L99-L105)
- `disconnect`：停止心跳与可见性监听：[socket.ts](file:///f:/C/frontend/src/utils/socket.ts#L107-L110)
- `disconnectSocket()`：主动断开并清理：[socket.ts](file:///f:/C/frontend/src/utils/socket.ts#L119-L125)

