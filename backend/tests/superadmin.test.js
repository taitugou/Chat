import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { adminApp } from '../admin-server.js';
import { query } from '../database/connection.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

describe('SuperAdmin API Tests', () => {
  let superAdminToken;
  let adminToken;
  let userToken;
  let testUserId;
  let testPostId;

  // 设置测试数据
  beforeAll(async () => {
    // 创建超级管理员
    const hashedPassword = await bcrypt.hash('superadmin123', 10);
    const [superAdminResult] = await query(
      `INSERT INTO users (username, nickname, email, password_hash, status) 
       VALUES ('superadmin_test', 'Super Admin', 'superadmin@test.com', ?, 'active')
       ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
      [hashedPassword]
    );
    const superAdminId = superAdminResult.insertId;

    // 分配超级管理员角色
    const [roleResult] = await query('SELECT id FROM roles WHERE name = ?', ['super_admin']);
    if (roleResult && roleResult[0]) {
      await query(
        `INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE user_id=user_id`,
        [superAdminId, roleResult[0].id]
      );
    }

    // 创建普通管理员
    const [adminResult] = await query(
      `INSERT INTO users (username, nickname, email, password_hash, status) 
       VALUES ('admin_test', 'Admin', 'admin@test.com', ?, 'active')
       ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
      [hashedPassword]
    );
    const adminId = adminResult.insertId;

    // 分配管理员角色
    const [adminRoleResult] = await query('SELECT id FROM roles WHERE name = ?', ['admin']);
    if (adminRoleResult && adminRoleResult[0]) {
      await query(
        `INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE user_id=user_id`,
        [adminId, adminRoleResult[0].id]
      );
    }

    // 创建测试用户
    const [userResult] = await query(
      `INSERT INTO users (username, nickname, email, password_hash, status) 
       VALUES ('testuser', 'Test User', 'test@test.com', ?, 'active')
       ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
      [hashedPassword]
    );
    testUserId = userResult.insertId;

    // 创建测试帖子
    const [postResult] = await query(
      `INSERT INTO posts (user_id, content, status) VALUES (?, ?, 'active')
       ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
      [testUserId, 'Test post content']
    );
    testPostId = postResult.insertId;

    // 生成token
    superAdminToken = jwt.sign(
      { id: superAdminId, username: 'superadmin_test', role: 'super_admin' },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    adminToken = jwt.sign(
      { id: adminId, username: 'admin_test', role: 'admin' },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    userToken = jwt.sign(
      { id: testUserId, username: 'testuser', role: 'user' },
      config.jwt.secret,
      { expiresIn: '1h' }
    );
  });

  // 清理测试数据
  afterAll(async () => {
    await query('DELETE FROM posts WHERE id = ?', [testPostId]);
    await query('DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE username LIKE ?)', ['%_test%']);
    await query('DELETE FROM users WHERE username LIKE ?', ['%_test%']);
  });

  describe('Authentication & Authorization', () => {
    it('should allow superadmin to access admin routes', async () => {
      const res = await request(adminApp)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${superAdminToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('stats');
    });

    it('should allow admin to access admin routes', async () => {
      const res = await request(adminApp)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(res.status).toBe(200);
    });

    it('should deny regular user access to admin routes', async () => {
      const res = await request(adminApp)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(res.status).toBe(403);
    });
  });

  describe('User Management', () => {
    it('should get users list', async () => {
      const res = await request(adminApp)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${superAdminToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('users');
      expect(Array.isArray(res.body.users)).toBe(true);
    });

    it('should get user details', async () => {
      const res = await request(adminApp)
        .get(`/api/admin/users/${testUserId}`)
        .set('Authorization', `Bearer ${superAdminToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('user');
    });

    it('should update user status', async () => {
      const res = await request(adminApp)
        .put(`/api/admin/users/${testUserId}/status`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ status: 'frozen' });
      
      expect(res.status).toBe(200);
    });

    it('should toggle user visibility', async () => {
      const res = await request(adminApp)
        .put(`/api/admin/users/${testUserId}/visibility`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ is_visible: false });
      
      expect(res.status).toBe(200);
    });
  });

  describe('Post Management', () => {
    it('should get posts list', async () => {
      const res = await request(adminApp)
        .get('/api/admin/posts')
        .set('Authorization', `Bearer ${superAdminToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('posts');
    });

    it('should toggle post visibility', async () => {
      const res = await request(adminApp)
        .put(`/api/admin/posts/${testPostId}/visibility`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ is_visible: false });
      
      expect(res.status).toBe(200);
    });

    it('should delete post (soft)', async () => {
      const res = await request(adminApp)
        .delete(`/api/admin/posts/${testPostId}`)
        .set('Authorization', `Bearer ${superAdminToken}`);
      
      expect(res.status).toBe(200);
    });
  });

  describe('Batch Operations', () => {
    it('should deny batch operations to non-superadmin', async () => {
      const res = await request(adminApp)
        .post('/api/admin/batch/users/hide-all')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(res.status).toBe(403);
    });

    it('should allow batch hide all users to superadmin', async () => {
      const res = await request(adminApp)
        .post('/api/admin/batch/users/hide-all')
        .set('Authorization', `Bearer ${superAdminToken}`);
      
      expect(res.status).toBe(200);
    });

    it('should allow batch show all users to superadmin', async () => {
      const res = await request(adminApp)
        .post('/api/admin/batch/users/show-all')
        .set('Authorization', `Bearer ${superAdminToken}`);
      
      expect(res.status).toBe(200);
    });
  });

  describe('Stats & Monitoring', () => {
    it('should get system stats', async () => {
      const res = await request(adminApp)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${superAdminToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('stats');
      expect(res.body.stats).toHaveProperty('total_users');
    });

    it('should get online users', async () => {
      const res = await request(adminApp)
        .get('/api/admin/monitoring/online-users')
        .set('Authorization', `Bearer ${superAdminToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('details');
    });
  });

  describe('Logs', () => {
    it('should get operation logs', async () => {
      const res = await request(adminApp)
        .get('/api/admin/logs/operation')
        .set('Authorization', `Bearer ${superAdminToken}`);
      
      expect(res.status).toBe(200);
    });

    it('should get system logs', async () => {
      const res = await request(adminApp)
        .get('/api/admin/logs/system')
        .set('Authorization', `Bearer ${superAdminToken}`);
      
      expect(res.status).toBe(200);
    });
  });
});
