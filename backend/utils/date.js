export function getDateString(date = new Date()) {
  // 使用本地时间获取 YYYY-MM-DD 格式，避免 UTC 导致的日期漂移
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
