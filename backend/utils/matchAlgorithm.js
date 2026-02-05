import { query } from '../database/connection.js';

// 安全解析标签，支持JSON格式和逗号分隔格式
function safeParseTags(tagsString) {
  if (!tagsString) {
    return [];
  }
  // 确保tagsString是字符串类型
  const str = typeof tagsString === 'string' ? tagsString : String(tagsString);
  try {
    // 尝试解析为JSON
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    // 如果解析失败，尝试按逗号分隔
    return str.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
  }
}

/**
 * 智能匹配算法
 * 根据需求文档实现完整的匹配算法
 */
export async function calculateMatchScore(userId, targetUserId) {
  // 获取用户信息
  const [users] = await query(
    `SELECT 
      u1.id as user_id, u1.username as user_username, u1.nickname as user_nickname, 
      u1.avatar as user_avatar, u1.gender as user_gender, u1.birthday as user_birthday, 
      u1.location as user_location, u1.interest_tags as user_interest_tags,
      u2.id as target_id, u2.username as target_username, u2.nickname as target_nickname, 
      u2.avatar as target_avatar, u2.gender as target_gender, u2.birthday as target_birthday, 
      u2.location as target_location, u2.interest_tags as target_interest_tags
     FROM users u1, users u2 
     WHERE u1.id = ? AND u2.id = ?`,
    [userId, targetUserId]
  );

  if (!users || users.length === 0) {
    return 0;
  }

  const user = {
    id: users[0].user_id,
    username: users[0].user_username,
    nickname: users[0].user_nickname,
    avatar: users[0].user_avatar,
    gender: users[0].user_gender,
    birthday: users[0].user_birthday,
    location: users[0].user_location,
    interest_tags: users[0].user_interest_tags
  };
  
  const target = {
    id: users[0].target_id,
    username: users[0].target_username,
    nickname: users[0].target_nickname,
    avatar: users[0].target_avatar,
    gender: users[0].target_gender,
    birthday: users[0].target_birthday,
    location: users[0].target_location,
    interest_tags: users[0].target_interest_tags
  };

  // 1. 基础匹配 (20%)
  const baseScore = calculateBaseMatch(user, target);

  // 2. 兴趣匹配 (30%)
  const interestScore = await calculateInterestMatch(userId, targetUserId);

  // 3. 社交匹配 (25%)
  const socialScore = await calculateSocialMatch(userId, targetUserId);

  // 4. 质量匹配 (25%)
  const qualityScore = await calculateQualityMatch(userId, targetUserId);

  // 5. 活跃度加成
  const activityMultiplier = await calculateActivityMultiplier(targetUserId);

  const finalScore = (baseScore * 0.2 + 
                     interestScore * 0.3 + 
                     socialScore * 0.25 + 
                     qualityScore * 0.25) * 
                     activityMultiplier * 100;

  return Math.min(Math.round(finalScore), 100);
}

// 基础匹配
function calculateBaseMatch(user, target) {
  let score = 0;

  // 年龄匹配（如果有生日信息）
  if (user.birthday && target.birthday) {
    const userAge = calculateAge(user.birthday);
    const targetAge = calculateAge(target.birthday);
    const ageDiff = Math.abs(userAge - targetAge);
    score += Math.max(0, 1 - ageDiff / 20) * 0.3; // 年龄差越小分数越高
  } else {
    score += 0.15; // 默认中等分数
  }

  // 性别匹配（简化处理）
  if (user.gender !== 'secret' && target.gender !== 'secret') {
    if (user.gender !== target.gender) {
      score += 0.3; // 异性匹配加分
    }
  } else {
    score += 0.15;
  }

  // 地理位置匹配
  if (user.location && target.location) {
    if (user.location === target.location) {
      score += 0.3; // 同城
    } else if (user.location.split(' ')[0] === target.location.split(' ')[0]) {
      score += 0.2; // 同省
    } else {
      score += 0.1;
    }
  } else {
    score += 0.15;
  }

  // 在线状态（从Redis获取，这里简化处理）
  score += 0.1; // 默认值

  return Math.min(score, 1);
}

// 兴趣匹配
async function calculateInterestMatch(userId, targetUserId) {
  const [users] = await query(
    'SELECT interest_tags FROM users WHERE id IN (?, ?)',
    [userId, targetUserId]
  );

  if (!users || users.length < 2) {
    return 0.5;
  }

  const userTags = safeParseTags(users[0].interest_tags);
  const targetTags = safeParseTags(users[1].interest_tags);

  if (userTags.length === 0 || targetTags.length === 0) {
    return 0.5;
  }

  // 计算标签重合度（Jaccard相似度）
  const intersection = userTags.filter(tag => targetTags.includes(tag));
  const union = [...new Set([...userTags, ...targetTags])];
  const similarity = intersection.length / union.length;

  return similarity;
}

// 社交匹配
async function calculateSocialMatch(userId, targetUserId) {
  let score = 0;

  // 共同好友
  const [commonFriends] = await query(
    `SELECT COUNT(*) as count FROM (
      SELECT friend_id FROM user_friends WHERE user_id = ?
      UNION
      SELECT user_id FROM user_friends WHERE friend_id = ?
    ) u1
    INNER JOIN (
      SELECT friend_id FROM user_friends WHERE user_id = ?
      UNION
      SELECT user_id FROM user_friends WHERE friend_id = ?
    ) u2 ON u1.friend_id = u2.friend_id`,
    [userId, userId, targetUserId, targetUserId]
  );

  const commonCount = commonFriends[0]?.count || 0;
  score += Math.min(commonCount * 0.1, 0.3); // 最多0.3分

  // 互动历史
  const [interactions] = await query(
    `SELECT COUNT(*) as count FROM (
      SELECT id FROM messages WHERE sender_id = ? AND receiver_id = ?
      UNION
      SELECT id FROM post_likes WHERE user_id = ? AND post_id IN (SELECT id FROM posts WHERE user_id = ?)
    ) t`,
    [userId, targetUserId, userId, targetUserId]
  );

  const interactionCount = interactions[0]?.count || 0;
  score += Math.min(interactionCount * 0.05, 0.2); // 最多0.2分

  // 社交活跃度相似度
  const [activity] = await query(
    `SELECT 
      (SELECT COUNT(*) FROM posts WHERE user_id = ?) as user_posts,
      (SELECT COUNT(*) FROM posts WHERE user_id = ?) as target_posts`,
    [userId, targetUserId]
  );

  if (activity && activity.length > 0) {
    const userPosts = activity[0].user_posts || 0;
    const targetPosts = activity[0].target_posts || 0;
    const diff = Math.abs(userPosts - targetPosts);
    const maxPosts = Math.max(userPosts, targetPosts, 1);
    score += (1 - diff / maxPosts) * 0.2; // 活跃度越相似分数越高
  }

  return Math.min(score, 1);
}

// 质量匹配
async function calculateQualityMatch(userId, targetUserId) {
  let score = 0;

  // 用户资料完整度
  const [users] = await query(
    `SELECT 
      CASE WHEN avatar IS NOT NULL AND avatar != '' THEN 1 ELSE 0 END as has_avatar,
      CASE WHEN bio IS NOT NULL AND bio != '' THEN 1 ELSE 0 END as has_bio,
      CASE WHEN location IS NOT NULL AND location != '' THEN 1 ELSE 0 END as has_location,
      CASE WHEN interest_tags IS NOT NULL AND interest_tags != '[]' THEN 1 ELSE 0 END as has_tags
     FROM users WHERE id = ?`,
    [targetUserId]
  );

  if (users && users.length > 0) {
    const user = users[0];
    const completeness = (user.has_avatar + user.has_bio + user.has_location + user.has_tags) / 4;
    score += completeness * 0.3;
  }

  // 内容质量
  const [content] = await query(
    `SELECT 
      AVG(like_count) as avg_likes,
      COUNT(*) as post_count
     FROM posts 
     WHERE user_id = ? AND status = 'active'`,
    [targetUserId]
  );

  if (content && content.length > 0) {
    const avgLikes = content[0].avg_likes || 0;
    const postCount = content[0].post_count || 0;
    const qualityScore = Math.min(avgLikes / 10, 1) * 0.4 + Math.min(postCount / 20, 1) * 0.3;
    score += qualityScore;
  }

  return Math.min(score, 1);
}

// 活跃度加成
async function calculateActivityMultiplier(userId) {
  // 检查最后登录时间
  const [users] = await query(
    'SELECT last_login_at FROM users WHERE id = ?',
    [userId]
  );

  if (!users || users.length === 0) {
    return 0.5;
  }

  const lastLogin = new Date(users[0].last_login_at);
  const now = new Date();
  const hoursSinceLogin = (now - lastLogin) / (1000 * 60 * 60);

  // 24小时内登录：1.2倍，48小时内：1.0倍，72小时内：0.8倍，超过：0.6倍
  if (hoursSinceLogin <= 24) {
    return 1.2;
  } else if (hoursSinceLogin <= 48) {
    return 1.0;
  } else if (hoursSinceLogin <= 72) {
    return 0.8;
  } else {
    return 0.6;
  }
}

// 计算年龄
function calculateAge(birthday) {
  const birth = new Date(birthday);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

