# TTG Chat 第三方登录集成指南

本系统支持标准的 OAuth 2.0 授权码模式 (Authorization Code Grant)，允许第三方网站获取本系统用户的基本资料进行登录。

## 1. 获取客户端凭证

在集成前，您需要联系管理员或在管理后台创建一个 OAuth 应用，获取以下信息：
- **Client ID**: 应用唯一标识
- **Client Secret**: 应用密钥 (请务必保密)
- **Redirect URIs**: 授权成功后的回调地址

**测试凭证 (仅用于本地开发)：**
- **Client ID**: `test_client`
- **Client Secret**: `test_secret`
- **Redirect URIs**: `http://taitugou.icu:3000/callback`

## 2. 授权流程说明

### 第一步：引导用户跳转至授权页

当用户点击“使用 TTG 账号登录”时，您的网站应将用户重定向至本系统的授权地址：

```
GET http://taitugou.icu:8888/oauth/authorize?client_id=YOUR_CLIENT_ID&redirect_uri=YOUR_REDIRECT_URI&response_type=code&scope=userinfo&state=YOUR_STATE
```

**参数说明：**
- `client_id`: 必填，您的 Client ID。
- `redirect_uri`: 必填，您的回调地址，必须与在后台配置的一致。
- `response_type`: 必填，固定值为 `code`。
- `scope`: 可选，目前支持 `userinfo`（获取用户基本资料）。
- `state`: 可选，由您的网站生成的随机字符串，用于防止 CSRF 攻击，授权成功后会原样带回。

### 第二步：获取授权码 (Authorization Code)

用户同意授权后，本系统会重定向回您的 `redirect_uri`，并带上 `code` 参数：

```
http://YOUR_REDIRECT_URI?code=AUTHORIZATION_CODE&state=YOUR_STATE
```

### 第三步：使用授权码换取 Access Token

您的**后端服务器**需要发起一个 POST 请求来换取 Access Token：

```bash
POST http://taitugou.icu:888/api/oauth/token
Content-Type: application/json

{
  "client_id": "YOUR_CLIENT_ID",
  "client_secret": "YOUR_CLIENT_SECRET",
  "code": "AUTHORIZATION_CODE",
  "redirect_uri": "YOUR_REDIRECT_URI",
  "grant_type": "authorization_code"
}
```

**响应示例：**
```json
{
  "access_token": "eyJhbG...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

### 第四步：获取用户信息

使用获取到的 `access_token` 调用用户信息接口：

```bash
GET http://taitugou.icu:888/api/oauth/userinfo
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**响应示例：**
```json
{
  "sub": 1,
  "name": "管理员",
  "preferred_username": "admin",
  "email": "admin@ttgchat.com",
  "phone_number": "13800000000",
  "picture": "/uploads/avatars/default.png",
  "bio": "这是用户简介"
}
```

## 3. 常见错误码

在调用接口时，如果发生错误，系统会返回相应的 HTTP 状态码及错误信息：

| HTTP 状态码 | 错误信息 | 说明 |
| :--- | :--- | :--- |
| 400 | `无效的重定向 URI` | `redirect_uri` 与注册时不一致 |
| 400 | `不支持的 grant_type` | `grant_type` 必须为 `authorization_code` |
| 400 | `无效的授权码` / `授权码已过期` | 授权码错误或已过有效期（10分钟） |
| 401 | `客户端认证失败` | `client_id` 或 `client_secret` 错误 |
| 401 | `未提供认证令牌` / `无效的令牌` | Access Token 缺失、错误 or 已过期 |
| 404 | `客户端不存在` | 找不到对应的 `client_id` |

## 4. 安全建议

1. **Client Secret 严禁泄露**：不要在前端代码中存储或使用 Client Secret。
2. **校验 State 参数**：在回调处理中校验 `state` 参数，确保请求是由您的网站发起的。
3. **HTTPS**：在生产环境中，所有通信必须通过 HTTPS 进行。

---
*注：本地开发环境下，后端地址通常为 `http://taitugou.icu:888`，前端地址为 `http://taitugou.icu:8888`。*
