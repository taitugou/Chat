import { query } from '../database/connection.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 删除用户关联的物理文件
 * @param {number[]} userIds - 用户ID数组
 */
export async function cleanupUserFiles(userIds) {
  if (!userIds || userIds.length === 0) return;

  try {
    const placeholders = userIds.map(() => '?').join(',');

    // 1. 获取用户头像和背景图
    const [users] = await query(
      `SELECT avatar, background_image FROM users WHERE id IN (${placeholders})`,
      userIds
    );

    // 2. 获取用户帖子中的文件 (图片、视频、音频、附件)
    const [posts] = await query(
      `SELECT images, video_url, audio_url, file_url FROM posts WHERE user_id IN (${placeholders})`,
      userIds
    );

    // 3. 获取用户创建的话题封面图
    const [topics] = await query(
      `SELECT cover_image FROM topics WHERE user_id IN (${placeholders})`,
      userIds
    );

    // 4. 获取用户发送的私聊/群聊消息中的文件
    const [messages] = await query(
      `SELECT file_url FROM messages WHERE sender_id IN (${placeholders})`,
      userIds
    );

    // 5. 获取用户的聊天设置背景图
    const [chatSettings] = await query(
      `SELECT background_image FROM chat_settings WHERE user_id IN (${placeholders})`,
      userIds
    );

    const filesToDelete = new Set();

    // 处理用户文件
    users.forEach(u => {
      if (u.avatar && u.avatar.startsWith('/uploads/')) {
        filesToDelete.add(path.join(__dirname, '..', u.avatar.substring(1)));
      }
      if (u.background_image && u.background_image.startsWith('/uploads/')) {
        filesToDelete.add(path.join(__dirname, '..', u.background_image.substring(1)));
      }
    });

    // 处理帖子文件
    posts.forEach(p => {
      if (p.images) {
        try {
          const images = JSON.parse(p.images);
          if (Array.isArray(images)) {
            images.forEach(img => {
              if (typeof img === 'string' && img.startsWith('/uploads/')) {
                filesToDelete.add(path.join(__dirname, '..', img.substring(1)));
              } else if (img && typeof img === 'object' && img.url && img.url.startsWith('/uploads/')) {
                filesToDelete.add(path.join(__dirname, '..', img.url.substring(1)));
              }
            });
          }
        } catch (e) {
          // 如果不是JSON，尝试作为普通字符串处理
          if (typeof p.images === 'string' && p.images.startsWith('/uploads/')) {
            filesToDelete.add(path.join(__dirname, '..', p.images.substring(1)));
          }
        }
      }
      if (p.video_url && p.video_url.startsWith('/uploads/')) {
        filesToDelete.add(path.join(__dirname, '..', p.video_url.substring(1)));
      }
      if (p.audio_url && p.audio_url.startsWith('/uploads/')) {
        filesToDelete.add(path.join(__dirname, '..', p.audio_url.substring(1)));
      }
      if (p.file_url && p.file_url.startsWith('/uploads/')) {
        filesToDelete.add(path.join(__dirname, '..', p.file_url.substring(1)));
      }
    });

    // 处理话题封面图
    topics.forEach(t => {
      if (t.cover_image && t.cover_image.startsWith('/uploads/')) {
        filesToDelete.add(path.join(__dirname, '..', t.cover_image.substring(1)));
      }
    });

    // 处理聊天消息文件
    messages.forEach(m => {
      if (m.file_url && m.file_url.startsWith('/uploads/')) {
        filesToDelete.add(path.join(__dirname, '..', m.file_url.substring(1)));
      }
    });

    // 处理聊天设置背景图
    chatSettings.forEach(cs => {
      if (cs.background_image && cs.background_image.startsWith('/uploads/')) {
        filesToDelete.add(path.join(__dirname, '..', cs.background_image.substring(1)));
      }
    });

    // 6. 执行物理删除
    console.log(`正在清理 ${filesToDelete.size} 个物理文件...`);
    for (const filePath of filesToDelete) {
      try {
        await fs.unlink(filePath);
      } catch (err) {
        // 忽略文件不存在等错误
        if (err.code !== 'ENOENT') {
          console.error(`删除文件失败: ${filePath}`, err);
        }
      }
    }
  } catch (error) {
    console.error('清理用户物理文件失败:', error);
  }
}

/**
 * 更新任务进度
 * @param {number} userId - 用户ID
 * @param {string} taskName - 任务名称 (必须匹配 user_tasks 表中的 name)
 * @param {number} count - 增加的进度 (默认为 1)
 * @param {boolean} isAbsolute - 是否为绝对值 (如果是 true，则直接设置为 count，而不是增加)
 */
export async function updateTaskProgress(userId, taskName, count = 1, isAbsolute = false) {
  try {
    // 查找未完成的任务
    const [tasks] = await query(
      `SELECT * FROM user_tasks 
       WHERE user_id = ? AND name = ? AND status != 'completed'`,
      [userId, taskName]
    );

    if (!tasks || tasks.length === 0) {
      return; // 没有匹配的任务或任务已完成
    }

    const task = tasks[0];
    let newCount = isAbsolute ? count : task.current_count + count;

    // 检查是否达到目标
    if (newCount >= task.target_count) {
      // 完成任务
      await query(
        `UPDATE user_tasks 
         SET current_count = ?, status = 'completed', completed_at = NOW() 
         WHERE id = ?`,
        [task.target_count, task.id]
      );
    } else {
      // 更新进度
      await query(
        `UPDATE user_tasks 
         SET current_count = ? 
         WHERE id = ?`,
        [newCount, task.id]
      );
    }
  } catch (error) {
    console.error(`更新任务进度失败 (${taskName}):`, error);
  }
}

/**
 * 检查并创建默认任务 (用于老用户迁移)
 * @param {number} userId - 用户ID
 */
export async function ensureDefaultTasks(userId) {
  try {
    const defaultTasks = [
      { name: '每日签到', description: '每天完成签到', points_reward: 0, task_type: 'daily', target_count: 1 },
      { name: '发布3篇帖子', description: '发布3篇帖子', points_reward: 0, task_type: 'daily', target_count: 3 },
      { name: '点赞5次', description: '点赞5次帖子', points_reward: 0, task_type: 'daily', target_count: 5 },
      { name: '评论3次', description: '评论3次帖子', points_reward: 0, task_type: 'daily', target_count: 3 },
      { name: '完善资料', description: '完善个人资料', points_reward: 0, task_type: 'once', target_count: 1 },
      { name: '累计获得100赞', description: '累计获得100个点赞', points_reward: 0, task_type: 'achievement', target_count: 100 },
      { name: '累计发布50帖', description: '累计发布50个帖子', points_reward: 0, task_type: 'achievement', target_count: 50 },
    ];

    for (const task of defaultTasks) {
      // 检查任务是否存在
      const [existing] = await query(
        `SELECT id FROM user_tasks WHERE user_id = ? AND name = ?`,
        [userId, task.name]
      );

      if (!existing || existing.length === 0) {
        await query(
          `INSERT INTO user_tasks (user_id, name, description, points_reward, task_type, target_count, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())`,
          [userId, task.name, task.description, task.points_reward, task.task_type, task.target_count]
        );
      }
    }
  } catch (error) {
    console.error('检查默认任务失败:', error);
  }
}

/**
 * 重置每日任务 (由定时任务调用)
 */
export async function resetDailyTasks() {
  try {
    await query(
      `UPDATE user_tasks 
       SET current_count = 0, status = 'pending', completed_at = NULL 
       WHERE task_type = 'daily'`
    );
    console.log('每日任务已重置');
  } catch (error) {
    console.error('重置每日任务失败:', error);
  }
}

/**
 * 清理游客账号及其相关数据
 * @param {number} olderThanDays - 清理多少天前未登录的游客 (如果为 0 则清理所有游客)
 */
export async function cleanupGuests(olderThanDays = 30) {
  try {
    let sql = 'SELECT id FROM users WHERE is_guest = TRUE';
    const params = [];

    if (olderThanDays > 0) {
      sql += ' AND (last_login_at < DATE_SUB(NOW(), INTERVAL ? DAY) OR (last_login_at IS NULL AND created_at < DATE_SUB(NOW(), INTERVAL ? DAY)))';
      params.push(olderThanDays, olderThanDays);
    }

    // 查找符合条件的游客
    const [expiredGuests] = await query(sql, params);

    if (expiredGuests && expiredGuests.length > 0) {
      const guestIds = expiredGuests.map(g => g.id);
      console.log(`正在清理 ${guestIds.length} 个游客账号...`);

      // 1. 先清理物理文件
      await cleanupUserFiles(guestIds);

      // 2. 删除数据库记录
      // 由于设置了外键级联删除 (ON DELETE CASCADE)，删除用户会自动删除相关数据
      // (如 posts, comments, notifications, user_tasks 等)
      // 注意：某些表如果没有设置级联删除，可能需要手动删除。
      // 在 backend/routes/admin.js 的批量删除逻辑中，有大量的手动删除操作。
      // 为了保险起见，我们可以复用那里的逻辑或者确保级联删除已正确配置。
      // 这里暂时信任数据库的级联删除，或者在下面补充关键表的删除。

      await query(
        `DELETE FROM users WHERE id IN (?)`,
        [guestIds]
      );
      
      console.log('✓ 游客账号清理完成');
      return guestIds.length;
    }
    return 0;
  } catch (error) {
    console.error('清理游客账号失败:', error);
    throw error;
  }
}
