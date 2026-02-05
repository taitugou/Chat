import { query } from '../database/connection.js';

export function extractMentions(text) {
  if (!text) return [];
  const mentionRegex = /@(\w+)/g;
  const mentions = [];
  let match;
  
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[1]);
  }
  
  return [...new Set(mentions)]; // 去重
}

export async function getUserIdsByUsernames(usernames) {
  if (!usernames || usernames.length === 0) return [];
  
  const placeholders = usernames.map(() => '?').join(',');
  const [users] = await query(
    `SELECT id, username FROM users WHERE username IN (${placeholders})`,
    usernames
  );
  
  return users;
}

export async function processMentions({ content, postId, topicId, commentId, messageId, sponsorshipId, bioUserId, groupId, announcementId, chatMessageId, userId, io }) {
  const mentions = extractMentions(content);
  if (mentions.length === 0) return [];

  const mentionedUsers = await getUserIdsByUsernames(mentions);
  if (mentionedUsers.length === 0) return [];

  const mentionedUserIds = mentionedUsers.map(u => u.id);
  
  let updateTable = '';
  let updateId = null;
  let relatedType = '';
  
  if (postId) {
    updateTable = 'posts';
    updateId = postId;
    relatedType = 'post';
  } else if (topicId) {
    updateTable = 'topics';
    updateId = topicId;
    relatedType = 'topic';
  } else if (commentId) {
    updateTable = 'post_comments';
    updateId = commentId;
    relatedType = 'comment';
  } else if (messageId) {
    updateTable = 'user_messages';
    updateId = messageId;
    relatedType = 'message';
  } else if (sponsorshipId) {
    updateTable = 'sponsorships';
    updateId = sponsorshipId;
    relatedType = 'sponsorship';
  } else if (bioUserId) {
    updateTable = 'users';
    updateId = bioUserId;
    relatedType = 'bio';
  } else if (groupId) {
    updateTable = 'chat_groups';
    updateId = groupId;
    relatedType = 'group';
  } else if (announcementId) {
    updateTable = 'group_announcements';
    updateId = announcementId;
    relatedType = 'announcement';
  } else if (chatMessageId) {
    updateTable = 'messages';
    updateId = chatMessageId;
    relatedType = 'chat';
  }
  
  if (updateTable && updateId) {
    // 更新表中的 mentions 列
    await query(
      `UPDATE ${updateTable} SET mentions = ? WHERE id = ?`,
      [JSON.stringify(mentionedUserIds), updateId]
    );
    
    // 获取发送者信息
    const [senders] = await query(
      'SELECT username, nickname, avatar FROM users WHERE id = ?',
      [userId]
    );
    const sender = senders[0];
    
    // 插入到 mentions 表并触发通知
    for (const mentionedUser of mentionedUsers) {
      if (mentionedUser.id === userId) continue; // 不通知自己

      // 检查是否已经存在该提及（防止重复处理）
      const [existing] = await query(
        `SELECT id FROM mentions WHERE mentioned_user_id = ? AND mentioner_id = ? AND ${
          updateTable === 'posts' ? 'post_id' : 
          updateTable === 'topics' ? 'topic_id' : 
          updateTable === 'post_comments' ? 'comment_id' : 
          updateTable === 'user_messages' ? 'message_id' : 
          updateTable === 'sponsorships' ? 'sponsorship_id' : 
          updateTable === 'users' ? 'bio_user_id' :
          updateTable === 'chat_groups' ? 'group_id' :
          updateTable === 'group_announcements' ? 'announcement_id' : 'chat_message_id'
        } = ?`,
        [mentionedUser.id, userId, updateId]
      );
      
      if (existing.length === 0) {
        await query(
          `INSERT INTO mentions (mentioned_user_id, mentioner_id, post_id, topic_id, comment_id, message_id, sponsorship_id, bio_user_id, group_id, announcement_id, chat_message_id, mention_text)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [mentionedUser.id, userId, postId || null, topicId || null, commentId || null, messageId || null, sponsorshipId || null, bioUserId || null, groupId || null, announcementId || null, chatMessageId || null, `@${mentionedUser.username}`]
        );

        // 插入通知
        const content_text = `${sender?.nickname || sender?.username} 在${
          updateTable === 'posts' ? '帖子' : 
          updateTable === 'topics' ? '话题' : 
          updateTable === 'post_comments' ? '评论' : 
          updateTable === 'user_messages' ? '留言' : 
          updateTable === 'sponsorships' ? '赞助记录' : 
          updateTable === 'users' ? '个人简介' :
          updateTable === 'chat_groups' ? '群聊简介' :
          updateTable === 'group_announcements' ? '群公告' : '聊天消息'
        }中提到了你`;

        const [notifResult] = await query(
          `INSERT INTO notifications (user_id, type, title, content, sender_id, sender_avatar, sender_nickname, related_id, related_type, is_read)
           VALUES (?, 'mention', ?, ?, ?, ?, ?, ?, ?, FALSE)`,
          [
            mentionedUser.id,
            '有人@了你',
            content_text,
            userId,
            sender?.avatar,
            sender?.nickname || sender?.username,
            updateId,
            relatedType
          ]
        );

        // 发送 Socket.IO 实时通知
        if (io) {
          io.to(`user:${mentionedUser.id}`).emit('notification:new', {
            id: notifResult.insertId,
            type: 'mention',
            title: '有人@了你',
            content: content_text,
            sender_id: userId,
            sender_nickname: sender?.nickname || sender?.username,
            sender_avatar: sender?.avatar,
            related_id: updateId,
            related_type: relatedType,
            created_at: new Date()
          });
        }
      }
    }
  }
  
  return mentionedUserIds;
}

export async function cleanupMentions({ postId, topicId, commentId, messageId, sponsorshipId, bioUserId, groupId, announcementId, chatMessageId, userId }) {
  let condition = '';
  let id = null;
  let relatedType = '';

  if (postId) {
    if (Array.isArray(postId)) {
      const placeholders = postId.map(() => '?').join(',');
      await query(`DELETE FROM mentions WHERE post_id IN (${placeholders})`, postId);
      return;
    }
    condition = 'post_id = ?';
    id = postId;
    relatedType = 'post';
  } else if (topicId) {
    if (Array.isArray(topicId)) {
      const placeholders = topicId.map(() => '?').join(',');
      await query(`DELETE FROM mentions WHERE topic_id IN (${placeholders})`, topicId);
      return;
    }
    condition = 'topic_id = ?';
    id = topicId;
    relatedType = 'topic';
  } else if (commentId) {
    if (Array.isArray(commentId)) {
      const placeholders = commentId.map(() => '?').join(',');
      await query(`DELETE FROM mentions WHERE comment_id IN (${placeholders})`, commentId);
      return;
    }
    condition = 'comment_id = ?';
    id = commentId;
    relatedType = 'comment';
  } else if (messageId) {
    if (Array.isArray(messageId)) {
      const placeholders = messageId.map(() => '?').join(',');
      await query(`DELETE FROM mentions WHERE message_id IN (${placeholders})`, messageId);
      return;
    }
    condition = 'message_id = ?';
    id = messageId;
    relatedType = 'message';
  } else if (sponsorshipId) {
    if (Array.isArray(sponsorshipId)) {
      const placeholders = sponsorshipId.map(() => '?').join(',');
      await query(`DELETE FROM mentions WHERE sponsorship_id IN (${placeholders})`, sponsorshipId);
      return;
    }
    condition = 'sponsorship_id = ?';
    id = sponsorshipId;
    relatedType = 'sponsorship';
  } else if (bioUserId) {
    condition = 'bio_user_id = ?';
    id = bioUserId;
    relatedType = 'bio';
  } else if (groupId) {
    if (Array.isArray(groupId)) {
      const placeholders = groupId.map(() => '?').join(',');
      await query(`DELETE FROM mentions WHERE group_id IN (${placeholders})`, groupId);
      return;
    }
    condition = 'group_id = ?';
    id = groupId;
    relatedType = 'group';
  } else if (announcementId) {
    if (Array.isArray(announcementId)) {
      const placeholders = announcementId.map(() => '?').join(',');
      await query(`DELETE FROM mentions WHERE announcement_id IN (${placeholders})`, announcementId);
      return;
    }
    condition = 'announcement_id = ?';
    id = announcementId;
    relatedType = 'announcement';
  } else if (chatMessageId) {
    condition = 'chat_message_id = ?';
    id = chatMessageId;
    relatedType = 'chat';
  } else if (userId) {
    // 当用户被删除/禁用时，清理该用户发出的提及和收到的提及
    // 1. 清理该用户发出的提及
    await query(`DELETE FROM mentions WHERE mentioner_id = ?`, [userId]);
    // 2. 清理该用户收到的提及
    await query(`DELETE FROM mentions WHERE mentioned_user_id = ?`, [userId]);
    return;
  }

  if (id) {
    // 删除 mentions 表中的记录
    await query(`DELETE FROM mentions WHERE ${condition}`, [id]);
  }
}
