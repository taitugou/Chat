
# 双服务器部署指南 (Frontend + Backend 分离)

本指南将指导你如何将 TTG Chat 部署到两台服务器上：
- **服务器 A (前端)**: 运行 Nginx，托管静态网页。
- **服务器 B (后端)**: 运行 Node.js 应用和 MySQL 数据库。

## 前置准备

1.  **两台服务器**: 确保它们之间网络互通。
    - 记下 **服务器 B (后端)** 的公网 IP 地址 (例如: `192.168.1.200`)。
2.  **域名 (可选)**: 如果有域名，解析到 **服务器 A (前端)** 的 IP。

---

## 第一步：部署后端 (服务器 B)

**目标**: 安装 Node.js、MySQL，运行后端 API 服务。

### 1. 环境安装
在服务器 B 上安装 Node.js (推荐 v18+) 和 MySQL (8.0+)。

```bash
# Ubuntu 示例
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs mysql-server
sudo npm install -g pm2
```

### 2. 数据库配置
1.  登录 MySQL: `mysql -u root -p`
2.  创建数据库并导入数据:
    ```sql
    CREATE DATABASE tai_chat;
    USE tai_chat;
    SOURCE /path/to/your/backend/database/init.sql;
    -- 依次导入其他 SQL 文件 (migrations 目录下的文件)
    ```
    *(提示: 也可以使用 Navicat 等工具远程连接导入)*

3.  **允许远程连接 (如果需要)**:
    如果数据库仅供本地后端使用，保持默认即可。

### 3. 部署代码
1.  将 `backend` 文件夹上传到服务器 B (例如 `/app/backend`)。
2.  进入目录并安装依赖:
    ```bash
    cd /app/backend
    npm install
    ```

### 4. 配置环境变量
复制 `.env.example` (如果没有则参考 `config.js`) 为 `.env`，并修改配置：

```ini
# backend/.env
PORT=888
HOST=0.0.0.0            # 必须设置为 0.0.0.0 以允许外部访问

# 数据库配置
DB_HOST=localhost       # 因为数据库也在服务器 B
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=tai_chat

# CORS 设置 (重要)
# 设置为服务器 A (前端) 的访问地址，例如 http://192.168.1.100 或 http://your-domain.com
# 如果不设置，前端可能会遇到跨域错误
CORS_ORIGIN=http://服务器A_IP_或域名

# Redis (如果有)
REDIS_HOST=localhost
```

### 5. 启动后端
使用 PM2 启动服务：
```bash
pm2 start server.js --name "ttg-backend"
pm2 save
pm2 startup
```

### 6. 开放端口
确保服务器 B 的防火墙允许 **888** 端口的 TCP 流量，以便服务器 A 可以连接。
```bash
# Ubuntu ufw 示例
sudo ufw allow 888/tcp
```

---

## 第二步：部署前端 (服务器 A)

**目标**: 编译 Vue 项目，配置 Nginx 反向代理。

### 1. 本地构建前端
在你的开发机上（不是服务器），运行构建命令：

```bash
cd frontend
npm run build
```
这将生成一个 `dist` 文件夹，包含所有静态文件。

### 2. 上传文件
将生成的 `dist` 文件夹上传到服务器 A (例如 `/usr/share/nginx/html`)。

### 3. 安装 Nginx
在服务器 A 上安装 Nginx。

```bash
# Ubuntu 示例
sudo apt-get update
sudo apt-get install -y nginx
```

### 4. 配置 Nginx
1.  找到本项目提供的配置文件 `deployment/nginx-frontend.conf`。
2.  修改文件中的 `BACKEND_SERVER_IP` 为 **服务器 B 的 IP 地址**。
3.  将修改后的内容覆盖服务器 A 的 `/etc/nginx/nginx.conf` (或者放在 `/etc/nginx/conf.d/ttg.conf` 并确保主配置包含它)。

**关键配置修改点**:
```nginx
upstream backend_server {
    server 192.168.1.200:888;  # 替换为服务器 B 的实际 IP
}
```

### 5. 启动 Nginx
```bash
sudo nginx -t   # 测试配置是否正确
sudo systemctl restart nginx
```

### 6. 开放端口
确保服务器 A 的防火墙允许 **80** (HTTP) 和 **443** (HTTPS) 端口。

---

## 第三步：验证

1.  打开浏览器，访问 **服务器 A 的 IP 地址** (或域名)。
2.  你应该能看到登录页面。
3.  尝试登录/注册，如果成功，说明 API 代理配置正确。
4.  上传一张头像或图片，检查是否能正常显示，验证 `/uploads/` 代理是否生效。
5.  检查 WebSocket 连接 (F12 -> Network -> WS)，确保聊天功能正常。

## 常见问题排查

-   **API 请求 502 Bad Gateway**:
    -   检查服务器 B 的后端服务是否运行 (`pm2 status`)。
    -   检查服务器 B 的防火墙是否开放了 888 端口。
    -   在服务器 A 上尝试 `curl http://服务器B_IP:888/api/health` (如果有健康检查接口) 或 `telnet 服务器B_IP 888` 测试连通性。

-   **WebSocket 连接失败**:
    -   确保 Nginx 配置中包含了 `Upgrade` 和 `Connection "upgrade"` 头。
    -   确保 Socket.IO 路径配置正确 (默认为 `/socket.io/`)。

-   **图片无法显示 (404)**:
    -   检查服务器 B 上 `backend/uploads` 目录是否存在且有权限。
    -   确认 Nginx 正确代理了 `/uploads/` 请求到服务器 B。
