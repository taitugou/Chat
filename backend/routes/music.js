import express from 'express';
import axios from 'axios';

const router = express.Router();

const KUWO_APIS = [
  'https://api.mymzf.com/api/randomkuwo',
  'https://i.doluodalu.com/api/randomkuwo'
];

async function fetchMusicWithRetry(maxRetries) {
  maxRetries = maxRetries || 10;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    for (let i = 0; i < KUWO_APIS.length; i++) {
      const apiUrl = KUWO_APIS[i];
      try {
        const response = await axios.get(apiUrl, {
          timeout: 8000,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        const data = response.data;
        
        if (data.code === 200 && data.data && data.data.url) {
          console.log('[Music] Got valid track: ' + data.data.name + ' - ' + data.data.singer);
          return {
            id: 'kuwo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            name: data.data.name || '未知歌曲',
            artist: data.data.singer || data.data.artist || '未知歌手',
            cover: data.data.image || data.data.cover || '',
            url: data.data.url,
            duration: data.data.duration || 0,
            source: 'kuwo'
          };
        } else if (data.code === 200 && data.data) {
          console.log('[Music] Attempt ' + (attempt + 1) + ': No URL for ' + data.data.name + ', retrying...');
        }
      } catch (e) {
        console.warn('[Music] Failed to fetch from ' + apiUrl + ': ' + e.message);
      }
    }
    
    await new Promise(function(resolve) { setTimeout(resolve, 200); });
  }
  
  return null;
}

router.get('/random', async function(req, res) {
  try {
    const track = await fetchMusicWithRetry(10);
    
    if (track) {
      return res.json({
        success: true,
        track: track
      });
    }
    
    return res.status(500).json({ 
      success: false, 
      error: '无法获取有效的音乐链接，请稍后重试' 
    });
  } catch (e) {
    console.error('[Music] Random error: ' + e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/proxy', async function(req, res) {
  const url = req.query.url;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }
  
  try {
    const audioUrl = String(url);
    console.log('[Music] Proxying: ' + audioUrl);
    
    const response = await axios.get(audioUrl, {
      responseType: 'stream',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.kuwo.cn/',
        'Accept': '*/*',
        'Accept-Encoding': 'identity',
        'Connection': 'keep-alive'
      }
    });
    
    const contentType = response.headers['content-type'] || 'audio/mpeg';
    const contentLength = response.headers['content-length'];
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    response.data.pipe(res);
    
    response.data.on('error', function(err) {
      if (err.message === 'aborted' || err.code === 'ECONNABORTED') {
        return;
      }
      console.error('[Music] Stream error: ' + err.message);
    });
    
    req.on('close', function() {
      if (response.data && response.data.destroy) {
        response.data.destroy();
      }
    });
    
  } catch (e) {
    if (e.message === 'aborted' || e.code === 'ECONNABORTED') {
      return;
    }
    console.error('[Music] Proxy error: ' + e.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to proxy audio: ' + e.message });
    }
  }
});

export default router;
