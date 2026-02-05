/**
 * 敏感词过滤工具
 * 简单的敏感词过滤实现，生产环境建议使用更专业的方案
 */

// 敏感词列表（示例，实际应该从数据库或配置文件加载）
const sensitiveWords = [
  '敏感词1',
  '敏感词2',
  // 可以添加更多敏感词
];

// 替换字符
const REPLACE_CHAR = '*';

/**
 * 检查文本是否包含敏感词
 */
export function containsSensitiveWords(text) {
  if (!text || typeof text !== 'string') {
    return false;
  }

  const lowerText = text.toLowerCase();
  return sensitiveWords.some(word => lowerText.includes(word.toLowerCase()));
}

/**
 * 过滤敏感词，替换为指定字符
 */
export function filterSensitiveWords(text) {
  if (!text || typeof text !== 'string') {
    return text;
  }

  let filteredText = text;
  sensitiveWords.forEach(word => {
    const regex = new RegExp(word, 'gi');
    filteredText = filteredText.replace(regex, REPLACE_CHAR.repeat(word.length));
  });

  return filteredText;
}

/**
 * 批量检查文本数组
 */
export function batchCheckSensitiveWords(texts) {
  return texts.map(text => ({
    text,
    contains: containsSensitiveWords(text),
    filtered: filterSensitiveWords(text),
  }));
}

/**
 * 从文件或数据库加载敏感词（可选）
 */
export async function loadSensitiveWords() {
  // 这里可以从数据库或文件加载敏感词列表
  // 示例：从数据库加载
  // const words = await query('SELECT word FROM sensitive_words WHERE status = "active"');
  // sensitiveWords.push(...words.map(w => w.word));
  return sensitiveWords;
}

