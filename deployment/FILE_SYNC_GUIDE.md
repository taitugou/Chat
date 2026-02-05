
# 自动文件同步指南 (Syncthing & Lsyncd)

在多服务器集群中，确保用户上传的文件（如头像、帖子图片）在所有节点间实时一致至关重要。以下是两种常用方案的详细配置教程。

---

## 方案一：Syncthing (推荐：带界面，跨平台，双向同步)

Syncthing 是一个开源的实时同步工具，非常适合两台或多台服务器之间的文件对等同步。

### 1. 安装 (两台服务器都要做)
以 Ubuntu 为例：
```bash
sudo apt update
sudo apt install syncthing
```

### 2. 配置远程访问 GUI
默认情况下，Syncthing 的界面只能从本地访问。修改配置文件以允许从浏览器远程登录：
1. 运行一次 `syncthing` 产生配置文件，然后按 `Ctrl+C` 停止。
2. 编辑配置文件：`nano ~/.config/syncthing/config.xml`
3. 找到 `<address>127.0.0.1:8384</address>`，改为 `<address>0.0.0.0:8384</address>`。
4. 重新启动：`syncthing`

### 3. 在浏览器中对接
1. 打开 `http://服务器A_IP:8384`。
2. **获取 ID**: 点击“操作” -> “显示 ID”。
3. **添加设备**: 在服务器 B 的界面点击“添加远程设备”，输入服务器 A 的 ID。
4. **共享目录**: 
   - 在服务器 A 上点击“添加文件夹”。
   - 文件夹路径填写：`/你的项目路径/backend/uploads`。
   - 在“共享”选项卡中勾选“服务器 B”。
5. **确认**: 在服务器 B 的界面点击“接受”并设置对应的本地路径。

### 4. 设置开机自启
```bash
sudo systemctl enable syncthing@你的用户名.service
sudo systemctl start syncthing@你的用户名.service
```

---

## 方案二：Lsyncd (专业级：极速，单向/镜像同步)

Lsyncd 监控本地目录，一旦有变动就通过 rsync 增量同步到远程服务器。适合“主-从”架构。

### 1. 配置 SSH 免密登录 (在服务器 A 上)
Lsyncd 使用 SSH 同步，需要服务器 A 能免密登录服务器 B：
```bash
ssh-keygen -t rsa
ssh-copy-id root@服务器B_IP
```

### 2. 安装 Lsyncd (仅在服务器 A 上)
```bash
sudo apt update
sudo apt install lsyncd
```

### 3. 创建配置文件
创建 `/etc/lsyncd/lsyncd.conf.lua`:
```lua
settings {
    logfile = "/var/log/lsyncd/lsyncd.log",
    statusFile = "/var/log/lsyncd/lsyncd.status",
    inotifyMode = "CloseWrite",
    maxProcesses = 8,
}

sync {
    default.rsync,
    source = "/你的项目路径/backend/uploads/",
    target = "root@服务器B_IP:/你的项目路径/backend/uploads/",
    rsync = {
        binary = "/usr/bin/rsync",
        archive = true,
        compress = true,
        verbose = true
    }
}
```

### 4. 启动服务
```bash
sudo systemctl start lsyncd
sudo systemctl enable lsyncd
```

---

## 两种方案对比

| 特性 | Syncthing | Lsyncd |
| :--- | :--- | :--- |
| **同步方式** | 双向 (A 变 B 也变，B 变 A 也变) | 单向 (通常 A 镜像到 B) |
| **配置难度** | 简单 (有图形界面) | 中等 (需配置 Lua 脚本) |
| **资源占用** | 稍高 (运行 Go 运行时) | 极低 (轻量级守护进程) |
| **适用场景** | 几台服务器互相同步 | 大规模集群、备份服务器 |

### 针对你的项目建议：
- 如果你希望 `1.taitugou.top` 和 `2.taitugou.top` **地位平等**，两边都可以上传文件，请使用 **Syncthing**。
- 如果你设置 `1.taitugou.top` 为**主服务器**（所有上传都先经过它），请使用 **Lsyncd**。

**注意**: 无论使用哪种同步，都要确保服务器防火墙开放了对应的端口（Syncthing 默认 22000/TCP，Lsyncd 走 22/SSH）。
