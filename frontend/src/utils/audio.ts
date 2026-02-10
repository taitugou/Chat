
const BASE = '/qitafujian/audio/';

const AUDIO_ASSETS = {
  game_start: `${BASE}game_start.wav`,
  game_win: `${BASE}game_win.wav`,
  game_lose: `${BASE}game_lose.wav`,

  ui_click: `${BASE}ui_click.wav`,
  ui_success: `${BASE}ui_success.wav`,
  ui_error: `${BASE}ui_error.wav`,

  game_deal: `${BASE}game_deal.wav`,
  game_card: `${BASE}game_card.wav`,
  game_chip: `${BASE}game_chip.wav`,
  game_bet: `${BASE}game_bet.wav`,
  game_check: `${BASE}game_check.wav`,
  game_fold: `${BASE}game_fold.wav`,
  game_allin: `${BASE}game_allin.wav`,
  game_turn: `${BASE}game_turn.wav`,
  game_timer: `${BASE}game_timer.wav`,
  game_ready: `${BASE}game_ready.wav`,
  game_join: `${BASE}game_join.wav`,

  notify_match: `${BASE}notify_match.wav`,
  notify_msg: `${BASE}notify_msg.wav`,
  notify_sys: `${BASE}notify_sys.wav`,

  call_ring_in: `${BASE}call_ring_in.wav`,
  call_ring_out: `${BASE}call_ring_out.wav`,
  call_connect: `${BASE}call_connect.wav`,
  call_end: `${BASE}call_end.wav`,
  call_busy: `${BASE}call_busy.wav`,

  social_like: `${BASE}social_like.wav`,
  social_gift: `${BASE}social_gift.wav`,
  social_vip: `${BASE}social_vip.wav`,
  pay_success: `${BASE}pay_success.wav`,
};

type AudioKey = keyof typeof AUDIO_ASSETS;

class AudioManager {
  private static instance: AudioManager;
  private audioCache: Map<string, HTMLAudioElement> = new Map();
  private loopCache: Map<string, HTMLAudioElement> = new Map();
  private muted: boolean = false;
  private volume: number = 0.7;
  private ready: boolean = false;

  private constructor() {
    try {
      const mutedRaw = localStorage.getItem('ttg:audio:muted');
      const volumeRaw = localStorage.getItem('ttg:audio:volume');
      if (mutedRaw !== null) this.muted = mutedRaw === '1';
      if (volumeRaw !== null) this.setVolume(Number(volumeRaw));
    } catch {}
    this.preloadCritical();
  }

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  private preloadCritical() {
    // Preload most common sounds
    const critical: AudioKey[] = ['ui_click', 'game_card', 'game_chip', 'game_turn'];
    critical.forEach(key => this.load(key));
  }

  private load(key: AudioKey): HTMLAudioElement {
    if (this.audioCache.has(key)) {
      return this.audioCache.get(key)!;
    }
    const audio = new Audio(AUDIO_ASSETS[key]);
    audio.volume = this.volume;
    this.audioCache.set(key, audio);
    return audio;
  }

  public play(key: AudioKey, volumeScale = 1.0) {
    if (this.muted) return;
    
    const audio = this.load(key);
    // Clone node to allow overlapping sounds of same type
    const clone = audio.cloneNode() as HTMLAudioElement;
    clone.volume = Math.min(1, this.volume * volumeScale);
    clone.play().catch(() => {
      // Autoplay policy might block this
    });
  }

  public playLoop(key: AudioKey, volumeScale = 1.0) {
    if (this.muted) return;
    if (this.loopCache.has(key)) return;
    const audio = new Audio(AUDIO_ASSETS[key]);
    audio.loop = true;
    audio.volume = Math.min(1, this.volume * volumeScale);
    this.loopCache.set(key, audio);
    audio.play().catch(() => {});
  }

  public stopLoop(key: AudioKey) {
    const audio = this.loopCache.get(key);
    if (!audio) return;
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {}
    this.loopCache.delete(key);
  }

  public stopAllLoops() {
    Array.from(this.loopCache.keys()).forEach(k => this.stopLoop(k as AudioKey));
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    try {
      localStorage.setItem('ttg:audio:muted', muted ? '1' : '0');
    } catch {}
    if (muted) this.stopAllLoops();
  }

  public setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    try {
      localStorage.setItem('ttg:audio:volume', String(this.volume));
    } catch {}
    this.audioCache.forEach(audio => {
      audio.volume = this.volume;
    });
    this.loopCache.forEach(audio => {
      audio.volume = this.volume;
    });
  }

  public getMuted() {
    return this.muted;
  }

  public getVolume() {
    return this.volume;
  }

  public markReady() {
    this.ready = true;
  }

  public isReady() {
    return this.ready;
  }
}

export const audioManager = AudioManager.getInstance();
export type { AudioKey };
