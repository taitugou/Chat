# TTG Chat API 文档

## 基础信息

- **Base URL**: `https://taitugou.top:888/api`
- **认证方式**: Bearer Token (JWT)
- **请求格式**: JSON
- **响应格式**: JSON

## 认证接口

### 用户注册

```
POST /api/auth/register
```

**请求体**:
```json
{
  "username": "testuser",
  "nickname": "测试用户",
  "phone": "13800138000",
  "email": "test@example.com",
  "password": "password123",
  "interestTags": ["音乐", "电影"]
}
```

**响应**:
```json
{
  "message": "注册成功",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "testuser",
    "nickname": "测试用户",
    "avatar": "T"
  }
}
```

### 用户登录

```
POST /api/auth/login
```

**请求体**:
```json
{
  "account": "testuser",
  "password": "password123",
  "rememberMe": false
}
```

**响应**:
```json
{
  "message": "登录成功",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "7d",
  "user": {
    "id": 1,
    "username": "testuser",
    "nickname": "测试用户",
    "avatar": "T",
    "vipLevel": "none"
  }
}
```

### 获取当前用户信息

```
GET /api/auth/me
```

**请求头**:
```
Authorization: Bearer <token>
```

**响应**:
```json
{
  "user": {
    "id": 1,
    "username": "testuser",
    "nickname": "测试用户",
    "email": "test@example.com",
    "phone": "13800138000",
    "vipLevel": "none",
    "vipExpireAt": null
  }
}
```

## 用户接口

### 获取用户资料

```
GET /api/user/:id
```

**响应**:
```json
{
  "user": {
    "id": 1,
    "username": "testuser",
    "nickname": "测试用户",
    "avatar": "/uploads/avatars/1_xxx.jpg",
    "gender": "male",
    "location": "北京",
    "bio": "个性签名",
    "interestTags": ["音乐", "电影"]
  },
  "stats": {
    "post_count": 10,
    "friend_count": 5,
    "like_count": 20
  }
}
```

### 更新用户资料

```
PUT /api/user/profile
```

**请求头**:
```
Authorization: Bearer <token>
```

**请求体**:
```json
{
  "nickname": "新昵称",
  "bio": "新个性签名",
  "gender": "female",
  "location": "上海",
  "interestTags": ["音乐", "旅行"]
}
```

### 上传头像

```
POST /api/user/avatar
```

**请求头**:
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**请求体**: FormData
- `avatar`: 图片文件

## 帖子接口

### 发布帖子

```
POST /api/post
```

**请求头**:
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**请求体**: FormData
- `content`: 帖子内容
- `tags`: 标签（JSON字符串或数组）
- `visibility`: 可见性（public/friends/private）
- `media`: 媒体文件（可选，最多9个）

### 获取帖子列表

```
GET /api/post/timeline?page=1&limit=20
```

**响应**:
```json
{
  "posts": [
    {
      "id": 1,
      "content": "帖子内容",
      "images": ["/uploads/posts/xxx.jpg"],
      "user_id": 1,
      "nickname": "测试用户",
      "avatar": "/uploads/avatars/xxx.jpg",
      "like_count": 10,
      "comment_count": 5,
      "isLiked": false,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "page": 1,
  "limit": 20
}
```

### 点赞帖子

```
POST /api/post/:id/like
```

**请求头**:
```
Authorization: Bearer <token>
```

**响应**:
```json
{
  "message": "点赞成功",
  "liked": true
}
```

### 评论帖子

```
POST /api/post/:id/comment
```

**请求头**:
```
Authorization: Bearer <token>
```

**请求体**:
```json
{
  "content": "评论内容",
  "parentId": null
}
```

## 聊天接口

### 获取会话列表

```
GET /api/chat/conversations
```

**请求头**:
```
Authorization: Bearer <token>
```

**响应**:
```json
{
  "conversations": [
    {
      "other_user_id": 2,
      "last_message": "最后一条消息",
      "last_message_time": "2024-01-01T00:00:00Z",
      "unread_count": 2,
      "user": {
        "id": 2,
        "nickname": "对方用户",
        "avatar": "/uploads/avatars/xxx.jpg"
      }
    }
  ]
}
```

### 获取聊天记录

```
GET /api/chat/messages/:userId?page=1&limit=50
```

**请求头**:
```
Authorization: Bearer <token>
```

## 匹配接口

### 开始匹配

```
POST /api/match/start
```

**请求头**:
```
Authorization: Bearer <token>
```

**请求体**:
```json
{
  "ageRange": [20, 30],
  "gender": "female",
  "location": "北京"
}
```

### 获取匹配结果

```
GET /api/match/result
```

**请求头**:
```
Authorization: Bearer <token>
```

**响应**:
```json
{
  "matched": true,
  "user": {
    "id": 2,
    "nickname": "匹配用户",
    "avatar": "/uploads/avatars/xxx.jpg"
  }
}
```

## VIP接口

### 获取VIP信息

```
GET /api/vip/info
```

**请求头**:
```
Authorization: Bearer <token>
```

### 兑换VIP

```
POST /api/vip/redeem
```

**请求头**:
```
Authorization: Bearer <token>
```

**请求体**:
```json
{
  "code": "TTG-XXXX-XXXX-XXXX"
}
```

### 签到

```
POST /api/vip/checkin
```

**请求头**:
```
Authorization: Bearer <token>
```

## 管理员接口

### 生成VIP兑换码

```
POST /api/admin/vip-codes/generate
```

**请求头**:
```
Authorization: Bearer <token>
```

**请求体**:
```json
{
  "level": "vip",
  "duration": "1m",
  "count": 10
}
```

### 获取用户列表

```
GET /api/admin/users?page=1&limit=20&search=&status=all&vipLevel=all
```

**请求头**:
```
Authorization: Bearer <token>
```

## Socket.IO事件

### 客户端发送事件

- `user:online` - 用户上线
- `message:send` - 发送消息
- `typing:start` - 开始输入
- `typing:stop` - 停止输入
- `match:start` - 开始匹配

### 服务器发送事件

- `message:receive` - 接收消息
- `message:sent` - 消息发送成功
- `typing:start` - 对方正在输入
- `typing:stop` - 对方停止输入
- `match:success` - 匹配成功
- `match:failed` - 匹配失败
- `friend:online` - 好友上线
- `friend:offline` - 好友下线

## 错误码

- `400` - 请求参数错误
- `401` - 未认证
- `403` - 无权限
- `404` - 资源不存在
- `409` - 资源冲突
- `429` - 请求过于频繁
- `500` - 服务器错误

## 错误响应格式

```json
{
  "error": "错误信息",
  "details": {}
}
```

