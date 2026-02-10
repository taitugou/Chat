import type { Socket } from 'socket.io-client';
import { buildRtcConfiguration } from './rtcConfig';

type VoiceSignalType = 'offer' | 'answer' | 'candidate';

type VoiceSignalPayload = {
  roomId: string;
  fromId: number;
  toId: number;
  type: VoiceSignalType;
  signal: any;
};

type VoiceParticipantsPayload = {
  roomId: string;
  userIds: Array<string | number>;
};

type VoicePresencePayload = {
  roomId: string;
  userId: string | number;
};

type PeerState = {
  userId: string;
  pc: RTCPeerConnection;
  remoteStream: MediaStream;
  audio: HTMLAudioElement;
  makingOffer: boolean;
  ignoreOffer: boolean;
  pendingCandidates: RTCIceCandidateInit[];
  polite: boolean;
  closed: boolean;
  hasIpv6HostCandidate: boolean;
  usingFallbackIce: boolean;
  fallbackTimer: number | null;
};

export class GameVoiceMesh {
  private socket: Socket;
  private roomId: string;
  private selfId: string;
  private peers: Map<string, PeerState> = new Map();
  private localStream: MediaStream | null = null;
  private started: boolean = false;
  private muted: boolean = false;
  private bound: boolean = false;
  private onParticipantsChange?: (userIds: string[]) => void;
  private onStatusChange?: (status: { started: boolean; muted: boolean; peerCount: number }) => void;
  private fallbackIceAfterMs: number = 3500;
  private fastFallbackAfterMs: number = 1200;

  constructor(opts: {
    socket: Socket;
    roomId: string;
    selfId: string | number;
    onParticipantsChange?: (userIds: string[]) => void;
    onStatusChange?: (status: { started: boolean; muted: boolean; peerCount: number }) => void;
  }) {
    this.socket = opts.socket;
    this.roomId = opts.roomId;
    this.selfId = String(opts.selfId);
    this.onParticipantsChange = opts.onParticipantsChange;
    this.onStatusChange = opts.onStatusChange;
    this.bindSocket();
    this.emitStatus();
  }

  public isStarted() {
    return this.started;
  }

  public isMuted() {
    return this.muted;
  }

  public getPeerIds(): string[] {
    return Array.from(this.peers.keys());
  }

  public async start() {
    if (this.started) return;
    this.started = true;
    this.emitStatus();

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.applyMuteToLocalTracks();
    } catch {
      this.localStream = null;
    }

    this.socket.emit('game:voice:join', { roomId: this.roomId });
  }

  public async stop() {
    if (!this.started) return;
    this.started = false;
    this.emitStatus();

    this.socket.emit('game:voice:leave', { roomId: this.roomId });

    const ids = Array.from(this.peers.keys());
    for (const id of ids) {
      this.closePeer(id);
    }
    this.emitParticipants();

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        try {
          track.stop();
        } catch {}
      }
      this.localStream = null;
    }
  }

  public setMuted(muted: boolean) {
    this.muted = !!muted;
    this.applyMuteToLocalTracks();
    this.emitStatus();
  }

  private applyMuteToLocalTracks() {
    if (!this.localStream) return;
    for (const track of this.localStream.getAudioTracks()) {
      track.enabled = !this.muted;
    }
  }

  private emitParticipants() {
    if (!this.onParticipantsChange) return;
    this.onParticipantsChange(this.getPeerIds());
  }

  private emitStatus() {
    if (!this.onStatusChange) return;
    this.onStatusChange({ started: this.started, muted: this.muted, peerCount: this.peers.size });
  }

  private bindSocket() {
    if (this.bound) return;
    this.bound = true;

    this.socket.on('game:voice:participants', (payload: VoiceParticipantsPayload) => {
      if (!payload || String(payload.roomId) !== String(this.roomId)) return;
      const others = (payload.userIds || []).map((id) => String(id)).filter((id) => id && id !== this.selfId);
      for (const id of others) {
        this.ensurePeer(id);
      }
      for (const existing of Array.from(this.peers.keys())) {
        if (!others.includes(existing)) {
          this.closePeer(existing);
        }
      }
      this.emitParticipants();
      for (const id of others) {
        if (this.shouldInitiateWith(id)) {
          this.createOffer(id).catch(() => {});
        }
      }
    });

    this.socket.on('game:voice:joined', (payload: VoicePresencePayload) => {
      if (!payload || String(payload.roomId) !== String(this.roomId)) return;
      const id = String(payload.userId);
      if (!id || id === this.selfId) return;
      if (!this.started) return;
      this.ensurePeer(id);
      this.emitParticipants();
      if (this.shouldInitiateWith(id)) {
        this.createOffer(id).catch(() => {});
      }
    });

    this.socket.on('game:voice:left', (payload: VoicePresencePayload) => {
      if (!payload || String(payload.roomId) !== String(this.roomId)) return;
      const id = String(payload.userId);
      if (!id || id === this.selfId) return;
      this.closePeer(id);
      this.emitParticipants();
    });

    this.socket.on('game:voice:signal', async (payload: VoiceSignalPayload) => {
      if (!payload || String(payload.roomId) !== String(this.roomId)) return;
      const fromId = String(payload.fromId);
      if (!fromId || fromId === this.selfId) return;
      if (!this.started) return;
      const peer = this.ensurePeer(fromId);

      try {
        if (payload.type === 'offer') {
          await this.handleOffer(peer, payload.signal);
        } else if (payload.type === 'answer') {
          await this.handleAnswer(peer, payload.signal);
        } else if (payload.type === 'candidate') {
          await this.handleCandidate(peer, payload.signal);
        }
      } catch {}
    });

    this.socket.on('connect', () => {
      if (!this.started) return;
      this.socket.emit('game:voice:join', { roomId: this.roomId });
    });
  }

  private shouldInitiateWith(otherId: string) {
    if (this.selfId === otherId) return false;
    return this.selfId < otherId;
  }

  private ensurePeer(otherId: string): PeerState {
    const existing = this.peers.get(otherId);
    if (existing) return existing;

    const pc = new RTCPeerConnection(
      buildRtcConfiguration({
        iceServers: [],
        iceCandidatePoolSize: 0
      })
    );
    const remoteStream = new MediaStream();
    const audio = new Audio();
    (audio as any).autoplay = true;
    (audio as any).playsInline = true;
    (audio as any).srcObject = remoteStream;

    const polite = this.selfId > otherId;

    const peer: PeerState = {
      userId: otherId,
      pc,
      remoteStream,
      audio,
      makingOffer: false,
      ignoreOffer: false,
      pendingCandidates: [],
      polite,
      closed: false,
      hasIpv6HostCandidate: false,
      usingFallbackIce: false,
      fallbackTimer: null
    };

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      const candidateInit: RTCIceCandidateInit = (event.candidate as any)?.toJSON ? (event.candidate as any).toJSON() : (event.candidate as any);
      const candStr = (candidateInit as any)?.candidate;
      if (typeof candStr === 'string' && this.isIpv6HostCandidateString(candStr)) {
        peer.hasIpv6HostCandidate = true;
      }
      this.sendCandidateWithPreference(peer, candidateInit);
    };

    pc.ontrack = (event) => {
      const stream = event.streams && event.streams[0] ? event.streams[0] : null;
      if (stream) {
        (peer.audio as any).srcObject = stream;
        try {
          peer.audio.play().catch(() => {});
        } catch {}
        return;
      }
      if (event.track) {
        const hasTrack = peer.remoteStream.getTracks().some((t) => t.id === event.track.id);
        if (!hasTrack) peer.remoteStream.addTrack(event.track);
        (peer.audio as any).srcObject = peer.remoteStream;
        try {
          peer.audio.play().catch(() => {});
        } catch {}
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'connected') {
        this.clearPeerFallbackTimer(peer);
      }
      if (state === 'failed' || state === 'closed' || state === 'disconnected') {
        this.closePeer(otherId);
        this.emitParticipants();
      }
    };

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        pc.addTrack(track, this.localStream);
      }
    } else {
      pc.addTransceiver('audio', { direction: 'recvonly' });
    }

    this.peers.set(otherId, peer);
    this.scheduleFallbackIce(peer);
    this.emitStatus();
    return peer;
  }

  private closePeer(otherId: string) {
    const peer = this.peers.get(otherId);
    if (!peer) return;
    if (peer.closed) return;
    peer.closed = true;
    this.clearPeerFallbackTimer(peer);
    try {
      peer.audio.pause();
    } catch {}
    try {
      (peer.audio as any).srcObject = null;
    } catch {}
    try {
      peer.audio.remove();
    } catch {}
    try {
      peer.pc.close();
    } catch {}
    this.peers.delete(otherId);
    this.emitStatus();
  }

  private sendSignal(toId: string, type: VoiceSignalType, signal: any) {
    if (!this.started) return;
    this.socket.emit('game:voice:signal', {
      roomId: this.roomId,
      toId,
      type,
      signal
    });
  }

  private async createOffer(otherId: string) {
    const peer = this.peers.get(otherId);
    if (!peer) return;
    if (peer.closed) return;

    try {
      peer.makingOffer = true;
      await peer.pc.setLocalDescription(await peer.pc.createOffer());
      this.sendSignal(otherId, 'offer', peer.pc.localDescription);
    } finally {
      peer.makingOffer = false;
    }
  }

  private async handleOffer(peer: PeerState, offer: RTCSessionDescriptionInit) {
    const offerCollision = peer.makingOffer || peer.pc.signalingState !== 'stable';
    peer.ignoreOffer = !peer.polite && offerCollision;
    if (peer.ignoreOffer) return;

    if (offerCollision) {
      try {
        await peer.pc.setLocalDescription({ type: 'rollback' });
      } catch {}
    }

    await peer.pc.setRemoteDescription(new RTCSessionDescription(offer));
    await this.flushPendingCandidates(peer);
    await peer.pc.setLocalDescription(await peer.pc.createAnswer());
    this.sendSignal(peer.userId, 'answer', peer.pc.localDescription);
  }

  private async handleAnswer(peer: PeerState, answer: RTCSessionDescriptionInit) {
    await peer.pc.setRemoteDescription(new RTCSessionDescription(answer));
    await this.flushPendingCandidates(peer);
  }

  private async handleCandidate(peer: PeerState, candidate: RTCIceCandidateInit) {
    if (peer.ignoreOffer) return;
    if (!peer.pc.remoteDescription) {
      peer.pendingCandidates.push(candidate);
      return;
    }
    await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
  }

  private async flushPendingCandidates(peer: PeerState) {
    if (!peer.pc.remoteDescription) return;
    const pending = peer.pendingCandidates;
    peer.pendingCandidates = [];
    for (const c of pending) {
      try {
        await peer.pc.addIceCandidate(new RTCIceCandidate(c));
      } catch {}
    }
  }

  private isIpv6HostCandidateString(candidate: string): boolean {
    if (!/\btyp\s+host\b/.test(candidate)) return false;
    const parts = candidate.trim().split(/\s+/);
    const ip = parts[4];
    if (typeof ip !== 'string') return false;
    if (!ip.includes(':')) return false;
    if (ip.startsWith('::ffff:')) return false;
    if (ip.toLowerCase().startsWith('fe80:')) return false;
    return true;
  }

  private isIpv4HostCandidateString(candidate: string): boolean {
    if (!/\btyp\s+host\b/.test(candidate)) return false;
    const parts = candidate.trim().split(/\s+/);
    const ip = parts[4];
    if (typeof ip !== 'string') return false;
    return ip.includes('.') || ip.startsWith('::ffff:');
  }

  private sendCandidateWithPreference(peer: PeerState, candidateInit: RTCIceCandidateInit) {
    const cand = (candidateInit as any)?.candidate;
    if (typeof cand === 'string' && peer.hasIpv6HostCandidate && this.isIpv4HostCandidateString(cand)) {
      window.setTimeout(() => {
        if (peer.closed) return;
        this.sendSignal(peer.userId, 'candidate', candidateInit);
      }, 250);
      return;
    }
    this.sendSignal(peer.userId, 'candidate', candidateInit);
  }

  private scheduleFallbackIce(peer: PeerState) {
    if (peer.closed) return;
    if (peer.usingFallbackIce) return;
    const hasFallbackServers = (buildRtcConfiguration().iceServers || []).length > 0;
    if (!hasFallbackServers) return;
    if (peer.fallbackTimer) return;
    peer.fallbackTimer = window.setTimeout(() => {
      peer.fallbackTimer = null;
      if (peer.hasIpv6HostCandidate) {
        this.scheduleFallbackIceDelayed(peer);
        return;
      }
      this.applyFallbackIce(peer).catch(() => {});
    }, this.fastFallbackAfterMs);
  }

  private scheduleFallbackIceDelayed(peer: PeerState) {
    if (peer.closed) return;
    if (peer.usingFallbackIce) return;
    if (peer.fallbackTimer) return;
    peer.fallbackTimer = window.setTimeout(() => {
      peer.fallbackTimer = null;
      this.applyFallbackIce(peer).catch(() => {});
    }, this.fallbackIceAfterMs);
  }

  private clearPeerFallbackTimer(peer: PeerState) {
    if (!peer.fallbackTimer) return;
    window.clearTimeout(peer.fallbackTimer);
    peer.fallbackTimer = null;
  }

  private async applyFallbackIce(peer: PeerState) {
    if (peer.closed) return;
    if (peer.pc.connectionState === 'connected') return;
    if (peer.usingFallbackIce) return;

    const cfg = buildRtcConfiguration();
    if (!cfg.iceServers || cfg.iceServers.length === 0) return;

    peer.usingFallbackIce = true;
    try {
      peer.pc.setConfiguration(cfg);
    } catch {
      return;
    }

    if (!this.shouldInitiateWith(peer.userId)) return;

    try {
      peer.makingOffer = true;
      const offer = await peer.pc.createOffer({ iceRestart: true });
      await peer.pc.setLocalDescription(offer);
      this.sendSignal(peer.userId, 'offer', peer.pc.localDescription);
    } finally {
      peer.makingOffer = false;
    }
  }
}
