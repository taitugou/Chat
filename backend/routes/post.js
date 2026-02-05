import express from 'express';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { query } from '../database/connection.js';
import { cacheMiddleware } from '../middleware/cache.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { filterSensitiveWords } from '../utils/sensitiveWords.js';
import { addPoints, consumePoints, POINTS_REWARDS, POINTS_COSTS } from '../services/pointsService.js';
import { updateTaskProgress } from '../utils/taskManager.js';
import { processMentions, cleanupMentions } from '../utils/mentionHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// 预览链接
router.post('/preview-link', async (req, res, next) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL不能为空' });
    }
    
    // 验证URL格式
    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json({ error: 'URL格式无效' });
    }
    
    const linkPreview = await generateLinkPreview(url);
    
    if (!linkPreview) {
      return res.status(400).json({ error: '无法获取链接预览' });
    }
    
    res.json(linkPreview);
  } catch (error) {
    next(error);
  }
});

// 配置文件上传
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/posts');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const originalName = path.basename(file.originalname, ext).replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}_${originalName}${ext}`;
    cb(null, filename);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    // 允许常见文件类型
    const allowedMimeTypes = [
      'image/', 'video/', 'audio/', 
      'application/pdf', 
      'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/zip',
      'application/x-zip-compressed',
      'text/plain'
    ];
    
    const isAllowed = allowedMimeTypes.some(type => file.mimetype.startsWith(type));
    
    if (isAllowed) {
      cb(null, true);
    } else {
      // 如果不是上述类型，我们也允许，但你可以根据需要添加更多限制
      cb(null, true);
    }
  },
});

// 链接预览生成函数
async function generateLinkPreview(url) {
  try {
    if (!url) return null;
    
    // 自动补全协议
    if (!/^https?:\/\//i.test(url)) {
      url = 'http://' + url;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      redirect: 'follow',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error('链接预览请求失败:', response.status, response.statusText);
      return null;
    }
    
    const html = await response.text();
    
    if (!html || html.length === 0) {
      console.error('链接预览响应为空');
      return null;
    }
    
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';
    
    const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"[^>]*>/i);
    const description = descMatch ? descMatch[1].trim() : '';
    
    const imgMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"[^>]*>/i);
    let imageUrl = imgMatch ? imgMatch[1].trim() : '';
    
    return {
      title,
      description,
      imageUrl,
      url
    };
  } catch (error) {
    console.error('生成链接预览失败:', error.message);
    return null;
  }
}

// 帖子置顶
router.post('/:id/pin', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // 检查帖子所有权
    const [posts] = await query('SELECT user_id FROM posts WHERE id = ?', [id]);
    if (!posts || posts.length === 0) {
      console.log('未找到帖子, ID:', id);
      return res.status(404).json({ error: '帖子不存在' });
    }

    if (posts[0].user_id !== userId) {
      return res.status(403).json({ error: '只能置顶自己的帖子' });
    }

    await query('UPDATE posts SET is_top = 1 WHERE id = ?', [id]);

    res.json({ message: '帖子已置顶' });
  } catch (error) {
    next(error);
  }
});

// 取消置顶
router.post('/:id/unpin', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await query('UPDATE posts SET is_top = 0 WHERE id = ? AND user_id = ?', [id, userId]);

    res.json({ message: '已取消置顶' });
  } catch (error) {
    next(error);
  }
});

// 推广帖子（使用积分）
router.post('/:id/promote', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { days = 1 } = req.body;
    
    // 检查帖子是否存在且属于当前用户
    const [posts] = await query('SELECT user_id FROM posts WHERE id = ?', [id]);
      if (!posts || posts.length === 0) {
        return res.status(404).json({ error: '帖子不存在' });
      }
    
    if (posts[0].user_id !== userId) {
      return res.status(403).json({ error: '只能推广自己的帖子' });
    }
    
    // 计算推广所需积分
    const pointsRequired = POINTS_COSTS.PROMOTE_POST_PER_DAY * parseInt(days);
    
    // 消耗积分
    await consumePoints(userId, pointsRequired, `推广帖子（${days}天）`);
    
    // 设置帖子为置顶（推广效果）
    await query('UPDATE posts SET is_top = 1 WHERE id = ?', [id]);
    
    res.json({
      message: '帖子推广成功',
      pointsConsumed: pointsRequired,
      promotedDays: days
    });
  } catch (error) {
    if (error.message === '积分不足') {
      return res.status(400).json({ error: '积分不足，无法推广帖子' });
    }
    next(error);
  }
});

// 发布帖子
router.post('/', authenticate, upload.array('media', 9), async (req, res, next) => {
  try {
    let { content, tags, visibility = 'public', post_type = 'text', is_anonymous = false } = req.body;
    const userId = req.user.id;

    console.log('发布帖子请求:', { userId, content, post_type, hasLinkUrl: !!req.body.link_url, hasLinks: !!req.body.links, quote_id: !!req.body.quote_id });

    if ((!content || content.trim().length === 0) && 
        post_type !== 'poll' && 
        post_type !== 'link' && 
        post_type !== 'poll_with_link' &&
        !req.body.quote_id) {
      return res.status(400).json({ error: '帖子内容不能为空' });
    }

    if (content && content.length > 2000) {
      return res.status(400).json({ error: '帖子内容不能超过2000字' });
    }

    // 敏感词过滤
    let filteredContent = content ? filterSensitiveWords(content) : '';
    if (filteredContent !== content) {
      content = filteredContent;
    }

    // 处理上传的文件
    const mediaFiles = req.files || [];
    const images = [];
    const videos = [];
    const audioUrls = [];
    const files = [];

    for (const file of mediaFiles) {
      const fileUrl = `/uploads/posts/${file.filename}`;
      const mimeType = file.mimetype;
      
      if (mimeType.startsWith('image/')) {
        images.push(fileUrl);
      } else if (mimeType.startsWith('video/')) {
        videos.push(fileUrl);
      } else if (mimeType.startsWith('audio/')) {
        audioUrls.push(fileUrl);
      } else {
        files.push(fileUrl);
      }
    }

    // 解析标签
    let tagArray = [];
    if (tags) {
      if (Array.isArray(tags)) {
        tagArray = tags;
      } else if (typeof tags === 'string') {
        try {
          tagArray = JSON.parse(tags);
        } catch (e) {
          tagArray = tags.split(',');
        }
      }
    }
    
    // 解析链接
    let linksArray = [];
    if (req.body.links) {
      try {
        linksArray = typeof req.body.links === 'string' ? JSON.parse(req.body.links) : req.body.links;
      } catch (error) {
        console.error('解析链接失败:', error);
      }
    }

    // 初始化帖子数据
    let postData = {
      user_id: userId,
      content: content || '',
      images: JSON.stringify(images),
      video_url: videos.length > 0 ? videos[0] : null,
      audio_url: audioUrls.length > 0 ? audioUrls[0] : null,
      file_url: files.length > 0 ? files[0] : null,
      tags: JSON.stringify(tagArray),
      visibility,
      status: 'active',
      is_visible: 1,
      post_type
    };
    
    // 处理引用功能
    if (req.body.quote_id) {
      postData.quote_id = parseInt(req.body.quote_id);
      postData.quote_type = req.body.quote_type || 'post';
      
      // 获取被引用内容的信息
      let quoteUserInfo = null;
      
      if (req.body.quote_type === 'post' || !req.body.quote_type) {
        // 引用帖子
        const [quotedPosts] = await query('SELECT * FROM posts WHERE id = ?', [req.body.quote_id]);
        if (quotedPosts && quotedPosts.length > 0) {
          const quotedPost = quotedPosts[0];
          postData.quote_content = quotedPost.content;
          
          // 获取被引用帖子的作者信息
          const [quotedUsers] = await query('SELECT id, nickname, avatar FROM users WHERE id = ?', [quotedPost.user_id]);
          if (quotedUsers && quotedUsers.length > 0) {
            quoteUserInfo = quotedUsers[0];
          }
        }
      } else if (req.body.quote_type === 'comment' || req.body.quote_type === 'topic_comment') {
        // 引用评论或话题评论
        const [quotedComments] = await query(`
          SELECT c.*, u.id as user_id, u.nickname, u.avatar 
          FROM post_comments c 
          JOIN users u ON c.user_id = u.id 
          WHERE c.id = ?
        `, [req.body.quote_id]);
        
        if (quotedComments && quotedComments.length > 0) {
          const quotedComment = quotedComments[0];
          postData.quote_content = quotedComment.content;
          quoteUserInfo = { 
            id: quotedComment.user_id, 
            nickname: quotedComment.nickname, 
            avatar: quotedComment.avatar 
          };
        }
      } else if (req.body.quote_type === 'topic') {
        // 引用话题
        const [quotedTopics] = await query(`
          SELECT t.*, u.id as user_id, u.nickname, u.avatar 
          FROM topics t 
          JOIN users u ON t.user_id = u.id 
          WHERE t.id = ?
        `, [req.body.quote_id]);
        
        if (quotedTopics && quotedTopics.length > 0) {
          const quotedTopic = quotedTopics[0];
          postData.quote_content = quotedTopic.title + (quotedTopic.description ? ': ' + quotedTopic.description : '');
          quoteUserInfo = { 
            id: quotedTopic.user_id, 
            nickname: quotedTopic.nickname, 
            avatar: quotedTopic.avatar 
          };
        }
      }
      
      // 保存被引用用户的信息
      if (quoteUserInfo) {
        postData.quote_user_id = quoteUserInfo.id;
        postData.quote_user_name = quoteUserInfo.nickname;
        postData.quote_user_avatar = quoteUserInfo.avatar;
      }
    } else {
      postData.quote_type = 'none';
    }
    
    // 保存多个链接为JSON
    if (linksArray.length > 0) {
      postData.links = JSON.stringify(linksArray);
    }

    // 处理话题ID
    if (req.body.topic_id) {
      postData.topic_id = parseInt(req.body.topic_id);
    }

      // 处理链接数据（无论帖子类型是什么，只要提供了链接就处理）
    if (req.body.link_url) {
      let link_url = req.body.link_url;
      
      // 自动补全协议
      if (link_url && !/^https?:\/\//i.test(link_url)) {
        link_url = 'http://' + link_url;
      }

      console.log('开始生成链接预览:', link_url);
      // 生成链接预览
      const linkPreview = await generateLinkPreview(link_url);
      console.log('链接预览结果:', linkPreview);
      if (linkPreview) {
        postData.link_title = linkPreview.title;
        postData.link_description = linkPreview.description;
        postData.link_image_url = linkPreview.imageUrl;
        postData.link_url = linkPreview.url;
      } else {
        postData.link_url = link_url;
      }
    }
    
    // 处理投票数据（无论帖子类型是什么，只要提供了投票选项就处理）
    if (req.body.poll_options) {
      const { poll_options, poll_type = 'single', poll_expire_days = 1, 
             poll_is_anonymous = false, poll_is_public = true } = req.body;
      
      // 解析投票选项
      const parsedPollOptions = typeof poll_options === 'string' ? JSON.parse(poll_options) : poll_options;
      
      // 验证投票选项是否为有效数组
      if (!Array.isArray(parsedPollOptions) || parsedPollOptions.length < 2 || parsedPollOptions.length > 6) {
        return res.status(400).json({ error: '投票帖子必须包含2-6个选项' });
      }
      
      // 验证每个选项都不为空
      const validOptions = parsedPollOptions.filter(opt => opt && opt.trim().length > 0);
      if (validOptions.length < 2) {
        return res.status(400).json({ error: '投票选项不能为空' });
      }
      
      // 验证投票类型
      if (!['single', 'multiple', 'rating'].includes(poll_type)) {
        return res.status(400).json({ error: '无效的投票类型' });
      }
      
      // 计算投票过期时间
      const poll_expire_at = new Date();
      poll_expire_at.setDate(poll_expire_at.getDate() + parseInt(poll_expire_days));
      
      // 初始化投票数据
    postData.poll_options = JSON.stringify(parsedPollOptions);
    postData.poll_votes = JSON.stringify({}); // 初始化为空对象
    postData.poll_expire_at = poll_expire_at;
    postData.poll_type = poll_type;
    postData.poll_is_anonymous = poll_is_anonymous === 'true' || poll_is_anonymous === true ? 1 : 0;
    postData.poll_is_public = poll_is_public === 'true' || poll_is_public === true ? 1 : 0;
    }
    
    // 处理音频帖子必须包含音频文件的情况（如果是纯音频类型）
    if (post_type === 'audio' && audioUrls.length === 0) {
      return res.status(400).json({ error: '语音帖子必须包含音频文件' });
    }
    
    // 处理视频帖子必须包含视频文件的情况（如果是纯视频类型）
    if (post_type === 'video' && videos.length === 0) {
      return res.status(400).json({ error: '视频帖子必须包含视频文件' });
    }
    
    // 处理图片帖子必须包含图片文件的情况（如果是纯图片类型）
    if (post_type === 'image' && images.length === 0) {
      return res.status(400).json({ error: '图片帖子必须包含图片文件' });
    }

    // 构建SQL插入语句
    const columns = Object.keys(postData);
    const values = Object.values(postData);
    const placeholders = columns.map(() => '?').join(', ');
    
    const sql = `INSERT INTO posts (${columns.join(', ')}, created_at)
                VALUES (${placeholders}, NOW())`;
    
    // 插入帖子
    const [result] = await query(sql, values);
    const postId = result.insertId;

    // 处理提及 (@mention)
    try {
      await processMentions({
        content: content || '',
        postId,
        userId,
        io: req.io
      });
    } catch (error) {
      console.error('处理提及失败:', error);
    }

    // 如果帖子关联了话题，更新话题的帖子数
    if (req.body.topic_id) {
      const topicId = parseInt(req.body.topic_id);
      try {
        await query('UPDATE topics SET post_count = post_count + 1 WHERE id = ?', [topicId]);
        console.log('更新话题帖子数:', topicId);
      } catch (error) {
        console.error('更新话题帖子数失败:', error);
      }
    }

    try {
      await updateTaskProgress(userId, '发布3篇帖子');
      await updateTaskProgress(userId, '累计发布50帖');
    } catch (error) {
      console.error('更新任务失败:', error);
    }

    res.status(201).json({
      message: '帖子发布成功',
      postId: result.insertId,
    });
  } catch (error) {
    next(error);
  }
});

// 处理匿名用户信息
function processAnonymousUser(post, currentUser) {
  if (post.is_anonymous) {
    const isAdmin = currentUser && currentUser.username === 'admin';
    
    if (!isAdmin) {
      return {
        user_id: post.user_id,
        username: '匿名用户',
        nickname: '匿名用户',
        avatar: null
      };
    }
  }
  return {
    user_id: post.user_id,
    username: post.username,
    nickname: post.nickname,
    avatar: post.avatar
  };
}

// 获取帖子列表（首页时间线）
router.get('/timeline', optionalAuth, cacheMiddleware(30), async (req, res, next) => {
  try {
    const { page = 1, limit = 20, type, content_type = 'recommended', sort, username } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const userId = req.user?.id;

    let posts = [];
    const queryParams = [];
    let baseSql = `
      SELECT p.id, p.user_id, p.is_anonymous, p.topic_id, p.content, p.images, p.video_url, p.audio_url, 
             p.file_url, p.location, p.tags, p.links, p.visibility, p.is_top, p.status, p.is_visible, p.view_count, 
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
      WHERE p.status = "active" AND p.is_visible = 1 AND u.status = "active" AND p.post_type != 'topic_comment'
    `;

    // 如果指定了用户名，添加过滤条件
    if (username) {
      baseSql += ` AND u.username = ?`;
      queryParams.push(username);
    }

    // 构建排序子句
    let orderByClause = '';
    if (sort === 'latest') {
      // 按最新排序
      orderByClause = ` ORDER BY p.is_top DESC, p.created_at DESC`;
    } else if (sort === 'hot') {
      // 按最热排序
      orderByClause = ` ORDER BY p.is_top DESC, ((COALESCE(p.like_count, 0) + COALESCE(p.comment_count, 0) * 2 + COALESCE(p.share_count, 0) * 3 + COALESCE(p.view_count, 0) * 0.1) / POW(GREATEST(TIMESTAMPDIFF(HOUR, p.created_at, NOW()), 0) + 2, 1.5)) DESC, p.created_at DESC`;
    } else {
      // 默认排序（根据content_type）
      if (content_type === 'recommended') {
        orderByClause = ` ORDER BY p.is_top DESC, p.created_at DESC`;
      } else {
        orderByClause = ` ORDER BY p.is_top DESC, (p.like_count + p.comment_count * 2 + p.share_count * 3) DESC, p.created_at DESC`;
      }
    }

    // 根据内容类型获取不同的帖子列表
    switch (content_type) {
      case 'following': {
        // 关注用户帖子
        if (!userId) {
          return res.status(401).json({ error: '登录后才能查看关注用户的帖子' });
        }
        
        const [followingIdsResult] = await query(
          `SELECT friend_id FROM user_friends WHERE user_id = ?`,
          [userId]
        );
        const followingIds = followingIdsResult.map(f => f.friend_id);
        
        if (followingIds.length === 0) {
          posts = [];
        } else {
          const whereClause = ` AND p.user_id IN (${followingIds.join(',')})`;
          const sql = baseSql + whereClause + orderByClause + ` LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;
          const [followingPosts] = await query(sql, queryParams);
          posts = followingPosts;
        }
        break;
      }
      
      case 'hot': {
        // 热门话题帖子
        const sql = baseSql + orderByClause + ` LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;
        const [hotPosts] = await query(sql, queryParams);
        posts = hotPosts;
        break;
      }
      
      case 'system': {
        // 系统推荐帖子
        const sql = baseSql + orderByClause + ` LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;
        const [systemPosts] = await query(sql, queryParams);
        posts = systemPosts;
        break;
      }
      
      case 'recommended':
      default: {
        const sql = baseSql + orderByClause + ` LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;
        const [recommendedPosts] = await query(sql, queryParams);
        posts = recommendedPosts;
        break;
      }
    }

    // 处理帖子数据
    const resultPosts = (posts || []).map(post => {
      const userInfo = processAnonymousUser(post, req.user);
      
      // 基础字段处理
      const processedPost = {
        ...post,
        user_id: userInfo.user_id,
        username: userInfo.username,
        nickname: userInfo.nickname,
        avatar: userInfo.avatar,
        images: typeof post.images === 'string' ? JSON.parse(post.images) : (Array.isArray(post.images) ? post.images : []),
        tags: typeof post.tags === 'string' ? JSON.parse(post.tags) : (Array.isArray(post.tags) ? post.tags : []),
        links: typeof post.links === 'string' ? JSON.parse(post.links || '[]') : (Array.isArray(post.links) ? post.links : []),
        isLiked: false, // 默认值为false
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
        // 修复：确保 poll_votes 是字符串，处理 Buffer 对象和其他类型
        let pollVotes;
        try {
          // 确保 poll_votes 是字符串，处理 Buffer 对象和其他类型
          let pollVotesStr = post.poll_votes;
          if (Buffer.isBuffer(pollVotesStr)) {
            pollVotesStr = pollVotesStr.toString();
          } else if (typeof pollVotesStr !== 'string') {
            pollVotesStr = JSON.stringify(pollVotesStr);
          }
          
          // 修复：当 poll_votes 为空字符串、null 或 undefined 时，将其视为空对象
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
          // 确保 poll_options 是字符串，处理 Buffer 对象和其他类型
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
        
        // 只有在有有效投票选项时才创建 poll_info
        if (pollOptions.length >= 2) {
          processedPost.poll_info = {
            options: pollOptions,
            votes: pollVotes,
            expire_at: post.poll_expire_at,
            type: post.poll_type,
            is_anonymous: post.poll_is_anonymous,
            is_public: post.poll_is_public,
            // 计算总投票数
            total_votes: Object.values(pollVotes).reduce((sum, votes) => sum + (Array.isArray(votes) ? votes.length : 0), 0)
          };
        }
      }
      
      return processedPost;
    });

    // 如果用户已登录，查询点赞状态
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

    res.json({ posts: resultPosts, page: parseInt(page), limit: parseInt(limit), content_type });
  } catch (error) {
    next(error);
  }
});

// 获取帖子详情
router.get('/:id', optionalAuth, cacheMiddleware(60), async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const [posts] = await query(
      `SELECT p.id, p.user_id, p.is_anonymous, p.topic_id, p.content, p.images, p.video_url, p.audio_url, 
              p.file_url, p.location, p.tags, p.links, p.visibility, p.is_top, p.status, p.is_visible, p.view_count, 
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
       WHERE p.id = ? AND p.status = 'active' AND p.is_visible = 1`,
      [id]
    );

    if (!posts || posts.length === 0) {
      return res.status(404).json({ error: '帖子不存在' });
    }

    const post = posts[0];
    
    const userInfo = processAnonymousUser(post, req.user);
    post.user_id = userInfo.user_id;
    post.username = userInfo.username;
    post.nickname = userInfo.nickname;
    post.avatar = userInfo.avatar;
    
    // 确保images和tags字段正确解析
    try {
      post.images = typeof post.images === 'string' ? JSON.parse(post.images || '[]') : (Array.isArray(post.images) ? post.images : []);
      post.tags = typeof post.tags === 'string' ? JSON.parse(post.tags || '[]') : (Array.isArray(post.tags) ? post.tags : []);
      post.links = typeof post.links === 'string' ? JSON.parse(post.links || '[]') : (Array.isArray(post.links) ? post.links : []);
    } catch (e) {
      post.images = [];
      post.tags = [];
      post.links = [];
    }

    // 处理链接帖子字段
    if (post.link_url || post.link_title) {
      post.link_info = {
        title: post.link_title,
        description: post.link_description,
        image_url: post.link_image_url,
        url: post.link_url
      };
    }
    
    // 处理投票帖子字段
    if (post.poll_options) {
      // 修复：确保 poll_votes 是字符串，处理 Buffer 对象和其他类型
      let pollVotes;
      try {
        // 确保 poll_votes 是字符串，处理 Buffer 对象和其他类型
        let pollVotesStr = post.poll_votes;
        if (Buffer.isBuffer(pollVotesStr)) {
          pollVotesStr = pollVotesStr.toString();
        } else if (typeof pollVotesStr !== 'string') {
          pollVotesStr = JSON.stringify(pollVotesStr);
        }
        
        // 修复：当 poll_votes 为空字符串、null 或 undefined 时，将其视为空对象
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
        // 确保 poll_options 是字符串，处理 Buffer 对象和其他类型
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
      
      // 只有在有有效投票选项时才创建 poll_info
      if (pollOptions.length >= 2) {
        post.poll_info = {
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

    // 检查是否已点赞
    if (userId) {
      const [likes] = await query(
        'SELECT id FROM post_likes WHERE user_id = ? AND post_id = ?',
        [userId, id]
      );
      post.isLiked = likes && likes.length > 0;
    }

    await query('UPDATE posts SET view_count = view_count + 1 WHERE id = ?', [id]);

    res.json({ post });
  } catch (error) {
    next(error);
  }
});

// 点赞帖子
router.post('/:id/like', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // 检查是否已点赞
    const [existing] = await query(
      'SELECT id FROM post_likes WHERE user_id = ? AND post_id = ?',
      [userId, id]
    );

    if (existing && existing.length > 0) {
      // 取消点赞
      await query('DELETE FROM post_likes WHERE user_id = ? AND post_id = ?', [userId, id]);
      await query('UPDATE posts SET like_count = GREATEST(0, like_count - 1) WHERE id = ?', [id]);
      
      // 更新累计点赞成就进度 (减少)
      const [posts] = await query('SELECT user_id FROM posts WHERE id = ?', [id]);
      if (posts && posts.length > 0) {
          try {
              await updateTaskProgress(posts[0].user_id, '累计获得100赞', -1);
          } catch (error) {
              console.error('更新累计点赞任务失败:', error);
          }
      }

      res.json({ message: '已取消点赞', liked: false });
    } else {
      // 点赞
      await query(
        'INSERT INTO post_likes (user_id, post_id, created_at) VALUES (?, ?, NOW())',
        [userId, id]
      );
      await query('UPDATE posts SET like_count = like_count + 1 WHERE id = ?', [id]);

      // 给帖子作者添加积分（被点赞奖励）
      const [posts] = await query('SELECT user_id FROM posts WHERE id = ?', [id]);
      if (posts && posts.length > 0) {
        if (posts[0].user_id !== userId) {
          try {
            await addPoints(posts[0].user_id, POINTS_REWARDS.POST_LIKED, 'earn', '帖子获得点赞');
          } catch (error) {
            console.error('添加积分失败:', error);
          }
        }
        
        // 更新作者累计点赞成就
        try {
            await updateTaskProgress(posts[0].user_id, '累计获得100赞');
        } catch (error) {
            console.error('更新累计点赞任务失败:', error);
        }

        // 发送通知
        if (posts[0].user_id !== userId) {
          try {
            const [sender] = await query('SELECT nickname, avatar FROM users WHERE id = ?', [userId]);
            const [result] = await query(
              `INSERT INTO notifications (user_id, type, title, content, sender_id, sender_avatar, sender_nickname, related_id, related_type)
               VALUES (?, 'like', '收到点赞', ?, ?, ?, ?, ?, 'post')`,
              [posts[0].user_id, '有人点赞了你的帖子', userId, sender[0].avatar, sender[0].nickname, id]
            );

            // 发送 Socket.IO 实时通知
            if (req.io) {
              req.io.to(`user:${posts[0].user_id}`).emit('notification:new', {
                id: result.insertId,
                type: 'like',
                title: '收到点赞',
                content: '有人点赞了你的帖子',
                sender_id: userId,
                sender_nickname: sender[0].nickname,
                sender_avatar: sender[0].avatar,
                related_id: id,
                related_type: 'post',
                created_at: new Date()
              });
            }
          } catch (notificationError) {
            console.error('发送点赞通知失败:', notificationError);
          }
        }
      }
      
      // 更新点赞者任务进度
      try {
          await updateTaskProgress(userId, '点赞5次');
      } catch (error) {
          console.error('更新点赞任务失败:', error);
      }

      res.json({ message: '点赞成功', liked: true });
    }
  } catch (error) {
    next(error);
  }
});

// 评论帖子
router.post('/:id/comment', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    let { content, parentId, quoteId, is_anonymous } = req.body;
    const userId = req.user.id;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: '评论内容不能为空' });
    }

    // 敏感词过滤
    let filteredContent = filterSensitiveWords(content);
    if (filteredContent !== content) {
      content = filteredContent;
    }

    // 处理引用功能
    let commentData = {
      post_id: id,
      user_id: userId,
      parent_id: parentId || null,
      is_anonymous: is_anonymous ? 1 : 0,
      is_visible: 1,
      content
    };

    if (quoteId) {
      commentData.quote_id = parseInt(quoteId);
      commentData.quote_type = req.body.quote_type || 'comment';
      
      // 获取被引用评论的信息
      const [quotedComments] = await query(`
        SELECT c.*, u.id as user_id, u.nickname, u.avatar 
        FROM post_comments c 
        JOIN users u ON c.user_id = u.id 
        WHERE c.id = ?
      `, [quoteId]);
      
      if (quotedComments && quotedComments.length > 0) {
        const quotedComment = quotedComments[0];
        commentData.quote_content = quotedComment.content;
        commentData.quote_user_id = quotedComment.user_id;
        commentData.quote_user_name = quotedComment.nickname;
      }
    }

    const columns = Object.keys(commentData);
    const values = Object.values(commentData);
    const placeholders = columns.map(() => '?').join(', ');
    
    const [result] = await query(
      `INSERT INTO post_comments (${columns.join(', ')}, created_at)
       VALUES (${placeholders}, NOW())`,
      values
    );

    // 更新帖子评论数
    await query('UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?', [id]);

    // 如果该帖子属于某个话题，也增加话题的 post_count
    const [topicInfo] = await query('SELECT topic_id FROM posts WHERE id = ?', [id]);
    if (topicInfo && topicInfo.length > 0 && topicInfo[0].topic_id) {
      await query('UPDATE topics SET post_count = post_count + 1 WHERE id = ?', [topicInfo[0].topic_id]);
    }

    // 给帖子作者添加积分（被评论奖励）
    const [posts] = await query('SELECT user_id FROM posts WHERE id = ?', [id]);
    if (posts && posts.length > 0 && posts[0].user_id !== userId) {
      try {
        await addPoints(posts[0].user_id, POINTS_REWARDS.POST_COMMENTED, 'earn', '帖子获得评论');
      } catch (error) {
        console.error('添加积分失败:', error);
      }
    }

    // 更新评论者任务进度
    try {
      await updateTaskProgress(userId, '评论3次');
    } catch (error) {
      console.error('更新评论任务失败:', error);
    }

    // 处理提及 (@mention)
    try {
      await processMentions({
        content: content || '',
        postId: id,
        commentId: result.insertId,
        userId,
        io: req.io
      });
    } catch (error) {
      console.error('处理提及失败:', error);
    }

    // 发送通知
    try {
      const [sender] = await query('SELECT nickname, avatar FROM users WHERE id = ?', [userId]);
      const commentId = result.insertId;

      // 1. 通知帖子作者
      if (posts && posts.length > 0 && posts[0].user_id !== userId) {
        const [notifResult] = await query(
          `INSERT INTO notifications (user_id, type, title, content, sender_id, sender_avatar, sender_nickname, related_id, related_type)
           VALUES (?, 'comment', '新评论', ?, ?, ?, ?, ?, 'post')`,
          [posts[0].user_id, '有人评论了你的帖子', userId, sender[0].avatar, sender[0].nickname, id]
        );

        if (req.io) {
          req.io.to(`user:${posts[0].user_id}`).emit('notification:new', {
            id: notifResult.insertId,
            type: 'comment',
            title: '新评论',
            content: '有人评论了你的帖子',
            sender_id: userId,
            sender_nickname: sender[0].nickname,
            sender_avatar: sender[0].avatar,
            related_id: id,
            related_type: 'post',
            created_at: new Date()
          });
        }
      }

      // 2. 如果是回复，通知被回复的人
      if (parentId) {
        const [parentComment] = await query('SELECT user_id FROM post_comments WHERE id = ?', [parentId]);
        if (parentComment && parentComment.length > 0 && parentComment[0].user_id !== userId && parentComment[0].user_id !== posts[0].user_id) {
          const [notifResult] = await query(
            `INSERT INTO notifications (user_id, type, title, content, sender_id, sender_avatar, sender_nickname, related_id, related_type)
             VALUES (?, 'comment', '新回复', ?, ?, ?, ?, ?, 'comment')`,
            [parentComment[0].user_id, '有人回复了你的评论', userId, sender[0].avatar, sender[0].nickname, commentId]
          );

          if (req.io) {
            req.io.to(`user:${parentComment[0].user_id}`).emit('notification:new', {
              id: notifResult.insertId,
              type: 'comment',
              title: '新回复',
              content: '有人回复了你的评论',
              sender_id: userId,
              sender_nickname: sender[0].nickname,
              sender_avatar: sender[0].avatar,
              related_id: commentId,
              related_type: 'comment',
              created_at: new Date()
            });
          }
        }
      } else if (quoteId) {
        // 如果是引用评论，也通知被引用的人
        const [quotedComment] = await query('SELECT user_id FROM post_comments WHERE id = ?', [quoteId]);
        if (quotedComment && quotedComment.length > 0 && quotedComment[0].user_id !== userId && quotedComment[0].user_id !== posts[0].user_id) {
           const [notifResult] = await query(
            `INSERT INTO notifications (user_id, type, title, content, sender_id, sender_avatar, sender_nickname, related_id, related_type)
             VALUES (?, 'comment', '新回复', ?, ?, ?, ?, ?, 'comment')`,
            [quotedComment[0].user_id, '有人回复了你的评论', userId, sender[0].avatar, sender[0].nickname, commentId]
          );

          if (req.io) {
            req.io.to(`user:${quotedComment[0].user_id}`).emit('notification:new', {
              id: notifResult.insertId,
              type: 'comment',
              title: '新回复',
              content: '有人回复了你的评论',
              sender_id: userId,
              sender_nickname: sender[0].nickname,
              sender_avatar: sender[0].avatar,
              related_id: commentId,
              related_type: 'comment',
              created_at: new Date()
            });
          }
        }
      }
    } catch (notificationError) {
      console.error('发送评论通知失败:', notificationError);
    }

    res.status(201).json({
      message: '评论成功',
      commentId: result.insertId,
    });
  } catch (error) {
    next(error);
  }
});

// 获取评论列表
router.get('/:id/comments', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const userId = req.user?.id;

    const sql = `
      SELECT c.*, u.id as user_id, u.username, u.nickname, u.avatar,
              (SELECT COUNT(*) FROM post_comments WHERE parent_id = c.id AND is_visible = 1) as reply_count
       FROM post_comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.post_id = ? AND c.parent_id IS NULL AND c.is_visible = 1
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?
    `;

    const [comments] = await query(sql, [parseInt(id), parseInt(limit), parseInt(offset)]);

    const processedComments = comments.map(comment => {
      const userInfo = processAnonymousUser(comment, req.user);
      return {
        ...comment,
        user_id: userInfo.user_id,
        username: userInfo.username,
        nickname: userInfo.nickname,
        avatar: userInfo.avatar,
        isLiked: false
      };
    });

    if (userId && processedComments.length > 0) {
      const commentIds = processedComments.map(c => c.id);
      const [likes] = await query(
        `SELECT comment_id FROM comment_likes WHERE user_id = ? AND comment_id IN (${commentIds.join(',')})`,
        [userId]
      );
      const likedCommentIds = new Set(likes.map(l => l.comment_id));
      processedComments.forEach(comment => {
        comment.isLiked = likedCommentIds.has(comment.id);
      });
    }

    res.json({ comments: processedComments, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    next(error);
  }
});

// 获取评论回复列表
router.get('/:id/comments/:commentId/replies', optionalAuth, async (req, res, next) => {
  try {
    const { id, commentId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const userId = req.user?.id;

    const sql = `
      SELECT c.*, u.id as user_id, u.username, u.nickname, u.avatar,
              parent_user.nickname as reply_to_nickname
       FROM post_comments c
       JOIN users u ON c.user_id = u.id
       LEFT JOIN post_comments parent ON c.parent_id = parent.id
       LEFT JOIN users parent_user ON parent.user_id = parent_user.id
       WHERE c.post_id = ? AND c.parent_id = ? AND c.is_visible = 1
       ORDER BY c.created_at ASC
       LIMIT ? OFFSET ?
    `;

    const [replies] = await query(sql, [parseInt(id), parseInt(commentId), parseInt(limit), parseInt(offset)]);

    const processedReplies = replies.map(reply => {
      const userInfo = processAnonymousUser(reply, req.user);
      return {
        ...reply,
        user_id: userInfo.user_id,
        username: userInfo.username,
        nickname: userInfo.nickname,
        avatar: userInfo.avatar,
        isLiked: false
      };
    });

    if (userId && processedReplies.length > 0) {
      const replyIds = processedReplies.map(r => r.id);
      const [likes] = await query(
        `SELECT comment_id FROM comment_likes WHERE user_id = ? AND comment_id IN (${replyIds.join(',')})`,
        [userId]
      );
      const likedReplyIds = new Set(likes.map(l => l.comment_id));
      processedReplies.forEach(reply => {
        reply.isLiked = likedReplyIds.has(reply.id);
      });
    }

    res.json({ replies: processedReplies, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    next(error);
  }
});

// 点赞评论
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

// 转发帖子
router.post('/:id/share', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    // 检查原帖子是否存在
    const [originalPosts] = await query('SELECT * FROM posts WHERE id = ?', [id]);
    if (!originalPosts || originalPosts.length === 0) {
      return res.status(404).json({ error: '原帖子不存在' });
    }

    const originalPost = originalPosts[0];

    // 处理原帖子的数据，确保类型正确
    let postImages;
    try {
      if (typeof originalPost.images === 'string') {
        postImages = originalPost.images;
      } else if (Array.isArray(originalPost.images)) {
        postImages = JSON.stringify(originalPost.images);
      } else {
        postImages = null;
      }
    } catch (e) {
      postImages = null;
    }

    let postTags;
    try {
      if (typeof originalPost.tags === 'string') {
        postTags = originalPost.tags;
      } else if (Array.isArray(originalPost.tags)) {
        postTags = JSON.stringify(originalPost.tags);
      } else {
        postTags = null;
      }
    } catch (e) {
      postTags = null;
    }

    // 检查原帖子是否是投票帖子，如果是则复制投票信息
    let postType = 'text';
    let pollOptions = null;
    let pollType = null;
    let pollExpireAt = null;
    let pollIsAnonymous = null;
    let pollIsPublic = null;
    let pollVotes = null;
    let pollSourceId = null;

    if (originalPost.post_type === 'poll' || originalPost.post_type === 'poll_with_link') {
      postType = originalPost.post_type;
      // 确保 poll_options 是 JSON 字符串
      if (typeof originalPost.poll_options === 'string') {
        pollOptions = originalPost.poll_options;
      } else if (Array.isArray(originalPost.poll_options)) {
        pollOptions = JSON.stringify(originalPost.poll_options);
      } else {
        pollOptions = null;
      }
      pollType = originalPost.poll_type;
      pollExpireAt = originalPost.poll_expire_at;
      pollIsAnonymous = originalPost.poll_is_anonymous;
      pollIsPublic = originalPost.poll_is_public;
      pollVotes = JSON.stringify({});
      // 设置投票源ID：如果原帖已有源ID则延用，否则使用原帖ID
      pollSourceId = originalPost.poll_source_id || originalPost.id;
    }

    // 检查原帖子是否是链接帖子，如果是则复制链接信息
    if (originalPost.post_type === 'link' || originalPost.post_type === 'poll_with_link') {
      postType = originalPost.post_type;
    }

    // 构建插入数据
    let userComment = content ? `<p class="forward-comment">${content}</p>` : '转发：';
    
    // 检查原帖子是否包含 HTML 标签
    const isHtml = /<[a-z][\s\S]*>/i.test(originalPost.content);
    let originalContentDisplay = originalPost.content;
    
    if (!isHtml && originalPost.content.length > 100) {
      originalContentDisplay = `${originalPost.content.substring(0, 100)}...`;
    }

    // 组合转发内容：用户评论 + 原帖引用（包含原帖内容和查看原帖链接）
    const forwardContent = `${userComment}<div class="forward-container"><blockquote class="forward-quote">
      ${originalContentDisplay}
      <div class="mt-2 text-right">
        <a href="/post/${id}" class="original-post-link text-primary hover:underline" style="font-size: 0.85rem; color: #3b82f6;">查看原帖 →</a>
      </div>
    </blockquote></div>`;

    let insertColumns = ['user_id', 'content', 'images', 'video_url', 'tags', 'visibility', 'status'];
    let insertValues = [
      userId,
      forwardContent,
      postImages,
      originalPost.video_url || null,
      postTags,
      'public',
      'active'
    ];

    // 如果是投票帖子，添加投票相关字段
    if (pollOptions) {
      insertColumns.push('post_type', 'poll_options', 'poll_votes', 'poll_expire_at', 'poll_type', 'poll_is_anonymous', 'poll_is_public', 'poll_source_id');
      insertValues.push(postType, pollOptions, pollVotes, pollExpireAt, pollType, pollIsAnonymous, pollIsPublic, pollSourceId);
    }

    // 如果是链接帖子，添加链接相关字段
    if (originalPost.link_url) {
      if (!insertColumns.includes('post_type')) {
        insertColumns.push('post_type');
        insertValues.push(postType);
      }
      insertColumns.push('link_url', 'link_title', 'link_description', 'link_image_url');
      insertValues.push(originalPost.link_url, originalPost.link_title, originalPost.link_description, originalPost.link_image_url);
    }

    // 创建转发帖子
    const [result] = await query(
      `INSERT INTO posts (${insertColumns.join(', ')}, created_at)
       VALUES (${insertValues.map(() => '?').join(', ')}, NOW())`,
      insertValues
    );

    // 记录分享 (使用 ON DUPLICATE KEY UPDATE 避免 409 错误，并更新分享时间)
    await query(
      'INSERT INTO post_shares (post_id, user_id, created_at) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE created_at = NOW()',
      [id, userId]
    );

    // 更新原帖子分享数
    await query('UPDATE posts SET share_count = share_count + 1 WHERE id = ?', [id]);

    const [originalPostAuthor] = await query('SELECT user_id FROM posts WHERE id = ?', [id]);

    // 发送通知
    try {
      if (originalPostAuthor && originalPostAuthor.length > 0 && originalPostAuthor[0].user_id !== userId) {
        const [sender] = await query('SELECT nickname, avatar FROM users WHERE id = ?', [userId]);
        await query(
          `INSERT INTO notifications (user_id, type, title, content, sender_id, sender_avatar, sender_nickname, related_id, related_type)
           VALUES (?, 'message', '帖子被转发', ?, ?, ?, ?, ?, 'post')`,
          [originalPostAuthor[0].user_id, '有人转发了你的帖子', userId, sender[0].avatar, sender[0].nickname, result.insertId]
        );
      }
    } catch (notificationError) {
      console.error('发送转发通知失败:', notificationError);
    }

    res.status(201).json({
      message: '转发成功',
      postId: result.insertId,
    });
  } catch (error) {
    next(error);
  }
});

// 投票参与
router.post('/:id/vote', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { option_index } = req.body;
    const userId = req.user.id;

    // 检查帖子是否存在且为投票帖子
    const [posts] = await query(
      'SELECT post_type, poll_options, poll_votes, poll_expire_at, poll_type, poll_source_id FROM posts WHERE id = ? AND status = "active"',
      [id]
    );

    if (!posts || posts.length === 0) {
      return res.status(404).json({ error: '帖子不存在' });
    }

    let post = posts[0];
    let targetId = id;

    // 如果是转发的投票，使用源帖子的数据
    if (post.poll_source_id) {
      targetId = post.poll_source_id;
      const [sourcePosts] = await query(
        'SELECT post_type, poll_options, poll_votes, poll_expire_at, poll_type FROM posts WHERE id = ? AND status = "active"',
        [targetId]
      );
      if (sourcePosts && sourcePosts.length > 0) {
        post = sourcePosts[0];
      }
    }

    if (post.post_type !== 'poll' && post.post_type !== 'poll_with_link') {
      return res.status(400).json({ error: '此帖子不是投票帖子' });
    }
    
    // 检查投票是否已过期
    if (post.poll_expire_at && new Date() > new Date(post.poll_expire_at)) {
      return res.status(400).json({ error: '投票已过期' });
    }

    // 解析投票选项
    let poll_options;
    try {
      poll_options = typeof post.poll_options === 'string' ? JSON.parse(post.poll_options) : post.poll_options;
    } catch (error) {
      return res.status(400).json({ error: '投票选项解析错误' });
    }
    
    // 验证选项索引
    if (option_index < 0 || option_index >= poll_options.length) {
      return res.status(400).json({ error: '无效的选项索引' });
    }

    // 解析当前投票结果
    let poll_votes;
    try {
      // 修复：确保 poll_votes 是字符串，处理 Buffer 对象和其他类型
      let pollVotesStr = post.poll_votes;
      if (Buffer.isBuffer(pollVotesStr)) {
        pollVotesStr = pollVotesStr.toString();
      } else if (typeof pollVotesStr !== 'string') {
        pollVotesStr = JSON.stringify(pollVotesStr);
      }
      
      // 修复：当 poll_votes 为空字符串、null 或 undefined 时，将其视为空对象
      if (!pollVotesStr || pollVotesStr === 'null' || pollVotesStr === 'undefined') {
        poll_votes = {};
      } else {
        poll_votes = JSON.parse(pollVotesStr);
      }
    } catch (error) {
      console.error('解析投票结果出错:', error);
      // 解析错误时，将 poll_votes 设为空对象，而不是返回错误
      poll_votes = {};
    }
    
    // 添加日志，调试投票处理
    console.log('处理投票前的 poll_votes:', poll_votes);
    console.log('当前用户ID:', userId);
    console.log('投票选项索引:', option_index);
    console.log('帖子类型:', post.poll_type);
    
    // 处理投票
    if (post.poll_type === 'single' || post.poll_type === 'multiple') {
      if (post.poll_type === 'single') {
        // 单选投票：如果已经投了该选项，则取消；否则替换用户的现有投票
        if (poll_votes[userId] && Array.isArray(poll_votes[userId]) && poll_votes[userId][0] === option_index) {
          delete poll_votes[userId];
          console.log('单选投票：用户', userId, '取消选项', option_index);
        } else {
          poll_votes[userId] = [option_index];
          console.log('单选投票：用户', userId, '选择选项', option_index);
        }
      } else if (post.poll_type === 'multiple') {
        // 多选投票，切换用户的投票
        if (!poll_votes[userId]) {
          poll_votes[userId] = [];
        }
        
        const user_votes = poll_votes[userId];
        const index = user_votes.indexOf(option_index);
        
        if (index > -1) {
          // 取消投票
          user_votes.splice(index, 1);
          console.log('多选投票：用户', userId, '取消选项', option_index);
        } else {
          // 添加投票
          user_votes.push(option_index);
          console.log('多选投票：用户', userId, '添加选项', option_index);
        }
        
        if (user_votes.length === 0) {
          delete poll_votes[userId];
        } else {
          poll_votes[userId] = user_votes;
        }
      }
    }
    
    // 添加日志，调试投票处理结果
    console.log('处理投票后的 poll_votes:', poll_votes);
    
    // 更新投票结果
    try {
      await query(
        'UPDATE posts SET poll_votes = ? WHERE id = ?',
        [JSON.stringify(poll_votes), targetId]
      );

      // 发送通知
      try {
        const [posts] = await query('SELECT user_id FROM posts WHERE id = ?', [targetId]);
        if (posts && posts.length > 0 && posts[0].user_id !== userId) {
          const [sender] = await query('SELECT nickname, avatar FROM users WHERE id = ?', [userId]);
          await query(
            `INSERT INTO notifications (user_id, type, title, content, sender_id, sender_avatar, sender_nickname, related_id, related_type)
             VALUES (?, 'message', '参与了投票', ?, ?, ?, ?, ?, 'post')`,
            [posts[0].user_id, '有人参与了你的投票', userId, sender[0].avatar, sender[0].nickname, targetId]
          );
        }
      } catch (notificationError) {
        console.error('发送投票通知失败:', notificationError);
      }
    } catch (error) {
      return res.status(500).json({ error: '更新投票结果失败' });
    }

    // 重新计算总投票数
    const total_votes = Object.values(poll_votes).reduce((sum, votes) => {
      return sum + (Array.isArray(votes) ? votes.length : 0);
    }, 0);
    
    // 判断是投票还是取消投票
    const userVotes = poll_votes[userId];
    const isCancelVote = userVotes && Array.isArray(userVotes) && userVotes.length === 0;

    res.json({
      message: isCancelVote ? '已取消投票' : '投票成功',
      poll_info: {
        votes: poll_votes,
        total_votes: total_votes
      }
    });
  } catch (error) {
    next(error);
  }
});

// 获取投票结果
router.get('/:id/vote/result', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    // 检查帖子是否存在且为投票帖子
    const [posts] = await query(
      `SELECT COALESCE(source_p.poll_options, p.poll_options) as poll_options,
              COALESCE(source_p.poll_votes, p.poll_votes) as poll_votes,
              COALESCE(source_p.poll_expire_at, p.poll_expire_at) as poll_expire_at,
              COALESCE(source_p.poll_type, p.poll_type) as poll_type,
              COALESCE(source_p.poll_is_public, p.poll_is_public) as poll_is_public,
              p.post_type
       FROM posts p
       LEFT JOIN posts source_p ON p.poll_source_id = source_p.id
       WHERE p.id = ? AND p.status = 'active'`,
      [id]
    );

    if (!posts || posts.length === 0) {
      return res.status(404).json({ error: '帖子不存在' });
    }

    const post = posts[0];

    if (post.post_type !== 'poll' && post.post_type !== 'poll_with_link') {
      return res.status(400).json({ error: '此帖子不是投票帖子' });
    }

    // 检查是否可以查看结果
    if (!post.poll_is_public && new Date() < new Date(post.poll_expire_at)) {
      return res.status(403).json({ error: '投票结果仅在结束后公开' });
    }

    // 解析投票数据
    const poll_options = typeof post.poll_options === 'string' ? JSON.parse(post.poll_options) : post.poll_options;
    const poll_votes = post.poll_votes ? JSON.parse(post.poll_votes) : {};
    
    // 计算每个选项的得票数
    const option_votes = Array(poll_options.length).fill(0);
    
    for (const user_votes of Object.values(poll_votes)) {
      if (Array.isArray(user_votes)) {
        for (const option_index of user_votes) {
          option_votes[option_index]++;
        }
      }
    }
    
    // 计算总投票数
    const total_votes = option_votes.reduce((sum, votes) => sum + votes, 0);

    res.json({
      poll_result: {
        options: poll_options,
        option_votes: option_votes,
        total_votes: total_votes,
        vote_details: poll_votes,
        expire_at: post.poll_expire_at,
        type: post.poll_type
      }
    });
  } catch (error) {
    next(error);
  }
});

// 删除帖子
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // 检查帖子所有权
    const [posts] = await query('SELECT user_id, content, topic_id, status FROM posts WHERE id = ?', [id]);

    if (!posts || posts.length === 0) {
      return res.status(404).json({ error: '帖子不存在' });
    }

    if (posts[0].status === 'deleted') {
      return res.status(400).json({ error: '帖子已删除' });
    }

    if (posts[0].user_id !== userId) {
      return res.status(403).json({ error: '无权删除此帖子' });
    }

    // 更新帖子状态为已删除 (设置为不可见)
    await query('UPDATE posts SET is_visible = 0, status = ? WHERE id = ?', ['deleted', id]);
    
    // 清理相关的提及和通知
    try {
      await cleanupMentions({ postId: id });
    } catch (error) {
      console.error('清理提及失败:', error);
    }
    
    // 如果帖子关联了话题，更新话题的帖子数
    if (posts[0].topic_id) {
      try {
        await query('UPDATE topics SET post_count = GREATEST(0, post_count - 1) WHERE id = ?', [posts[0].topic_id]);
      } catch (error) {
        console.error('更新话题帖子数失败:', error);
      }
    }
    
    // 更新累计发布帖子成就进度 (减少)
    try {
        await updateTaskProgress(userId, '累计发布50帖', -1);
    } catch (error) {
        console.error('更新累计发布帖子任务失败:', error);
    }
    
    // 如果是转发帖子，删除对应的分享记录
    const postContent = posts[0].content;
    if (typeof postContent === 'string' && postContent.startsWith('转发：')) {
      // 提取原帖子内容的前100个字符，用于查找对应的分享记录
      const originalContent = postContent.substring(3); // 去掉"转发："
      
      // 查找原帖子ID
      const [originalPosts] = await query(
        `SELECT id FROM posts WHERE content LIKE ?`,
        [originalContent.substring(0, 100) + '%']
      );
      
      if (originalPosts && originalPosts.length > 0) {
        const originalPostId = originalPosts[0].id;
        // 删除对应的分享记录
        await query(
          'DELETE FROM post_shares WHERE user_id = ? AND post_id = ?',
          [userId, originalPostId]
        );
      }
    }

    res.json({ message: '帖子已删除' });
  } catch (error) {
    next(error);
  }
});

// 删除评论
router.delete('/:id/comment/:commentId', authenticate, async (req, res, next) => {
  try {
    const { id, commentId } = req.params;
    const userId = req.user.id;

    // 检查评论所有权
    const [comments] = await query('SELECT user_id, parent_id FROM post_comments WHERE id = ? AND post_id = ?', [commentId, id]);

    if (!comments || comments.length === 0) {
      return res.status(404).json({ error: '评论不存在' });
    }

    if (comments[0].user_id !== userId) {
      return res.status(403).json({ error: '无权删除此评论' });
    }

    // 软删除评论 (设置为不可见)
    await query('UPDATE post_comments SET is_visible = 0 WHERE id = ?', [commentId]);

    // 清理相关的提及和通知
    try {
      await cleanupMentions({ commentId: commentId });
    } catch (error) {
      console.error('清理提及失败:', error);
    }

    // 更新帖子评论数
    await query('UPDATE posts SET comment_count = GREATEST(0, comment_count - 1) WHERE id = ?', [id]);

    // 如果该帖子属于某个话题，也减少话题的 post_count
    const [topicInfo] = await query('SELECT topic_id FROM posts WHERE id = ?', [id]);
    if (topicInfo && topicInfo.length > 0 && topicInfo[0].topic_id) {
      await query('UPDATE topics SET post_count = GREATEST(0, post_count - 1) WHERE id = ?', [topicInfo[0].topic_id]);
    }

    res.json({ message: '评论已删除' });
  } catch (error) {
    next(error);
  }
});

export default router;
