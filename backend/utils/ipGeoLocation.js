import axios from 'axios';
import net from 'net';

/**
 * 根据IP地址获取地理位置信息
 * @param {string} ip - IP地址
 * @returns {Promise<Object>} 地理位置信息
 */
export async function getLocationByIP(ip) {
  try {
    const normalized = normalizeIp(ip);
    // 使用ip-api.com获取IP地理位置信息
    const response = await axios.get('http://ip-api.com/json/' + encodeURIComponent(normalized), {
      timeout: 5000,
      params: {
        lang: 'zh-CN', // 使用中文返回结果
        fields: 'status,country,regionName,city,zip,lat,lon,isp,org,as,query' // 指定返回字段
      }
    });

    if (response.data.status === 'success') {
      return {
        country: response.data.country,
        region: response.data.regionName,
        city: response.data.city,
        zip: response.data.zip,
        latitude: response.data.lat,
        longitude: response.data.lon,
        isp: response.data.isp,
        org: response.data.org,
        as: response.data.as,
        ip: response.data.query,
        fullLocation: `${response.data.city}, ${response.data.regionName}, ${response.data.country}`
      };
    } else {
      console.error('IP地理位置查询失败:', response.data.message);
      return null;
    }
  } catch (error) {
    console.error('获取IP地理位置失败:', error.message);
    return null;
  }
}

/**
 * 从请求对象中获取客户端IP地址
 * @param {Object} req - Express请求对象
 * @returns {string} 客户端IP地址
 */
export function getClientIP(req) {
  // 从X-Forwarded-For头获取IP（如果有），否则使用req.ip
  const raw = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.connection?.socket?.remoteAddress ||
    '';
  return normalizeIp(raw);
}

export function getRateLimitKey(req, v6PrefixBits = 64) {
  const ip = getClientIP(req);
  if (net.isIP(ip) === 6) {
    return ipv6PrefixKey(ip, v6PrefixBits);
  }
  return ip || 'unknown';
}

function normalizeIp(raw) {
  if (!raw) return '';
  let s = String(raw).trim();

  if (s.startsWith('[')) {
    const end = s.indexOf(']');
    if (end > 0) s = s.slice(1, end);
  }

  const zoneIndex = s.indexOf('%');
  if (zoneIndex > -1) s = s.slice(0, zoneIndex);

  if (s.startsWith('::ffff:')) s = s.slice(7);

  if (s.includes(':') && !s.includes('::') && s.split(':').length === 2) {
    const [host] = s.split(':');
    if (net.isIP(host)) s = host;
  }

  return s;
}

function ipv6PrefixKey(ip, bits = 64) {
  const groups = expandIpv6ToGroups(ip);
  const groupCount = Math.max(0, Math.min(8, Math.floor(bits / 16)));
  const prefixGroups = groups.slice(0, groupCount).map(g => g.padStart(4, '0').toLowerCase());
  return `${prefixGroups.join(':')}::/${bits}`;
}

function expandIpv6ToGroups(ip) {
  let s = ip.toLowerCase();

  const parts = s.split('::');
  let left = parts[0] ? parts[0].split(':').filter(Boolean) : [];
  let right = parts.length > 1 && parts[1] ? parts[1].split(':').filter(Boolean) : [];

  const v4Index = right.findIndex(p => p.includes('.'));
  if (v4Index !== -1) {
    const v4 = right[v4Index];
    const v4Groups = ipv4ToIpv6Groups(v4);
    right = [...right.slice(0, v4Index), ...v4Groups, ...right.slice(v4Index + 1)];
  }
  const leftV4Index = left.findIndex(p => p.includes('.'));
  if (leftV4Index !== -1) {
    const v4 = left[leftV4Index];
    const v4Groups = ipv4ToIpv6Groups(v4);
    left = [...left.slice(0, leftV4Index), ...v4Groups, ...left.slice(leftV4Index + 1)];
  }

  if (parts.length === 1) {
    const all = [...left];
    while (all.length < 8) all.push('0');
    return all.slice(0, 8);
  }

  const missing = 8 - (left.length + right.length);
  const zeros = Array(Math.max(0, missing)).fill('0');
  return [...left, ...zeros, ...right].slice(0, 8);
}

function ipv4ToIpv6Groups(v4) {
  const nums = v4.split('.').map(n => parseInt(n, 10));
  if (nums.length !== 4 || nums.some(n => Number.isNaN(n) || n < 0 || n > 255)) return ['0', '0'];
  const hi = ((nums[0] << 8) | nums[1]).toString(16);
  const lo = ((nums[2] << 8) | nums[3]).toString(16);
  return [hi, lo];
}
