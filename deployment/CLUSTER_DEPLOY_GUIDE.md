
# 多服务器集群部署指南 (1.taitugou.top & 2.taitugou.top)

本指南介绍如何实现两个服务器节点（Node 1 和 Node 2）的自动对接与流量分流，确保两台服务器上的用户可以实时聊天。

## 架构方案

*   **节点 1 (`1.taitugou.top`)**: 运行主数据库 (MySQL)、缓存 (Redis) 以及后端服务。
*   **节点 2 (`2.taitugou.top`)**: 运行后端服务，通过内网/外网连接到节点 1 的 MySQL 和 Redis。
*   **消息同步**: 通过 Redis Adapter 实现两个节点之间的 Socket.IO 消息同步（已在代码中集成）。
*   **流量分流**: 使用 Nginx 的 `upstream` 模块进行负载均衡。

---

## 第一步：节点 1 (主节点) 配置

### 1. 开放远程访问
确保节点 1 的 MySQL 和 Redis 允许节点 2 连接。

*   **MySQL**: 
    ```sql
    -- 允许节点 2 的 IP 访问 (或 0.0.0.0 配合安全组限制)
    CREATE USER 'root'@'节点2_IP' IDENTIFIED BY '你的密码';
    GRANT ALL PRIVILEGES ON tai_chat.* TO 'root'@'节点2_IP';
    FLUSH PRIVILEGES;
    ```
*   **Redis**: 修改 `redis.conf`
    ```conf
    bind 0.0.0.0
    protected-mode no # 或者设置 requirepass
    ```

### 2. 启动服务
在节点 1 上正常启动后端：
```bash
# .env 配置
DB_HOST=localhost
REDIS_HOST=localhost
PORT=888
```

---

## 第二步：节点 2 (从节点) 配置

### 1. 修改环境变量
在节点 2 上，将数据库和 Redis 的地址指向节点 1 的公网 IP：

```ini
# .env 配置
DB_HOST=节点1_公网IP
DB_PORT=3306
DB_USER=root
DB_PASSWORD=你的密码

REDIS_HOST=节点1_公网IP
REDIS_PORT=6379

PORT=888
```

### 2. 启动服务
确保节点 2 的后端服务正常运行。由于代码中已集成 `redis-adapter`，只要连接到同一个 Redis，两个节点的聊天数据会自动同步。

---

## 第三步：Nginx 流量分流配置 (负载均衡)

你可以选择在节点 1 上安装一个总的 Nginx，或者使用第三方负载均衡。

### 1. 配置分流策略
在 Nginx 配置文件中添加：

```nginx
upstream ttg_cluster {
    # ip_hash 确保同一个用户的连接始终路由到同一台服务器 (对 WebSocket 很重要)
    ip_hash; 
    
    server 1.taitugou.top:888 weight=5; # 节点 1
    server 2.taitugou.top:888 weight=5; # 节点 2
}

server {
    listen 80;
    server_name www.taitugou.top; # 用户访问的总域名

    location /api/ {
        proxy_pass http://ttg_cluster;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /socket.io/ {
        proxy_pass http://ttg_cluster;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    location / {
        # 托管前端文件
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 第四步：自动对接验证

1.  **用户 A** 访问 `1.taitugou.top`。
2.  **用户 B** 访问 `2.taitugou.top`。
3.  **测试**: 用户 A 发送消息，用户 B 应该能实时收到。
4.  **分流**: 如果使用总域名访问，刷新页面，观察请求是否交替由两个节点处理。

## 关键技术点提示

1.  **Socket 同步**: 必须安装依赖 `npm install @socket.io/redis-adapter`。
2.  **文件上传同步**: 如果两个服务器独立运行，上传到节点 1 的图片在节点 2 可能无法显示。
    *   **推荐方案**: 使用阿里云 OSS、腾讯云 COS 等云存储。
    *   **临时方案**: 在 Nginx 配置中，将所有 `/uploads/` 的请求强行转发到其中一台固定服务器。
3.  **安全性**: 节点 1 的 3306 和 6379 端口务必在云服务器控制台配置“安全组/防火墙”，仅允许节点 2 的 IP 访问。
