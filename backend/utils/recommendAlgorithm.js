import { query } from '../database/connection.js';

/**
 * 帖子推荐算法
 * 根据需求文档实现完整的推荐算法
 */
export async function calculatePostRecommendationScore(userId, post, user = null) {
  // 当userId为undefined（用户未登录）时，直接返回基于内容质量和时效性的基础分数
  if (!userId) {
    const qualityScore = calculateContentQuality(post);
    const timeScore = calculateTimeWeighting(post);
    const baseScore = qualityScore * 0.6 + timeScore * 0.4;
    return baseScore;
  }

  if (!user) {
    const [users] = await query('SELECT * FROM users WHERE id = ?', [userId]);
    user = users[0];
  }

  // 1. 兴趣匹配度 (30%)
  const interestScore = calculateInterestMatch(user, post);

  // 2. 社交权重 (25%)
  const socialScore = await calculateSocialWeight(userId, post);

  // 3. 内容质量 (20%)
  const qualityScore = calculateContentQuality(post);

  // 4. 时效性 (15%)
  const timeScore = calculateTimeWeighting(post);

  // 5. 地理位置 (10%)
  const locationScore = calculateLocationWeight(user, post);

  // 基础分数
  const baseScore = interestScore * 0.3 + 
                   socialScore * 0.25 + 
                   qualityScore * 0.2 + 
                   timeScore * 0.15 + 
                   locationScore * 0.1;

  return baseScore;
}

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

// 兴趣匹配度
function calculateInterestMatch(user, post) {
  const userInterests = safeParseTags(user.interest_tags);
  const postTags = safeParseTags(post.tags);

  if (userInterests.length === 0 || postTags.length === 0) {
    return 0.5; // 默认中等匹配度
  }

  // Jaccard相似度
  const intersection = userInterests.filter(tag => postTags.includes(tag));
  const union = [...new Set([...userInterests, ...postTags])];

  return intersection.length / union.length;
}

// 社交权重
async function calculateSocialWeight(userId, post) {
  let score = 0;

  // 好友关系
  const [friends] = await query(
    `SELECT id FROM user_friends 
     WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)`,
    [userId, post.user_id, post.user_id, userId]
  );

  if (friends && friends.length > 0) {
    score += 0.6;
  }
  
  // 关注关系
  const [follows] = await query(
    `SELECT id FROM user_follows 
     WHERE follower_id = ? AND following_id = ?`,
    [userId, post.user_id]
  );

  if (follows && follows.length > 0) {
    score += 0.4;
  }

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
    [userId, userId, post.user_id, post.user_id]
  );

  const commonCount = commonFriends[0]?.count || 0;
  score += Math.min(commonCount * 0.1, 0.3);

  // 互动历史
  const [interactions] = await query(
    `SELECT COUNT(*) as count FROM post_likes 
     WHERE user_id = ? AND post_id IN (SELECT id FROM posts WHERE user_id = ?)`,
    [userId, post.user_id]
  );

  const interactionCount = interactions[0]?.count || 0;
  score += Math.min(interactionCount * 0.05, 0.1);

  return Math.min(score, 1);
}

// 内容质量
function calculateContentQuality(post) {
  const likeWeight = 0.4;
  const commentWeight = 0.4;
  const shareWeight = 0.2;

  const likeScore = Math.min((post.like_count || 0) / 100, 1) * likeWeight;
  const commentScore = Math.min((post.comment_count || 0) / 50, 1) * commentWeight;
  const shareScore = Math.min((post.share_count || 0) / 20, 1) * shareWeight;

  return likeScore + commentScore + shareScore;
}

// 时间权重
function calculateTimeWeighting(post) {
  const now = new Date();
  const postTime = new Date(post.created_at);
  const hoursDiff = (now - postTime) / (1000 * 60 * 60);

  // 24小时内指数衰减
  if (hoursDiff <= 24) {
    return Math.exp(-hoursDiff / 8); // 8小时半衰期
  }

  // 24小时后线性衰减
  return Math.max(0, 1 - (hoursDiff - 24) / 168); // 一周内衰减到0
}

// 地理位置权重
function calculateLocationWeight(user, post) {
  if (!user.location || !post.location) {
    return 0.6; // 默认中等权重
  }

  const userLocation = user.location.split(' ');
  const postLocation = post.location.split(' ');

  if (userLocation[0] === postLocation[0] && userLocation[1] === postLocation[1]) {
    return 1.0; // 同城
  } else if (userLocation[0] === postLocation[0]) {
    return 0.8; // 同省
  } else {
    return 0.6; // 其他地区
  }
}

/**
 * 好友推荐算法
 * 基于共同好友和兴趣的推荐算法
 */
export async function getFriendRecommendations(userId, limit = 10) {
  try {
    // 获取当前用户信息
    const [currentUserResult] = await query(
      'SELECT id, interest_tags, location FROM users WHERE id = ?',
      [userId]
    );
    
    const currentUser = currentUserResult[0];
    if (!currentUser) {
      return [];
    }
    
    // 解析当前用户兴趣标签
    const currentUserInterests = safeParseTags(currentUser.interest_tags);
    
    // 获取当前用户的好友列表
    const [currentFriends] = await query(
      `SELECT friend_id FROM user_friends WHERE user_id = ?
       UNION
       SELECT user_id FROM user_friends WHERE friend_id = ?`,
      [userId, userId]
    );
    const currentFriendIds = new Set(currentFriends.map(f => f.friend_id));
    
    // 获取当前用户的黑名单列表
    const [blacklist] = await query(
      'SELECT blocked_id FROM user_blacklist WHERE blocker_id = ?',
      [userId]
    );
    const blacklistIds = new Set(blacklist.map(b => b.blocked_id));
    
    // 查询潜在推荐用户（排除当前好友、黑名单和自己）
    const [potentialFriends] = await query(
      `SELECT id, nickname, avatar, interest_tags, location, 
              last_login_at, created_at
       FROM users 
       WHERE id != ? AND status = 'active'`,
      [userId]
    );
    
    // 计算每个潜在好友的推荐分数
    const recommendations = [];
    for (const potentialFriend of potentialFriends) {
      // 排除已有的好友和黑名单用户
      if (currentFriendIds.has(potentialFriend.id) || blacklistIds.has(potentialFriend.id)) {
        continue;
      }
      
      // 计算推荐分数
      const score = await calculateFriendRecommendationScore(
        userId, 
        currentUser, 
        potentialFriend
      );
      
      // 查询共同好友数量
      const [commonFriendsResult] = await query(
        `SELECT COUNT(*) as common_count FROM (
          SELECT friend_id FROM user_friends WHERE user_id = ?
          UNION
          SELECT user_id FROM user_friends WHERE friend_id = ?
        ) u1
        JOIN (
          SELECT friend_id FROM user_friends WHERE user_id = ?
          UNION
          SELECT user_id FROM user_friends WHERE friend_id = ?
        ) u2 ON u1.friend_id = u2.friend_id`,
        [userId, userId, potentialFriend.id, potentialFriend.id]
      );
      
      const commonCount = commonFriendsResult[0]?.common_count || 0;
      
      recommendations.push({
        user: potentialFriend,
        score,
        common_friends: commonCount
      });
    }
    
    // 按分数排序，返回前N个推荐
    return recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
      
  } catch (error) {
    console.error('好友推荐算法执行失败:', error);
    return [];
  }
}

/**
 * 计算好友推荐分数
 */
async function calculateFriendRecommendationScore(userId, currentUser, potentialFriend) {
  // 1. 共同好友数量 (35%)
  const commonFriendsScore = await calculateCommonFriendsWeight(userId, potentialFriend.id);
  
  // 2. 兴趣匹配度 (30%)
  const interestScore = calculateFriendInterestMatch(currentUser, potentialFriend);
  
  // 3. 地理位置相近度 (15%)
  const locationScore = calculateFriendLocationWeight(currentUser, potentialFriend);
  
  // 4. VIP等级兼容性 (10%)
  const vipScore = calculateVIPCompatibility(currentUser, potentialFriend);
  
  // 5. 活跃度相似度 (10%)
  const activityScore = calculateActivitySimilarity(potentialFriend);
  
  // 综合分数
  return commonFriendsScore * 0.35 + 
         interestScore * 0.3 + 
         locationScore * 0.15 + 
         vipScore * 0.1 + 
         activityScore * 0.1;
}

/**
 * 计算共同好友权重
 */
async function calculateCommonFriendsWeight(userId, potentialFriendId) {
  const [commonFriendsResult] = await query(
    `SELECT COUNT(*) as common_count FROM (
      SELECT friend_id FROM user_friends WHERE user_id = ?
      UNION
      SELECT user_id FROM user_friends WHERE friend_id = ?
    ) u1
    JOIN (
      SELECT friend_id FROM user_friends WHERE user_id = ?
      UNION
      SELECT user_id FROM user_friends WHERE friend_id = ?
    ) u2 ON u1.friend_id = u2.friend_id`,
    [userId, userId, potentialFriendId, potentialFriendId]
  );
  
  const commonCount = commonFriendsResult[0]?.common_count || 0;
  
  // 共同好友越多，分数越高，但有上限
  return Math.min(commonCount / 20, 1);
}

/**
 * 计算好友兴趣匹配度
 */
function calculateFriendInterestMatch(currentUser, potentialFriend) {
  const currentInterests = safeParseTags(currentUser.interest_tags);
  const potentialInterests = safeParseTags(potentialFriend.interest_tags);
  
  if (currentInterests.length === 0 || potentialInterests.length === 0) {
    return 0.5; // 默认中等匹配度
  }
  
  // Jaccard相似度
  const intersection = currentInterests.filter(tag => potentialInterests.includes(tag));
  const union = [...new Set([...currentInterests, ...potentialInterests])];
  
  return intersection.length / union.length;
}

/**
 * 计算好友地理位置权重
 */
function calculateFriendLocationWeight(currentUser, potentialFriend) {
  if (!currentUser.location || !potentialFriend.location) {
    return 0.5; // 默认中等权重
  }
  
  const currentLocation = currentUser.location.split(' ');
  const potentialLocation = potentialFriend.location.split(' ');
  
  if (currentLocation[0] === potentialLocation[0] && currentLocation[1] === potentialLocation[1]) {
    return 1.0; // 同城
  } else if (currentLocation[0] === potentialLocation[0]) {
    return 0.7; // 同省
  } else {
    return 0.3; // 其他地区
  }
}

/**
 * 计算活跃度相似度
 */
function calculateActivitySimilarity(potentialFriend) {
  const lastLogin = new Date(potentialFriend.last_login_at);
  const now = new Date();
  const hoursSinceLastLogin = (now - lastLogin) / (1000 * 60 * 60);
  
  // 最近活跃的用户得分更高
  if (hoursSinceLastLogin < 24) {
    return 1.0; // 24小时内活跃
  } else if (hoursSinceLastLogin < 72) {
    return 0.7; // 3天内活跃
  } else if (hoursSinceLastLogin < 168) {
    return 0.4; // 7天内活跃
  } else {
    return 0.1; // 7天以上不活跃
  }
}

