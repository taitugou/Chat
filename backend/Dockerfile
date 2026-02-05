FROM node:18-alpine

WORKDIR /app

# 安装必要的构建工具（如果某些依赖需要编译）
RUN apk add --no-cache python3 make g++

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm install --production

# 复制源代码
COPY . .

# 创建上传目录
RUN mkdir -p uploads

# 暴露端口（根据 config.js 默认为 888）
EXPOSE 888

# 启动命令
CMD ["node", "server.js"]
