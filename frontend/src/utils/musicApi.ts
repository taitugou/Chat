import api from './api';

export type MusicSource = 'kuwo' | 'auto';

export interface MusicTrack {
  id: string;
  name: string;
  artist: string;
  cover: string;
  url: string;
  duration: number;
  source: 'kuwo';
}

export async function fetchKuwoMusic(): Promise<MusicTrack | null> {
  try {
    const response = await api.get('/music/random');
    
    if (response.data.success && response.data.track) {
      const track = response.data.track;
      const proxyUrl = `/api/music/proxy?url=${encodeURIComponent(track.url)}`;
      
      return {
        ...track,
        url: proxyUrl
      };
    }
    
    return null;
  } catch (e) {
    console.error('Failed to fetch music:', e);
    return null;
  }
}

export async function fetchRandomMusic(source: MusicSource = 'auto'): Promise<MusicTrack | null> {
  return fetchKuwoMusic();
}

export async function prefetchMusic(): Promise<MusicTrack[]> {
  const tracks: MusicTrack[] = [];
  
  const kuwoTrack = await fetchKuwoMusic();
  if (kuwoTrack) tracks.push(kuwoTrack);
  
  return tracks;
}

export function isValidTrack(track: MusicTrack | null): boolean {
  if (!track) return false;
  if (!track.url) return false;
  return true;
}
