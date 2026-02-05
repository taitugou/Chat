# 后端：数据库与 Redis 访问

## MySQL（mysql2/promise）
统一入口：[connection.js](file:///f:/C/backend/database/connection.js)

### 初始化与自检
- `initDatabase()`：创建连接池 → ping → `ensureDatabaseColumns()` 做字段/索引补齐
  - 入口代码：[connection.js](file:///f:/C/backend/database/connection.js#L6-L33)
  - 自检逻辑起点：[connection.js](file:///f:/C/backend/database/connection.js#L35-L116)

### 常用调用方式（代码里约定）
- 直接查询：`query(sql, params)`（该函数在同文件更靠后位置导出）
- 事务：`transaction(async (connection) => { ... })`
  - 示例：注册写用户用 transaction 包裹：[routes/auth.js](file:///f:/C/backend/routes/auth.js#L154-L163)

## Redis（ioredis）
统一入口：[redis.js](file:///f:/C/backend/database/redis.js#L1-L76)

- `initRedis()`：初始化全局 `redisClient`：[redis.js](file:///f:/C/backend/database/redis.js#L6-L27)
- `getRedisClient()`：取全局 client（未初始化会抛错）：[redis.js](file:///f:/C/backend/database/redis.js#L29-L34)
- `createRedisClient()`：创建独立 client（用于 Socket.IO adapter 的 pub/sub）：[redis.js](file:///f:/C/backend/database/redis.js#L36-L42)
- `redisUtils`：JSON 序列化的 get/set/del/exists/expire：[redis.js](file:///f:/C/backend/database/redis.js#L44-L76)

## Socket.IO Redis Adapter（多实例同步）
主服务启动时创建 pub/sub client，并把 adapter 挂到 io 上：[server.js](file:///f:/C/backend/server.js#L154-L158)

