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

export interface VoiceConnectionQuality {
  level: 'excellent' | 'good' | 'fair' | 'poor';
  rtt?: number;
  isIPv6: boolean;
  isDirect: boolean;
}

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
  reconnectAttempts: number;
  lastIceRestartTime: number;
  isRestartingIce: boolean;
  connectionTimer: number | null;
  quality: VoiceConnectionQuality;
};

const CONNECTION_TIMEOUT = 20000;
const RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY_BASE = 1000;

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
  private onQualityChange?: (peerId: string, quality: VoiceConnectionQuality) => void;
  private statsIntervals: Map<string, number> = new Map();

  constructor(opts: {
    socket: Socket;
    roomId: string;
    selfId: string | number;
    onParticipantsChange?: (userIds: string[]) => void;
    onStatusChange?: (status: { started: boolean; muted: boolean; peerCount: number }) => void;
    onQualityChange?: (peerId: string, quality: VoiceConnectionQuality) => void;
  }) {
    this.socket = opts.socket;
    this.roomId = opts.roomId;
    this.selfId = String(opts.selfId);
    this.onParticipantsChange = opts.onParticipantsChange;
    this.onStatusChange = opts.onStatusChange;
    this.onQualityChange = opts.onQualityChange;
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

  public getPeerQuality(peerId: string): VoiceConnectionQuality | undefined {
    return this.peers.get(peerId)?.quality;
  }

  public async start() {
    if (this.started) return;
    this.started = true;
    this.emitStatus();

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });
      this.applyMuteToLocalTracks();
    } catch (e) {
      console.warn('Failed to get audio stream:', e);
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
    
    this.statsIntervals.forEach((interval) => clearInterval(interval));
    this.statsIntervals.clear();
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
      } catch (e) {
        console.error('Voice signal error:', e);
      }
    });

    this.socket.on('connect', () => {
      if (!this.started) return;
      this.socket.emit('game:voice:join', { roomId: this.roomId });
      
      for (const [peerId, peer] of this.peers) {
        if (peer.pc.connectionState !== 'connected') {
          this.attemptPeerReconnect(peerId);
        }
      }
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
      reconnectAttempts: 0,
      lastIceRestartTime: 0,
      isRestartingIce: false,
      connectionTimer: null,
      quality: {
        level: 'good',
        isIPv6: false,
        isDirect: false
      }
    };

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      const candidateInit: RTCIceCandidateInit = (event.candidate as any)?.toJSON 
        ? (event.candidate as any).toJSON() 
        : (event.candidate as any);
      const candStr = (candidateInit as any)?.candidate;
      
      if (typeof candStr === 'string' && this.isIpv6HostCandidateString(candStr)) {
        peer.hasIpv6HostCandidate = true;
        this.sendSignal(peer.userId, 'candidate', candidateInit);
        return;
      }
      
      if (typeof candStr === 'string' && this.isIpv4HostCandidateString(candStr)) {
        return;
      }
      
      this.sendSignal(peer.userId, 'candidate', candidateInit);
    };

    pc.onicecandidateerror = (event) => {
      console.warn(`ICE candidate error for peer ${otherId}:`, event);
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
        this.clearPeerConnectionTimer(peer);
        peer.reconnectAttempts = 0;
        this.startPeerStatsMonitor(peer);
        return;
      }
      
      if (state === 'disconnected') {
        this.handlePeerDisconnected(peer);
        return;
      }
      
      if (state === 'failed') {
        this.handlePeerFailed(peer);
        return;
      }
      
      if (state === 'closed') {
        this.closePeer(otherId);
        this.emitParticipants();
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      
      if (state === 'connected' || state === 'completed') {
        this.clearPeerConnectionTimer(peer);
      }
      
      if (state === 'disconnected') {
        this.handlePeerIceDisconnected(peer);
      }
      
      if (state === 'failed') {
        this.handlePeerIceFailed(peer);
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
    this.schedulePeerConnectionTimeout(peer);
    this.emitStatus();
    return peer;
  }

  private closePeer(otherId: string) {
    const peer = this.peers.get(otherId);
    if (!peer) return;
    if (peer.closed) return;
    peer.closed = true;
    this.clearPeerConnectionTimer(peer);
    this.stopPeerStatsMonitor(otherId);
    
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
    if (!peer || peer.closed) return;

    try {
      peer.makingOffer = true;
      await peer.pc.setLocalDescription(await peer.pc.createOffer());
      this.sendSignal(otherId, 'offer', peer.pc.localDescription);
    } catch (e) {
      console.error(`Create offer failed for peer ${otherId}:`, e);
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
    try {
      await peer.pc.setRemoteDescription(new RTCSessionDescription(answer));
      await this.flushPendingCandidates(peer);
    } catch (e) {
      console.error(`Handle answer failed for peer ${peer.userId}:`, e);
    }
  }

  private async handleCandidate(peer: PeerState, candidate: RTCIceCandidateInit) {
    if (peer.ignoreOffer) return;
    if (!peer.pc.remoteDescription) {
      peer.pendingCandidates.push(candidate);
      return;
    }
    try {
      await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.warn(`Add candidate failed for peer ${peer.userId}:`, e);
    }
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
    if (ip.startsWith('fc') || ip.startsWith('fd')) return false;
    return true;
  }

  private isIpv4HostCandidateString(candidate: string): boolean {
    if (!/\btyp\s+host\b/.test(candidate)) return false;
    const parts = candidate.trim().split(/\s+/);
    const ip = parts[4];
    if (typeof ip !== 'string') return false;
    return ip.includes('.') || ip.startsWith('::ffff:');
  }

  private schedulePeerConnectionTimeout(peer: PeerState) {
    if (peer.connectionTimer) return;
    
    peer.connectionTimer = window.setTimeout(() => {
      if (peer.pc.connectionState !== 'connected' && !peer.closed) {
        console.log(`Connection timeout for peer ${peer.userId}`);
        this.handlePeerFailed(peer);
      }
    }, CONNECTION_TIMEOUT);
  }

  private clearPeerConnectionTimer(peer: PeerState) {
    if (peer.connectionTimer) {
      clearTimeout(peer.connectionTimer);
      peer.connectionTimer = null;
    }
  }

  private handlePeerDisconnected(peer: PeerState) {
    console.log(`Peer ${peer.userId} disconnected, attempting recovery...`);
    this.attemptPeerIceRestart(peer);
  }

  private handlePeerIceDisconnected(peer: PeerState) {
    console.log(`ICE disconnected for peer ${peer.userId}, attempting recovery...`);
    this.attemptPeerIceRestart(peer);
  }

  private handlePeerFailed(peer: PeerState) {
    console.log(`Connection failed for peer ${peer.userId}`);
    
    if (peer.reconnectAttempts < RECONNECT_ATTEMPTS) {
      this.attemptPeerReconnect(peer.userId);
    } else {
      this.closePeer(peer.userId);
      this.emitParticipants();
    }
  }

  private handlePeerIceFailed(peer: PeerState) {
    console.log(`ICE failed for peer ${peer.userId}`);
    
    if (peer.reconnectAttempts < RECONNECT_ATTEMPTS) {
      this.attemptPeerReconnect(peer.userId);
    }
  }

  private async attemptPeerIceRestart(peer: PeerState) {
    if (peer.closed || peer.isRestartingIce) return;
    
    const now = Date.now();
    if (now - peer.lastIceRestartTime < 3000) return;
    
    peer.isRestartingIce = true;
    peer.lastIceRestartTime = now;
    
    console.log(`Attempting ICE restart for peer ${peer.userId}`);
    
    try {
      peer.makingOffer = true;
      const offer = await peer.pc.createOffer({ iceRestart: true });
      await peer.pc.setLocalDescription(offer);
      this.sendSignal(peer.userId, 'offer', peer.pc.localDescription);
    } catch (e) {
      console.error(`ICE restart failed for peer ${peer.userId}:`, e);
    } finally {
      peer.makingOffer = false;
      peer.isRestartingIce = false;
    }
  }

  private async attemptPeerReconnect(peerId: string) {
    const peer = this.peers.get(peerId);
    if (!peer || peer.closed) return;
    
    if (peer.reconnectAttempts >= RECONNECT_ATTEMPTS) {
      this.closePeer(peerId);
      this.emitParticipants();
      return;
    }
    
    peer.reconnectAttempts++;
    const delay = RECONNECT_DELAY_BASE * Math.pow(2, peer.reconnectAttempts - 1);
    
    console.log(`Attempting reconnect for peer ${peerId} (${peer.reconnectAttempts}/${RECONNECT_ATTEMPTS})`);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    if (peer.closed || !this.started) return;
    
    if (!this.socket.connected) {
      console.log(`Socket not connected, waiting for peer ${peerId}`);
      return;
    }
    
    try {
      peer.pc.close();
    } catch {}
    
    const newPc = new RTCPeerConnection(
      buildRtcConfiguration({
        iceServers: [],
        iceCandidatePoolSize: 0
      })
    );
    
    peer.pc = newPc;
    peer.pendingCandidates = [];
    peer.hasIpv6HostCandidate = false;
    peer.isRestartingIce = false;
    
    this.setupPeerConnectionHandlers(peer);
    
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        newPc.addTrack(track, this.localStream);
      }
    } else {
      newPc.addTransceiver('audio', { direction: 'recvonly' });
    }
    
    if (this.shouldInitiateWith(peerId)) {
      try {
        peer.makingOffer = true;
        await newPc.setLocalDescription(await newPc.createOffer());
        this.sendSignal(peerId, 'offer', newPc.localDescription);
      } catch (e) {
        console.error(`Reconnect offer failed for peer ${peerId}:`, e);
        this.handlePeerFailed(peer);
      } finally {
        peer.makingOffer = false;
      }
    }
  }

  private setupPeerConnectionHandlers(peer: PeerState) {
    const pc = peer.pc;
    
    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      const candidateInit: RTCIceCandidateInit = (event.candidate as any)?.toJSON 
        ? (event.candidate as any).toJSON() 
        : (event.candidate as any);
      const candStr = (candidateInit as any)?.candidate;
      
      if (typeof candStr === 'string' && this.isIpv6HostCandidateString(candStr)) {
        peer.hasIpv6HostCandidate = true;
        this.sendSignal(peer.userId, 'candidate', candidateInit);
        return;
      }
      
      if (typeof candStr === 'string' && this.isIpv4HostCandidateString(candStr)) {
        return;
      }
      
      this.sendSignal(peer.userId, 'candidate', candidateInit);
    };

    pc.ontrack = (event) => {
      const stream = event.streams && event.streams[0] ? event.streams[0] : null;
      if (stream) {
        (peer.audio as any).srcObject = stream;
        try {
          peer.audio.play().catch(() => {});
        } catch {}
      } else if (event.track) {
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
        this.clearPeerConnectionTimer(peer);
        peer.reconnectAttempts = 0;
        this.startPeerStatsMonitor(peer);
      } else if (state === 'disconnected') {
        this.handlePeerDisconnected(peer);
      } else if (state === 'failed') {
        this.handlePeerFailed(peer);
      } else if (state === 'closed') {
        this.closePeer(peer.userId);
        this.emitParticipants();
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      
      if (state === 'connected' || state === 'completed') {
        this.clearPeerConnectionTimer(peer);
      } else if (state === 'disconnected') {
        this.handlePeerIceDisconnected(peer);
      } else if (state === 'failed') {
        this.handlePeerIceFailed(peer);
      }
    };
  }

  private startPeerStatsMonitor(peer: PeerState) {
    if (this.statsIntervals.has(peer.userId)) return;
    
    const interval = window.setInterval(async () => {
      if (peer.closed || peer.pc.connectionState !== 'connected') {
        this.stopPeerStatsMonitor(peer.userId);
        return;
      }
      
      try {
        const stats = await peer.pc.getStats();
        let selectedPair: any = null;
        
        stats.forEach((report: any) => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.nominated) {
            selectedPair = report;
          }
        });
        
        if (selectedPair) {
          const quality = this.analyzeConnectionQuality(selectedPair, stats);
          peer.quality = quality;
          if (this.onQualityChange) {
            this.onQualityChange(peer.userId, quality);
          }
        }
      } catch (e) {
        console.warn(`Failed to get stats for peer ${peer.userId}:`, e);
      }
    }, 2000);
    
    this.statsIntervals.set(peer.userId, interval);
  }

  private stopPeerStatsMonitor(peerId: string) {
    const interval = this.statsIntervals.get(peerId);
    if (interval) {
      clearInterval(interval);
      this.statsIntervals.delete(peerId);
    }
  }

  private analyzeConnectionQuality(pair: any, stats: any): VoiceConnectionQuality {
    const rtt = pair.currentRoundTripTime ? pair.currentRoundTripTime * 1000 : undefined;
    
    let localCandidateType: string | undefined;
    let remoteCandidateType: string | undefined;
    let isIPv6 = false;
    let isDirect = false;
    
    stats.forEach((report: any) => {
      if (report.type === 'local-candidate' && report.id === pair.localCandidateId) {
        localCandidateType = report.candidateType;
        if (report.ip && report.ip.includes(':') && !report.ip.startsWith('::ffff:')) {
          isIPv6 = true;
        }
      }
      if (report.type === 'remote-candidate' && report.id === pair.remoteCandidateId) {
        remoteCandidateType = report.candidateType;
      }
    });
    
    if (localCandidateType === 'host' && remoteCandidateType === 'host') {
      isDirect = true;
    }
    
    let level: 'excellent' | 'good' | 'fair' | 'poor' = 'good';
    
    if (rtt !== undefined) {
      if (rtt < 50) level = 'excellent';
      else if (rtt < 150) level = 'good';
      else if (rtt < 300) level = 'fair';
      else level = 'poor';
    }
    
    return {
      level,
      rtt,
      isIPv6,
      isDirect
    };
  }
}
