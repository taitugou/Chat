# 后端：REST API 路由地图

路由挂载集中在 [server.js](file:///f:/C/backend/server.js#L66-L88)。

## 挂载表
- `/api/auth` → [routes/auth.js](file:///f:/C/backend/routes/auth.js)
- `/api/rooms` → [routes/rooms.js](file:///f:/C/backend/routes/rooms.js)（以 `roomRoutes(io)` 形式注入 io）
- `/api/chips` → [routes/chips.js](file:///f:/C/backend/routes/chips.js)
- `/api/games` → [routes/games.js](file:///f:/C/backend/routes/games.js)
- `/api/online` → [routes/online.js](file:///f:/C/backend/routes/online.js)
- `/api/user` → [routes/user.js](file:///f:/C/backend/routes/user.js)
- `/api/topics` → [routes/topic.js](file:///f:/C/backend/routes/topic.js)
- `/api/posts` → [routes/post.js](file:///f:/C/backend/routes/post.js)
- `/api/notification` → [routes/notification.js](file:///f:/C/backend/routes/notification.js)
- `/api/settings` → [routes/settings.js](file:///f:/C/backend/routes/settings.js)
- `/api/points` → [routes/points.js](file:///f:/C/backend/routes/points.js)
- `/api/mention` → [routes/mention.js](file:///f:/C/backend/routes/mention.js)
- `/api/chat` → [routes/chat.js](file:///f:/C/backend/routes/chat.js)
- `/api/tasks` → [routes/task.js](file:///f:/C/backend/routes/task.js)
- `/api/search` → [routes/search.js](file:///f:/C/backend/routes/search.js)
- `/api/oauth` → [routes/oauth.js](file:///f:/C/backend/routes/oauth.js)
- `/api/guestbook` → [routes/guestbook.js](file:///f:/C/backend/routes/guestbook.js)
- `/api/groups` → [routes/group.js](file:///f:/C/backend/routes/group.js)
- `/api/match` → [routes/match.js](file:///f:/C/backend/routes/match.js)
- `/api/loans` → [routes/loans.js](file:///f:/C/backend/routes/loans.js)
- `/api/admin` → [routes/adminEnhanced.js](file:///f:/C/backend/routes/adminEnhanced.js)

## 查路由的最省事方式
- 先看：入口挂载点 [server.js](file:///f:/C/backend/server.js#L66-L88)（确认 basePath）
- 再跳：对应 `backend/routes/*.js` 文件里具体 `router.get/post/...`（确认子路径与鉴权中间件）
- 如果路由里用了 `req.io` / `io`：说明会和 Socket 实时通知联动（典型是 rooms/chat/notification 等）

