/**
 * 处理图片URL，确保它指向正确的地址
 * @param url 图片URL，可以是相对路径或绝对路径
 * @param defaultUrl 默认图片URL，如果不提供则使用默认头像
 * @returns 图片URL
 */
export function getImageUrl(url: string | undefined | null, defaultUrl?: string): string {
  if (!url) {
    return defaultUrl || '/qitafujian/images/default-avatar.svg';
  }
  
  // 如果已经是绝对路径，直接返回
  if (url.startsWith('http')) {
    return url;
  }
  
  // 否则直接使用相对路径，通过代理访问
  return url;
}
