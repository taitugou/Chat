import { query } from '../database/connection.js';

/**
 * 获取用户统计信息（发帖数、好友数、获赞数、关注数、粉丝数）
 * @param {number} userId 用户ID
 * @returns {Promise<Object>} 统计信息对象
 */
export async function getUserStats(userId) {
  let stats = {
    post_count: 0,
    friend_count: 0,
    like_count: 0,
    follower_count: 0,
    following_count: 0
  };

  try {
    const [statsResult] = await query(
      `SELECT 
        (SELECT COUNT(*) FROM posts WHERE user_id = ? AND status = 'active') as post_count,
        (SELECT COUNT(*) FROM user_friends WHERE user_id = ? OR friend_id = ?) as friend_count,
        (SELECT COUNT(*) FROM post_likes WHERE user_id = ?) as like_count`,
      [userId, userId, userId, userId]
    );
    
    if (statsResult && statsResult[0]) {
      stats.post_count = statsResult[0].post_count || 0;
      stats.friend_count = statsResult[0].friend_count || 0;
      stats.like_count = statsResult[0].like_count || 0;
    }
  } catch (error) {
    console.error(`获取用户 ${userId} 基础统计失败:`, error);
  }

  try {
    const [followStats] = await query(
      `SELECT 
        (SELECT COUNT(*) FROM user_follows WHERE following_id = ?) as follower_count,
        (SELECT COUNT(*) FROM user_follows WHERE follower_id = ?) as following_count`,
      [userId, userId]
    );
    
    if (followStats && followStats[0]) {
      stats.follower_count = followStats[0].follower_count || 0;
      stats.following_count = followStats[0].following_count || 0;
    }
  } catch (error) {
    // 忽略表不存在等错误，使用默认值
  }

  return stats;
}
