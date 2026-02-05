import express from 'express';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { query } from '../database/connection.js';
import { cacheMiddleware } from '../middleware/cache.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { filterSensitiveWords } from '../utils/sensitiveWords.js';
import { processMentions, cleanupMentions } from '../utils/mentionHelper.js';
import { addPoints, POINTS_REWARDS } from '../services/pointsService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// 处理匿名用户信息
function processAnonymousUser(item, currentUser) {
  if (item.is_anonymous) {
    const isAdmin = currentUser && currentUser.username === 'admin';
    
    if (!isAdmin) {
      return {
        user_id: item.user_id,
        username: '匿名用户',
        nickname: '匿名用户',
        avatar: null
      };
    }
  }
  return {
    user_id: item.user_id,
    username: item.username,
    nickname: item.nickname,
    avatar: item.avatar
  };
}

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/topics');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`;
    cb(null, filename);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件'));
    }
  },
});

router.post('/', authenticate, upload.single('cover'), async (req, res, next) => {
  try {
    let { title, description, tags, is_anonymous = false } = req.body;
    const userId = req.user.id;

    if (!title || title.trim().length === 0) {
      return res.status(400).json({ error: '话题标题不能为空' });
    }

    if (title.length > 200) {
      return res.status(400).json({ error: '话题标题不能超过200字' });
    }

    let filteredTitle = filterSensitiveWords(title);
    if (filteredTitle !== title) {
      title = filteredTitle;
    }

    let filteredDescription = description ? filterSensitiveWords(description) : '';
    if (filteredDescription !== description) {
      description = filteredDescription;
    }

    const coverImage = req.file ? `/uploads/topics/${req.file.filename}` : null;

    const tagArray = tags ? (Array.isArray(tags) ? tags : tags.split(',')) : [];

    const [result] = await query(
      `INSERT INTO topics (user_id, is_anonymous, title, description, cover_image, tags, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', NOW())`,
      [userId, is_anonymous === 'true' || is_anonymous === true ? 1 : 0, title, description, coverImage, JSON.stringify(tagArray)]
    );

    const topicId = result.insertId;

    // 处理提及 (@mention)
    try {
      await processMentions({
        content: description || '',
        topicId,
        userId,
        io: req.io
      });
    } catch (error) {
      console.error('处理提及失败:', error);
    }

    res.status(201).json({
      message: '话题创建成功',
      topicId: result.insertId,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/', optionalAuth, cacheMiddleware(60), async (req, res, next) => {
  try {
    const { page = 1, limit = 20, sort = 'latest' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const userId = req.user?.id;

    const params = [];
    let sql = `
      SELECT t.id, t.user_id, t.is_anonymous, t.title, t.description, t.cover_image, t.tags,
             t.is_hot, t.is_top, t.status, t.view_count, t.post_count, t.like_count, t.created_at, t.updated_at,
             u.username, u.nickname, u.avatar,
             COALESCE(tf_cnt.follow_count, 0) as follow_count
      FROM topics t
      JOIN users u ON t.user_id = u.id
      LEFT JOIN (
        SELECT topic_id, COUNT(*) as follow_count
        FROM topic_follows
        GROUP BY topic_id
      ) tf_cnt ON tf_cnt.topic_id = t.id
      WHERE t.status = 'active'
    `;

    if (sort === 'following') {
      if (!userId) {
        return res.status(401).json({ error: '登录后才能查看关注的话题' });
      }
      sql += ' AND EXISTS (SELECT 1 FROM topic_follows tf_user WHERE tf_user.topic_id = t.id AND tf_user.user_id = ?)';
      params.push(userId);
    }

    if (sort === 'hot') {
      sql += ' ORDER BY t.is_top DESC, t.post_count DESC, t.created_at DESC';
    } else if (sort === 'follow') {
      sql += ' ORDER BY t.is_top DESC, COALESCE(tf_cnt.follow_count, 0) DESC, t.created_at DESC';
    } else {
      sql += ' ORDER BY t.is_top DESC, t.created_at DESC';
    }

    sql += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [topics] = await query(sql, params);

    const resultTopics = (topics || []).map(topic => {
      const userInfo = processAnonymousUser(topic, req.user);
      return {
        ...topic,
        user_id: userInfo.user_id,
        username: userInfo.username,
        nickname: userInfo.nickname,
        avatar: userInfo.avatar,
        tags: typeof topic.tags === 'string' ? JSON.parse(topic.tags || '[]') : (Array.isArray(topic.tags) ? topic.tags : []),
        isFollowed: false,
        isLiked: false,
      };
    });

    if (userId && typeof userId === 'number' && !isNaN(userId)) {
      const topicIds = resultTopics.map(t => t.id);
      if (topicIds.length > 0) {
        const [follows] = await query(
          `SELECT topic_id FROM topic_follows WHERE user_id = ? AND topic_id IN (${topicIds.join(',')})`,
          [userId]
        );
        const [likes] = await query(
          `SELECT topic_id FROM topic_likes WHERE user_id = ? AND topic_id IN (${topicIds.join(',')})`,
          [userId]
        );
        const followedTopicIds = new Set(follows.map(f => f.topic_id));
        const likedTopicIds = new Set(likes.map(l => l.topic_id));
        resultTopics.forEach(topic => {
          topic.isFollowed = followedTopicIds.has(topic.id);
          topic.isLiked = likedTopicIds.has(topic.id);
        });
      }
    }

    res.json({ topics: resultTopics, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const [topics] = await query(
      `SELECT t.id, t.user_id, t.is_anonymous, t.title, t.description, t.cover_image, t.tags, 
              t.is_hot, t.is_top, t.status, t.view_count, t.post_count, t.follow_count, t.like_count, t.created_at, t.updated_at,
              u.username, u.nickname, u.avatar
       FROM topics t
       JOIN users u ON t.user_id = u.id
       WHERE t.id = ? AND t.status = 'active'`,
      [id]
    );

    if (!topics || topics.length === 0) {
      return res.status(404).json({ error: '话题不存在' });
    }

    const topic = topics[0];
    topic.tags = typeof topic.tags === 'string' ? JSON.parse(topic.tags || '[]') : (Array.isArray(topic.tags) ? topic.tags : []);

    if (userId) {
      const [follows] = await query(
        'SELECT id FROM topic_follows WHERE user_id = ? AND topic_id = ?',
        [userId, id]
      );
      topic.isFollowed = follows && follows.length > 0;

      const [likes] = await query(
        'SELECT id FROM topic_likes WHERE user_id = ? AND topic_id = ?',
        [userId, id]
      );
      topic.isLiked = likes && likes.length > 0;
    } else {
      topic.isFollowed = false;
      topic.isLiked = false;
    }

    await query('UPDATE topics SET view_count = view_count + 1 WHERE id = ?', [id]);

    res.json({ topic });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/posts', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const userId = req.user?.id;

    const sql = `
      SELECT p.id, p.user_id, p.is_anonymous, p.topic_id, p.content, p.images, p.video_url, p.audio_url, 
             p.file_url, p.location, p.tags, p.links, p.visibility, p.is_top, p.status, p.view_count, 
             p.like_count, p.comment_count, p.share_count, p.created_at, p.updated_at, 
             p.link_title, p.link_description, p.link_image_url, p.link_url, p.post_type, p.poll_source_id,
             p.quote_type, p.quote_id, p.quote_content, p.quote_user_id, p.quote_user_name, p.quote_user_avatar,
             qu.username as quote_user_username,
             COALESCE(source_p.poll_options, p.poll_options) as poll_options,
             COALESCE(source_p.poll_votes, p.poll_votes) as poll_votes,
             COALESCE(source_p.poll_expire_at, p.poll_expire_at) as poll_expire_at,
             COALESCE(source_p.poll_type, p.poll_type) as poll_type,
             COALESCE(source_p.poll_is_anonymous, p.poll_is_anonymous) as poll_is_anonymous,
             COALESCE(source_p.poll_is_public, p.poll_is_public) as poll_is_public,
             u.username, u.nickname, u.avatar
      FROM posts p
      LEFT JOIN posts source_p ON p.poll_source_id = source_p.id
      JOIN users u ON p.user_id = u.id
      LEFT JOIN users qu ON p.quote_user_id = qu.id
      WHERE p.topic_id = ? AND p.status = 'active' AND u.status = 'active'
      ORDER BY p.is_top DESC, p.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [posts] = await query(sql, [parseInt(id), parseInt(limit), parseInt(offset)]);

    const resultPosts = (posts || []).map(post => {
      const userInfo = processAnonymousUser(post, req.user);
      const processedPost = {
        ...post,
        user_id: userInfo.user_id,
        username: userInfo.username,
        nickname: userInfo.nickname,
        avatar: userInfo.avatar,
        images: typeof post.images === 'string' ? JSON.parse(post.images || '[]') : (Array.isArray(post.images) ? post.images : []),
        tags: typeof post.tags === 'string' ? JSON.parse(post.tags || '[]') : (Array.isArray(post.tags) ? post.tags : []),
        links: typeof post.links === 'string' ? JSON.parse(post.links || '[]') : (Array.isArray(post.links) ? post.links : []),
        isLiked: false,
      };

      // 处理链接帖子字段
      if (post.link_url || post.link_title) {
        processedPost.link_info = {
          title: post.link_title,
          description: post.link_description,
          image_url: post.link_image_url,
          url: post.link_url
        };
      }

      // 处理投票帖子字段
      if (post.poll_options) {
        let pollVotes;
        try {
          let pollVotesStr = post.poll_votes;
          if (Buffer.isBuffer(pollVotesStr)) {
            pollVotesStr = pollVotesStr.toString();
          } else if (typeof pollVotesStr !== 'string') {
            pollVotesStr = JSON.stringify(pollVotesStr);
          }
          
          if (!pollVotesStr || pollVotesStr === 'null' || pollVotesStr === 'undefined') {
            pollVotes = {};
          } else {
            pollVotes = JSON.parse(pollVotesStr);
          }
        } catch (error) {
          pollVotes = {};
        }
        
        let pollOptions;
        try {
          let pollOptionsStr = post.poll_options;
          if (Buffer.isBuffer(pollOptionsStr)) {
            pollOptionsStr = pollOptionsStr.toString();
          } else if (typeof pollOptionsStr !== 'string') {
            pollOptionsStr = JSON.stringify(pollOptionsStr);
          }
          
          pollOptions = JSON.parse(pollOptionsStr || '[]');
          if (!Array.isArray(pollOptions)) {
            pollOptions = [];
          }
        } catch (error) {
          pollOptions = [];
        }
        
        if (pollOptions.length >= 2) {
          processedPost.poll_info = {
            options: pollOptions,
            votes: pollVotes,
            expire_at: post.poll_expire_at,
            type: post.poll_type,
            is_anonymous: post.poll_is_anonymous,
            is_public: post.poll_is_public,
            total_votes: Object.values(pollVotes).reduce((sum, votes) => sum + (Array.isArray(votes) ? votes.length : 0), 0)
          };
        }
      }

      return processedPost;
    });

    if (userId && typeof userId === 'number' && !isNaN(userId)) {
      const postIds = resultPosts.map(p => p.id);
      if (postIds.length > 0) {
        const [likes] = await query(
          `SELECT post_id FROM post_likes WHERE user_id = ? AND post_id IN (${postIds.join(',')})`,
          [userId]
        );
        const likedPostIds = new Set(likes.map(l => l.post_id));
        resultPosts.forEach(post => {
          post.isLiked = likedPostIds.has(post.id);
        });
      }
    }

    res.json({ posts: resultPosts, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/comments', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const userId = req.user?.id;

    const sql = `
      SELECT c.*, u.id as user_id, u.username, u.nickname, u.avatar,
             (SELECT COUNT(*) FROM post_comments WHERE parent_id = c.id) as reply_count
       FROM post_comments c
       JOIN users u ON c.user_id = u.id
       JOIN posts p ON c.post_id = p.id
       WHERE p.topic_id = ? AND p.post_type = 'topic_comment' AND c.parent_id IS NULL
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?
    `;

    const [comments] = await query(sql, [parseInt(id), parseInt(limit), parseInt(offset)]);

    const processedComments = (comments || []).map(comment => ({
      ...comment,
      isLiked: false
    }));

    if (userId && processedComments.length > 0) {
      const commentIds = processedComments.map(c => c.id);
      if (commentIds.length > 0) {
        const [likes] = await query(
          `SELECT comment_id FROM comment_likes WHERE user_id = ? AND comment_id IN (${commentIds.join(',')})`,
          [userId]
        );
        const likedCommentIds = new Set(likes.map(l => l.comment_id));
        processedComments.forEach(comment => {
          comment.isLiked = likedCommentIds.has(comment.id);
        });
      }
    }

    res.json({ comments: processedComments, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/comment', authenticate, async (req, res, next) => {
  const { id } = req.params;
  let { content, parentId, is_anonymous = false, quoteId, quote_type } = req.body;
  const userId = req.user.id;

  if (!content || content.trim().length === 0) {
    return res.status(400).json({ error: '评论内容不能为空' });
  }

  try {
    let filteredContent = content;
    try {
      filteredContent = filterSensitiveWords(content);
      if (filteredContent !== content) {
        content = filteredContent;
      }
    } catch (e) {
      console.warn('敏感词过滤失败:', e);
    }

    // 获取引用信息
    let quoteData = {
      quote_type: quote_type || 'none',
      quote_id: quoteId || null,
      quote_content: null,
      quote_user_id: null,
      quote_user_name: null,
      quote_user_avatar: null
    };

    if (quoteId) {
      if (quote_type === 'topic_comment' || quote_type === 'comment') {
        const [quotedComments] = await query(`
          SELECT c.*, u.nickname, u.avatar 
          FROM post_comments c 
          JOIN users u ON c.user_id = u.id 
          WHERE c.id = ?
        `, [quoteId]);
        
        if (quotedComments && quotedComments.length > 0) {
          const qc = quotedComments[0];
          quoteData.quote_content = qc.content;
          quoteData.quote_user_id = qc.user_id;
          quoteData.quote_user_name = qc.nickname;
          quoteData.quote_user_avatar = qc.avatar;
        }
      } else if (quote_type === 'post') {
        const [quotedPosts] = await query(`
          SELECT p.*, u.nickname, u.avatar 
          FROM posts p 
          JOIN users u ON p.user_id = u.id 
          WHERE p.id = ?
        `, [quoteId]);
        
        if (quotedPosts && quotedPosts.length > 0) {
          const qp = quotedPosts[0];
          quoteData.quote_content = qp.content;
          quoteData.quote_user_id = qp.user_id;
          quoteData.quote_user_name = qp.nickname;
          quoteData.quote_user_avatar = qp.avatar;
        }
      }
    }

    let topicPostId;
    const [topicPosts] = await query(
      'SELECT id FROM posts WHERE topic_id = ? AND post_type = ? LIMIT 1',
      [id, 'topic_comment']
    );
    
    if (topicPosts && topicPosts.length > 0) {
      topicPostId = topicPosts[0].id;
    } else {
      const [result] = await query(
        `INSERT INTO posts (user_id, content, visibility, status, is_visible, topic_id, post_type, created_at)
           VALUES (?, ?, 'public', 'active', 1, ?, 'topic_comment', NOW())`,
        [userId, `话题评论`, id]
      );
      topicPostId = result.insertId;
    }

    const [result] = await query(
      `INSERT INTO post_comments (
        post_id, user_id, parent_id, content, is_anonymous, is_visible,
        quote_type, quote_id, quote_content, quote_user_id, quote_user_name, quote_user_avatar,
        created_at
      )
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        topicPostId, userId, parentId || null, content, is_anonymous === 'true' || is_anonymous === true ? 1 : 0,
        quoteData.quote_type, quoteData.quote_id, quoteData.quote_content, 
        quoteData.quote_user_id, quoteData.quote_user_name, quoteData.quote_user_avatar
      ]
    );

    await query('UPDATE topics SET post_count = COALESCE(post_count, 0) + 1 WHERE id = ?', [id]);

    // 给话题作者添加积分（被评论奖励）
    const [topics] = await query('SELECT user_id FROM topics WHERE id = ?', [id]);
    if (topics && topics.length > 0 && topics[0].user_id !== userId) {
      try {
        await addPoints(topics[0].user_id, POINTS_REWARDS.POST_COMMENTED, 'earn', '话题获得评论');
      } catch (error) {
        console.error('话题获得评论添加积分失败:', error);
      }
    }

    const commentId = result.insertId;

    // 处理提及 (@mention)
    try {
      await processMentions({
        content: content || '',
        topicId: id,
        commentId,
        userId,
        io: req.io
      });
    } catch (error) {
      console.error('处理提及失败:', error);
    }

    // 发送通知
    try {
      const [sender] = await query('SELECT nickname, avatar FROM users WHERE id = ?', [userId]);
      
      // 1. 通知话题作者
      if (topics && topics.length > 0 && topics[0].user_id !== userId) {
        const [notifResult] = await query(
          `INSERT INTO notifications (user_id, type, title, content, sender_id, sender_avatar, sender_nickname, related_id, related_type)
           VALUES (?, 'comment', '话题新评论', ?, ?, ?, ?, ?, 'topic')`,
          [topics[0].user_id, '有人评论了你的话题', userId, sender[0].avatar, sender[0].nickname, id]
        );

        if (req.io) {
          req.io.to(`user:${topics[0].user_id}`).emit('notification:new', {
            id: notifResult.insertId,
            type: 'comment',
            title: '话题新评论',
            content: '有人评论了你的话题',
            sender_id: userId,
            sender_nickname: sender[0].nickname,
            sender_avatar: sender[0].avatar,
            related_id: id,
            related_type: 'topic',
            created_at: new Date()
          });
        }
      }

      // 2. 如果是回复，通知被回复的人
      if (parentId) {
        const [parentComment] = await query('SELECT user_id FROM post_comments WHERE id = ?', [parentId]);
        if (parentComment && parentComment.length > 0 && parentComment[0].user_id !== userId && parentComment[0].user_id !== (topics[0]?.user_id)) {
          const [notifResult] = await query(
            `INSERT INTO notifications (user_id, type, title, content, sender_id, sender_avatar, sender_nickname, related_id, related_type)
             VALUES (?, 'comment', '话题新回复', ?, ?, ?, ?, ?, 'topic_comment')`,
            [parentComment[0].user_id, '有人在话题中回复了你的评论', userId, sender[0].avatar, sender[0].nickname, commentId]
          );

          if (req.io) {
            req.io.to(`user:${parentComment[0].user_id}`).emit('notification:new', {
              id: notifResult.insertId,
              type: 'comment',
              title: '话题新回复',
              content: '有人在话题中回复了你的评论',
              sender_id: userId,
              sender_nickname: sender[0].nickname,
              sender_avatar: sender[0].avatar,
              related_id: commentId,
              related_type: 'topic_comment',
              created_at: new Date()
            });
          }
        }
      }
    } catch (notificationError) {
      console.error('发送话题评论通知失败:', notificationError);
    }

    return res.status(201).json({
      message: '评论成功',
      commentId: result.insertId,
    });
  } catch (error) {
    console.error('评论失败:', error);
    if (!res.headersSent) {
      next(error);
    }
  }
});

router.delete('/:id/comment/:commentId', authenticate, async (req, res, next) => {
  try {
    const { id, commentId } = req.params;
    const userId = req.user.id;

    const [comments] = await query(
      'SELECT id, user_id FROM post_comments WHERE id = ?',
      [commentId]
    );

    if (!comments || comments.length === 0) {
      return res.status(404).json({ error: '评论不存在' });
    }

    if (comments[0].user_id !== userId) {
      return res.status(403).json({ error: '无权删除此评论' });
    }

    await query('DELETE FROM post_comments WHERE id = ?', [commentId]);

    // 清理相关的提及和通知
    try {
      await cleanupMentions({ commentId: commentId });
    } catch (error) {
      console.error('清理提及失败:', error);
    }

    // 更新话题帖子数
    await query('UPDATE topics SET post_count = GREATEST(0, post_count - 1) WHERE id = ?', [id]);

    res.json({ message: '评论已删除' });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/comment/:commentId/replies', optionalAuth, async (req, res, next) => {
  try {
    const { id, commentId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [replies] = await query(
      `SELECT c.*, u.id as user_id, u.username, u.nickname, u.avatar,
              parent_user.nickname as reply_to_nickname
       FROM post_comments c
       JOIN users u ON c.user_id = u.id
       LEFT JOIN post_comments parent ON c.parent_id = parent.id
       LEFT JOIN users parent_user ON parent.user_id = parent_user.id
       WHERE c.parent_id = ?
       ORDER BY c.created_at ASC
       LIMIT ? OFFSET ?`,
      [commentId, parseInt(limit), parseInt(offset)]
    );

    const processedReplies = (replies || []).map(reply => ({
      ...reply,
      isLiked: false
    }));

    if (req.user?.id) {
      const [likes] = await query(
        `SELECT comment_id FROM comment_likes WHERE user_id = ? AND comment_id IN (?)`,
        [req.user.id, processedReplies.map(r => r.id)]
      );
      const likedIds = new Set(likes.map(l => l.comment_id));
      processedReplies.forEach(reply => {
        reply.isLiked = likedIds.has(reply.id);
      });
    }

    res.json({ replies: processedReplies, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/comment/:commentId/like', authenticate, async (req, res, next) => {
  try {
    const { id, commentId } = req.params;
    const userId = req.user.id;

    const [existing] = await query(
      'SELECT id FROM comment_likes WHERE user_id = ? AND comment_id = ?',
      [userId, commentId]
    );

    if (existing && existing.length > 0) {
      await query('DELETE FROM comment_likes WHERE user_id = ? AND comment_id = ?', [userId, commentId]);
      await query('UPDATE post_comments SET like_count = GREATEST(0, like_count - 1) WHERE id = ?', [commentId]);
      res.json({ message: '已取消点赞', liked: false });
    } else {
      await query(
        'INSERT INTO comment_likes (comment_id, user_id, created_at) VALUES (?, ?, NOW())',
        [commentId, userId]
      );
      await query('UPDATE post_comments SET like_count = like_count + 1 WHERE id = ?', [commentId]);

      // 发送通知
      try {
        const [comments] = await query('SELECT user_id FROM post_comments WHERE id = ?', [commentId]);
        if (comments && comments.length > 0 && comments[0].user_id !== userId) {
          const [sender] = await query('SELECT nickname, avatar FROM users WHERE id = ?', [userId]);
          await query(
            `INSERT INTO notifications (user_id, type, title, content, sender_id, sender_avatar, sender_nickname, related_id, related_type)
             VALUES (?, 'like', '评论收到点赞', ?, ?, ?, ?, ?, 'comment')`,
            [comments[0].user_id, '有人点赞了你的评论', userId, sender[0].avatar, sender[0].nickname, commentId]
          );
        }
      } catch (notificationError) {
        console.error('发送评论点赞通知失败:', notificationError);
      }

      res.json({ message: '点赞成功', liked: true });
    }
  } catch (error) {
    next(error);
  }
});

router.post('/:id/follow', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [existing] = await query(
      'SELECT id FROM topic_follows WHERE user_id = ? AND topic_id = ?',
      [userId, id]
    );

    if (existing && existing.length > 0) {
      await query('DELETE FROM topic_follows WHERE user_id = ? AND topic_id = ?', [userId, id]);
      await query('UPDATE topics SET follow_count = GREATEST(0, follow_count - 1) WHERE id = ?', [id]);
      res.json({ message: '已取消关注', followed: false });
    } else {
      await query(
        'INSERT INTO topic_follows (topic_id, user_id, created_at) VALUES (?, ?, NOW())',
        [id, userId]
      );
      await query('UPDATE topics SET follow_count = follow_count + 1 WHERE id = ?', [id]);

      // 发送通知
      try {
        const [topics] = await query('SELECT user_id FROM topics WHERE id = ?', [id]);
        if (topics && topics.length > 0 && topics[0].user_id !== userId) {
          const [sender] = await query('SELECT nickname, avatar FROM users WHERE id = ?', [userId]);
          await query(
            `INSERT INTO notifications (user_id, type, title, content, sender_id, sender_avatar, sender_nickname, related_id, related_type)
             VALUES (?, 'follow', '话题新关注', ?, ?, ?, ?, ?, 'topic')`,
            [topics[0].user_id, '有人关注了你的话题', userId, sender[0].avatar, sender[0].nickname, id]
          );
        }
      } catch (notificationError) {
        console.error('发送话题关注通知失败:', notificationError);
      }

      res.json({ message: '关注成功', followed: true });
    }
  } catch (error) {
    next(error);
  }
});

router.post('/:id/like', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [existing] = await query(
      'SELECT id FROM topic_likes WHERE user_id = ? AND topic_id = ?',
      [userId, id]
    );

    if (existing && existing.length > 0) {
      await query('DELETE FROM topic_likes WHERE user_id = ? AND topic_id = ?', [userId, id]);
      await query('UPDATE topics SET like_count = GREATEST(0, like_count - 1) WHERE id = ?', [id]);
      res.json({ message: '已取消点赞', liked: false });
    } else {
      await query(
        'INSERT INTO topic_likes (topic_id, user_id, created_at) VALUES (?, ?, NOW())',
        [id, userId]
      );
      await query('UPDATE topics SET like_count = like_count + 1 WHERE id = ?', [id]);

      // 发送通知
      try {
        const [topics] = await query('SELECT user_id FROM topics WHERE id = ?', [id]);
        if (topics && topics.length > 0 && topics[0].user_id !== userId) {
          const [sender] = await query('SELECT nickname, avatar FROM users WHERE id = ?', [userId]);
          await query(
            `INSERT INTO notifications (user_id, type, title, content, sender_id, sender_avatar, sender_nickname, related_id, related_type)
             VALUES (?, 'like', '话题收到点赞', ?, ?, ?, ?, ?, 'topic')`,
            [topics[0].user_id, '有人点赞了你的话题', userId, sender[0].avatar, sender[0].nickname, id]
          );
        }
      } catch (notificationError) {
        console.error('发送话题点赞通知失败:', notificationError);
      }

      res.json({ message: '点赞成功', liked: true });
    }
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [topics] = await query('SELECT user_id FROM topics WHERE id = ?', [id]);

    if (!topics || topics.length === 0) {
      return res.status(404).json({ error: '话题不存在' });
    }

    if (topics[0].user_id !== userId) {
      return res.status(403).json({ error: '无权删除此话题' });
    }

    await query('UPDATE topics SET status = ? WHERE id = ?', ['deleted', id]);

    // 清理相关的提及和通知
    try {
      await cleanupMentions({ topicId: id });
    } catch (error) {
      console.error('清理提及失败:', error);
    }

    res.json({ message: '话题已删除' });
  } catch (error) {
    next(error);
  }
});

export default router;
