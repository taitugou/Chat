CREATE TABLE IF NOT EXISTS oauth_clients (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    client_id VARCHAR(100) NOT NULL UNIQUE,
    client_secret VARCHAR(255) NOT NULL,
    client_name VARCHAR(100) NOT NULL,
    redirect_uris TEXT NOT NULL,
    redirect_blacklist TEXT DEFAULT NULL COMMENT '重定向地址黑名单，逗号分隔',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS oauth_codes (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(100) NOT NULL UNIQUE,
    client_id VARCHAR(100) NOT NULL,
    user_id BIGINT NOT NULL,
    redirect_uri TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入一个测试客户端
-- Client ID: test_client
-- Client Secret: test_secret
-- Redirect URI: http://localhost:3000/callback (可以根据实际需要修改)
INSERT INTO oauth_clients (client_id, client_secret, client_name, redirect_uris)
VALUES ('test_client', 'test_secret', '测试第三方应用', 'http://localhost:3000/callback,http://localhost:8888/oauth/callback')
ON DUPLICATE KEY UPDATE client_name = VALUES(client_name), redirect_uris = VALUES(redirect_uris);
