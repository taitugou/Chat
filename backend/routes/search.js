import express from 'express';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { query } from '../database/connection.js';
import { cacheMiddleware } from '../middleware/cache.js';

const router = express.Router();

async function performSearch(keyword, types, userId, page = 1, limit = 20) {
  const startTime = Date.now();
  const offset = (page - 1) * limit;
  const searchPattern = `%${keyword}%`;
  const results = [];
  let totalResults = 0;

  const searchUsers = types.includes('users') || types.includes('all');
  const searchPosts = types.includes('posts') || types.includes('all');
  const searchTopics = types.includes('topics') || types.includes('all');

  if (searchUsers) {
    try {
      let userSql = `
        SELECT id, username, nickname, avatar, bio, location, online_status, created_at
        FROM users 
        WHERE status = 'active' AND (username LIKE ? OR nickname LIKE ? OR bio LIKE ?)
      `;
      const userParams = [searchPattern, searchPattern, searchPattern];

      if (userId) {
        userSql += ' AND id NOT IN (SELECT blocked_id FROM user_blacklist WHERE blocker_id = ?)';
        userParams.push(userId);
      }

      userSql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      userParams.push(limit, offset);

      const [users] = await query(userSql, userParams);
      
      if (users && users.length > 0) {
        results.push(...users.map((user) => ({
          type: 'user',
          id: user.id,
          username: user.username,
          nickname: user.nickname,
          avatar: user.avatar,
          bio: user.bio,
          location: user.location,
          online_status: user.online_status,
          created_at: user.created_at
        })));
        totalResults += users.length;
      }
    } catch (error) {
      console.error('搜索用户失败:', error);
    }
  }

  if (searchPosts) {
    try {
      let postSql = `
        SELECT p.id, p.content, p.images, p.like_count, p.comment_count, p.share_count, 
               p.created_at, p.post_type, p.link_title, p.link_description, p.link_image_url, p.link_url,
               p.poll_options, p.poll_votes, p.poll_expire_at, p.poll_type, p.poll_is_anonymous,
               p.quote_type, p.quote_id, p.quote_content, p.quote_user_id, p.quote_user_name, p.quote_user_avatar,
               qu.username as quote_user_username,
               u.username, u.nickname, u.avatar
        FROM posts p
        JOIN users u ON p.user_id = u.id
        LEFT JOIN users qu ON p.quote_user_id = qu.id
        WHERE p.status = 'active' AND u.status = 'active' AND p.post_type NOT IN ('topic_comment', 'comment', 'reply')
        AND (p.content LIKE ? OR u.nickname LIKE ?)
      `;
      const postParams = [searchPattern, searchPattern];

      if (userId) {
        postSql += ' AND p.user_id NOT IN (SELECT blocked_id FROM user_blacklist WHERE blocker_id = ?)';
        postParams.push(userId);
      }

      postSql += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
      postParams.push(limit, offset);

      const [posts] = await query(postSql, postParams);
      
      if (posts && posts.length > 0) {
        results.push(...posts.map((post) => {
          let images = [];
          try {
            images = typeof post.images === 'string' ? JSON.parse(post.images || '[]') : (post.images || []);
          } catch (e) {
            images = [];
          }

          let linkInfo = null;
          if (post.link_url || post.link_title) {
            linkInfo = {
              title: post.link_title,
              description: post.link_description,
              image_url: post.link_image_url,
              url: post.link_url
            };
          }

          let pollInfo = null;
          if (post.poll_options) {
            try {
              const pollVotes = typeof post.poll_votes === 'string' ? JSON.parse(post.poll_votes || '{}') : (post.poll_votes || {});
              const pollOptions = typeof post.poll_options === 'string' ? JSON.parse(post.poll_options || '[]') : (post.poll_options || []);
              if (pollOptions.length >= 2) {
                pollInfo = {
                  options: pollOptions,
                  votes: pollVotes,
                  expire_at: post.poll_expire_at,
                  type: post.poll_type,
                  is_anonymous: post.poll_is_anonymous,
                  total_votes: Object.values(pollVotes).reduce((sum, votes) => sum + (Array.isArray(votes) ? votes.length : 0), 0)
                };
              }
            } catch (e) {
              pollInfo = null;
            }
          }

          return {
            type: 'post',
            id: post.id,
            content: post.content,
            images,
            like_count: post.like_count,
            comment_count: post.comment_count,
            share_count: post.share_count,
            created_at: post.created_at,
            post_type: post.post_type,
            link_info: linkInfo,
            poll_info: pollInfo,
            isLiked: false,
            quote_type: post.quote_type,
            quote_id: post.quote_id,
            quote_content: post.quote_content,
            quote_user_id: post.quote_user_id,
            quote_user_name: post.quote_user_name,
            quote_user_avatar: post.quote_user_avatar,
            quote_user_username: post.quote_user_username,
            user: {
              username: post.username,
              nickname: post.nickname,
              avatar: post.avatar
            }
          };
        }));

        // 如果用户已登录，查询点赞状态
        if (userId) {
          const postIds = results.filter(r => r.type === 'post').map(r => r.id);
          if (postIds.length > 0) {
            const [likes] = await query(
              `SELECT post_id FROM post_likes WHERE user_id = ? AND post_id IN (${postIds.join(',')})`,
              [userId]
            );
            const likedPostIds = new Set(likes.map(l => l.post_id));
            results.forEach(result => {
              if (result.type === 'post') {
                result.isLiked = likedPostIds.has(result.id);
              }
            });
          }
        }

        totalResults += posts.length;
      }
    } catch (error) {
      console.error('搜索帖子失败:', error);
    }
  }

  if (searchTopics) {
    try {
      const [topics] = await query(`
        SELECT tag, COUNT(*) as usage_count
        FROM (
          SELECT JSON_UNQUOTE(JSON_EXTRACT(tags, CONCAT('$[', idx, ']'))) as tag
          FROM posts,
          (SELECT 0 as idx UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 
           UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) t
          WHERE tags IS NOT NULL
            AND JSON_EXTRACT(tags, CONCAT('$[', idx, ']')) IS NOT NULL
            AND status = 'active'
        ) tag_table
        WHERE tag LIKE ?
        GROUP BY tag
        ORDER BY usage_count DESC
        LIMIT ?
      `, [searchPattern, limit]);

      if (topics && topics.length > 0) {
        results.push(...topics.map((topic) => ({
          type: 'topic',
          id: 0,
          tag: topic.tag,
          usage_count: topic.usage_count
        })));
        totalResults += topics.length;
      }
    } catch (error) {
      console.error('搜索话题失败:', error);
    }
  }

  const took = Date.now() - startTime;
  const hasMore = totalResults >= limit;

  return {
    query: keyword,
    total_results: totalResults,
    took,
    results,
    pagination: {
      page,
      limit,
      has_more: hasMore
    },
    suggestions: [],
    related_searches: []
  };
}

router.get('/', optionalAuth, cacheMiddleware(30), async (req, res, next) => {
  try {
    const { q, type, page = 1, limit = 20 } = req.query;
    const userId = req.user?.id;
    const keyword = (q || '').trim();

    console.log('搜索请求:', { q, type, page, limit, userId });

    if (!keyword || keyword.length < 1) {
      return res.status(400).json({ error: '搜索关键词不能为空' });
    }

    if (keyword.length > 100) {
      return res.status(400).json({ error: '搜索关键词不能超过100个字符' });
    }

    let searchTypes = ['all'];
    if (type && ['users', 'posts', 'topics', 'all'].includes(type)) {
      searchTypes = type === 'all' ? ['users', 'posts', 'topics'] : [type];
    }

    console.log('搜索类型:', searchTypes);

    const searchResults = await performSearch(
      keyword,
      searchTypes,
      userId,
      parseInt(page),
      parseInt(limit)
    );

    console.log('搜索结果:', { total: searchResults.total_results, took: searchResults.took });
    res.json(searchResults);
  } catch (error) {
    console.error('搜索失败:', error);
    next(error);
  }
});

router.get('/suggestions', optionalAuth, async (req, res, next) => {
  try {
    const { q } = req.query;
    const keyword = (q || '').trim();

    if (!keyword || keyword.length < 1) {
      return res.json({ suggestions: [] });
    }

    const searchPattern = `%${keyword}%`;
    const suggestions = [];

    try {
      const [users] = await query(`
        SELECT DISTINCT nickname FROM users 
        WHERE status = 'active' AND nickname LIKE ? 
        LIMIT 5
      `, [searchPattern]);

      const [posts] = await query(`
        SELECT DISTINCT SUBSTRING_INDEX(content, ' ', 3) as phrase
        FROM posts 
        WHERE status = 'active' AND content LIKE ? 
        LIMIT 5
      `, [searchPattern]);

      if (users && users.length > 0) {
        suggestions.push(...users.map((u) => u.nickname).slice(0, 3));
      }

      if (posts && posts.length > 0) {
        suggestions.push(...posts.map((p) => p.phrase).slice(0, 2));
      }

      const uniqueSuggestions = [...new Set(suggestions)].slice(0, 5);
      res.json({ suggestions: uniqueSuggestions });
    } catch (error) {
      console.error('获取搜索建议失败:', error);
      res.json({ suggestions: [] });
    }
  } catch (error) {
    next(error);
  }
});

router.get('/trending', optionalAuth, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const [trendingPosts] = await query(`
      SELECT p.id, p.content, p.like_count, p.comment_count, p.share_count,
             p.created_at, u.username, u.nickname, u.avatar
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.status = 'active' AND u.status = 'active'
      ORDER BY (p.like_count + p.comment_count * 2 + p.share_count * 3) DESC, p.created_at DESC
      LIMIT ?
    `, [limit]);

    // 处理点赞状态
    const userId = req.user?.id;
    const processedTrendingPosts = (trendingPosts || []).map(post => ({
      ...post,
      isLiked: false
    }));

    if (userId && processedTrendingPosts.length > 0) {
      const postIds = processedTrendingPosts.map(p => p.id);
      const [likes] = await query(
        `SELECT post_id FROM post_likes WHERE user_id = ? AND post_id IN (${postIds.join(',')})`,
        [userId]
      );
      const likedPostIds = new Set(likes.map(l => l.post_id));
      processedTrendingPosts.forEach(post => {
        post.isLiked = likedPostIds.has(post.id);
      });
    }

    const [popularTags] = await query(`
      SELECT tag, COUNT(*) as count
      FROM (
        SELECT JSON_UNQUOTE(JSON_EXTRACT(tags, CONCAT('$[', idx, ']'))) as tag
        FROM posts,
        (SELECT 0 as idx UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4) t
        WHERE tags IS NOT NULL AND JSON_EXTRACT(tags, CONCAT('$[', idx, ']')) IS NOT NULL
        AND status = 'active'
      ) tag_table
      GROUP BY tag
      ORDER BY count DESC
      LIMIT ?
    `, [limit]);

    let popularUsers = [];
    try {
      const { getOnlineUsers } = await import('../database/redis.js');
      const onlineUserIds = await getOnlineUsers();
      const onlineSet = new Set(onlineUserIds.map(id => parseInt(id)));

      const [users] = await query(`
        SELECT u.id, u.username, u.nickname, u.avatar,
               (SELECT COUNT(*) FROM posts WHERE user_id = u.id AND status = 'active') as post_count
        FROM users u
        WHERE u.status = 'active'
        ORDER BY post_count DESC, u.created_at DESC
        LIMIT ?
      `, [limit]);

      popularUsers = (users || []).map(user => ({
        ...user,
        online_status: onlineSet.has(user.id) ? 'online' : 'offline'
      }));
    } catch (redisError) {
      const [users] = await query(`
        SELECT u.id, u.username, u.nickname, u.avatar, u.online_status,
               (SELECT COUNT(*) FROM posts WHERE user_id = u.id AND status = 'active') as post_count
        FROM users u
        WHERE u.status = 'active'
        ORDER BY post_count DESC, u.created_at DESC
        LIMIT ?
      `, [limit]);
      popularUsers = users || [];
    }

    res.json({
      trending_posts: processedTrendingPosts,
      popular_tags: popularTags || [],
      popular_users: popularUsers || []
    });
  } catch (error) {
    console.error('获取热门搜索失败:', error);
    res.json({
      trending_posts: [],
      popular_tags: [],
      popular_users: []
    });
  }
});

router.get('/users', optionalAuth, async (req, res, next) => {
  try {
    const { keyword, page = 1, limit = 20 } = req.query;
    const userId = req.user?.id;
    const searchPattern = `%${keyword}%`;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let sql = `
      SELECT id, username, nickname, avatar, bio, location, online_status, created_at
      FROM users 
      WHERE status = 'active' AND (username LIKE ? OR nickname LIKE ? OR bio LIKE ?)
    `;
    const params = [searchPattern, searchPattern, searchPattern];

    if (userId) {
      sql += ' AND id NOT IN (SELECT blocked_id FROM user_blacklist WHERE blocker_id = ?)';
      params.push(userId);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [users] = await query(sql, params);
    res.json({ users: users || [], page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    next(error);
  }
});

router.get('/posts', optionalAuth, async (req, res, next) => {
  try {
    const { keyword, tags, page = 1, limit = 20, sort = 'latest' } = req.query;
    const userId = req.user?.id;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const searchPattern = `%${keyword}%`;

    let sql = `
      SELECT p.id, p.content, p.images, p.video_url, p.audio_url, p.location, p.tags, p.links,
             p.like_count, p.comment_count, p.share_count, p.created_at, p.post_type,
             p.link_title, p.link_description, p.link_image_url, p.link_url,
             p.poll_options, p.poll_votes, p.poll_expire_at, p.poll_type, p.poll_is_anonymous,
             p.quote_type, p.quote_id, p.quote_content, p.quote_user_id, p.quote_user_name, p.quote_user_avatar,
             qu.username as quote_user_username,
             u.username, u.nickname, u.avatar
      FROM posts p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN users qu ON p.quote_user_id = qu.id
      WHERE p.status = 'active' AND u.status = 'active' AND p.post_type NOT IN ('topic_comment')
      AND (p.content LIKE ? OR u.nickname LIKE ?)
    `;
    const params = [searchPattern, searchPattern];

    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : tags.split(',');
      sql += ' AND JSON_CONTAINS(p.tags, ?)';
      params.push(JSON.stringify(tagArray));
    }

    if (userId) {
      sql += ' AND p.user_id NOT IN (SELECT blocked_id FROM user_blacklist WHERE blocker_id = ?)';
      params.push(userId);
    }

    let orderByClause = '';
    if (sort === 'hot') {
      orderByClause = ' ORDER BY (p.like_count + p.comment_count * 2 + p.share_count * 3) DESC, p.created_at DESC';
    } else {
      orderByClause = ' ORDER BY p.created_at DESC';
    }

    sql += orderByClause + ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [posts] = await query(sql, params);

    const processedPosts = (posts || []).map((post) => {
      try {
        post.images = typeof post.images === 'string' ? JSON.parse(post.images || '[]') : (post.images || []);
        post.tags = typeof post.tags === 'string' ? JSON.parse(post.tags || '[]') : (post.tags || []);
        post.links = typeof post.links === 'string' ? JSON.parse(post.links || '[]') : (post.links || []);
      } catch (e) {
        post.images = [];
        post.tags = [];
        post.links = [];
      }

      if (post.link_url || post.link_title) {
        post.link_info = {
          title: post.link_title,
          description: post.link_description,
          image_url: post.link_image_url,
          url: post.link_url
        };
      }

      if (post.poll_options) {
        try {
          post.poll_votes = typeof post.poll_votes === 'string' ? JSON.parse(post.poll_votes || '{}') : (post.poll_votes || {});
          post.poll_options = typeof post.poll_options === 'string' ? JSON.parse(post.poll_options || '[]') : (post.poll_options || []);
        } catch (e) {
          post.poll_votes = {};
          post.poll_options = [];
        }
      }

      return post;
    });

    res.json({ posts: processedPosts, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    next(error);
  }
});

router.get('/topics', optionalAuth, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 20;

    let topics = [];
    try {
      const [jsonTopics] = await query(`
        SELECT tag, COUNT(*) as count
        FROM (
          SELECT JSON_UNQUOTE(JSON_EXTRACT(tags, CONCAT('$[', idx, ']'))) as tag
          FROM posts,
          (SELECT 0 as idx UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 
           UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) t
          WHERE tags IS NOT NULL AND JSON_EXTRACT(tags, CONCAT('$[', idx, ']')) IS NOT NULL
          AND status = 'active'
        ) tag_table
        GROUP BY tag
        ORDER BY count DESC
        LIMIT ?
      `, [limit]);

      topics = jsonTopics || [];
    } catch (jsonError) {
      console.error('使用JSON函数查询话题失败:', jsonError.message);
      topics = [];
    }

    res.json({ topics });
  } catch (error) {
    console.error('获取话题失败:', error);
    res.json({ topics: [] });
  }
});

export default router;
