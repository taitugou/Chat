# 后端：Socket.IO 事件与在线状态

## Socket 入口与鉴权
- 入口挂载：`io.on('connection', ...)` 在 [server.js](file:///f:/C/backend/server.js#L89-L94)
- 鉴权中间件：[socketAuth.js](file:///f:/C/backend/middleware/socketAuth.js#L1-L51)
- 事件注册总入口：`initSocketHandlers(io, socket)` 在 [handlers.js](file:///f:/C/backend/socket/handlers.js)

## 主事件列表（handlers.js）
以 [handlers.js](file:///f:/C/backend/socket/handlers.js#L87-L710) 中 `socket.on(...)` 为准：

- 在线/活跃与状态
  - `user:heartbeat`：[handlers.js](file:///f:/C/backend/socket/handlers.js#L87-L92)
  - `user:online`：[handlers.js](file:///f:/C/backend/socket/handlers.js#L94-L228)
  - `status:update`：[handlers.js](file:///f:/C/backend/socket/handlers.js#L229-L285)
  - `disconnect`：[handlers.js](file:///f:/C/backend/socket/handlers.js#L286-L347)
  - `user:offline`：[handlers.js](file:///f:/C/backend/socket/handlers.js#L348-L401)
- 私聊/会话
  - `message:send`：[handlers.js](file:///f:/C/backend/socket/handlers.js#L402-L539)
  - `typing:start`：[handlers.js](file:///f:/C/backend/socket/handlers.js#L540-L562)
  - `typing:stop`：[handlers.js](file:///f:/C/backend/socket/handlers.js#L563-L586)
  - `chat:join`：[handlers.js](file:///f:/C/backend/socket/handlers.js#L587-L605)
  - `chat:leave`：[handlers.js](file:///f:/C/backend/socket/handlers.js#L606-L617)
- 匹配
  - `match:start`：[handlers.js](file:///f:/C/backend/socket/handlers.js#L618-L642)
- WebRTC 信令
  - `webrtc:signal`：[handlers.js](file:///f:/C/backend/socket/handlers.js#L643-L696)
  - `webrtc:call`：[handlers.js](file:///f:/C/backend/socket/handlers.js#L697-L746)

## 游戏房间事件（gameHandlers.js）
游戏相关单独收口在 [gameHandlers.js](file:///f:/C/backend/socket/gameHandlers.js#L87-L426)：

- `game:join_room`
- `game:leave_room`
- `game:player_ready`
- `game:start`
- `game:action`
- `game:loan`
- `game:chat`
- `game:voice_start`
- `game:voice_stop`

## 前端如何驱动在线状态
前端初始化 socket 后会做“可见性 + 心跳”同步：[socket.ts](file:///f:/C/frontend/src/utils/socket.ts#L31-L64)

- 首次连接成功：emit `user:online({ status })`：[socket.ts](file:///f:/C/frontend/src/utils/socket.ts#L57-L63)
- 页面可见性变化：emit `status:update({ status })` + 必要时补一个 `user:heartbeat`：[socket.ts](file:///f:/C/frontend/src/utils/socket.ts#L35-L46)
- 定时心跳：每 10s（页面可见时）emit `user:heartbeat({ active: true })`：[socket.ts](file:///f:/C/frontend/src/utils/socket.ts#L50-L55)

