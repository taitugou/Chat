# 阶段 1: 构建阶段
FROM node:18-alpine AS build-stage

WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm install

# 复制源代码
COPY . .

# 执行构建
RUN npm run build

# 阶段 2: 生产阶段
FROM nginx:stable-alpine

# 复制构建产物到 Nginx 目录
COPY --from=build-stage /app/dist /usr/share/nginx/html

# 复制 Nginx 配置
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
