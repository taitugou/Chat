import { socket } from './socket';
import { buildRtcConfiguration } from './rtcConfig';

export type CallType = 'video' | 'audio';
export type CallStatus = 'idle' | 'calling' | 'incoming' | 'connecting' | 'connected' | 'reconnecting' | 'ended';

export interface CallEvent {
  type: 'incoming' | 'accepted' | 'rejected' | 'ended' | 'busy' | 'error';
  fromId?: number;
  callType?: CallType;
  error?: string;
}

export interface ConnectionQuality {
  level: 'excellent' | 'good' | 'fair' | 'poor';
  rtt?: number;
  packetLoss?: number;
  availableBitrate?: number;
  isIPv6: boolean;
  isDirect: boolean;
  localCandidateType?: string;
  remoteCandidateType?: string;
}

export interface CallStats {
  duration: number;
  quality: ConnectionQuality;
  bytesReceived: number;
  bytesSent: number;
}

const ICE_GATHERING_TIMEOUT = 5000;
const CONNECTION_TIMEOUT = 30000;
const RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY_BASE = 1000;

export class CallManager {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private targetId: number;
  private roomId?: string;
  private status: CallStatus = 'idle';
  private callType: CallType = 'video';
  
  private onStatusChange: (status: CallStatus) => void;
  private onCallTypeChange?: (type: CallType) => void;
  private onRemoteStream: (stream: MediaStream) => void;
  private onLocalStream: (stream: MediaStream) => void;
  private onError: (error: string) => void;
  private onQualityChange?: (quality: ConnectionQuality) => void;

  private pendingCandidates: RTCIceCandidateInit[] = [];
  private makingOffer = false;
  private ignoreOffer = false;
  private polite = false;
  
  private hasIpv6HostCandidate = false;
  private iceGatheringTimer: number | null = null;
  private connectionTimer: number | null = null;
  private reconnectAttempts = 0;
  private statsInterval: number | null = null;
  private callStartTime: number = 0;
  private lastIceRestartTime = 0;
  private isRestartingIce = false;
  private socketListenersBound = false;
  private socketReconnectHandler: (() => void) | null = null;

  constructor(
    targetId: number,
    onStatusChange: (status: CallStatus) => void,
    onRemoteStream: (stream: MediaStream) => void,
    onLocalStream: (stream: MediaStream) => void,
    onError: (error: string) => void,
    roomId?: string,
    selfId?: number,
    onCallTypeChange?: (type: CallType) => void,
    onQualityChange?: (quality: ConnectionQuality) => void
  ) {
    this.targetId = targetId;
    this.roomId = roomId;
    this.onStatusChange = onStatusChange;
    this.onRemoteStream = onRemoteStream;
    this.onLocalStream = onLocalStream;
    this.onError = onError;
    this.onCallTypeChange = onCallTypeChange;
    this.onQualityChange = onQualityChange;

    if (typeof selfId === 'number') {
      this.polite = selfId > targetId;
    } else {
      this.polite = true;
    }

    this.setupSocketListeners();
    this.setupSocketReconnectHandler();
  }

  public handleIncomingCall(data: any) {
    if (data.fromId !== this.targetId) return;
    if (data.type !== 'video' && data.type !== 'audio') return;

    if (this.status !== 'idle') {
      this.sendSignal('busy', null);
      return;
    }

    this.callType = data.type;
    if (this.onCallTypeChange) this.onCallTypeChange(this.callType);
    this.status = 'incoming';
    this.onStatusChange('incoming');
  }

  private setupSocketReconnectHandler() {
    if (!socket) return;
    
    this.socketReconnectHandler = () => {
      if (this.status === 'connected' || this.status === 'connecting' || this.status === 'reconnecting') {
        this.attemptReconnect();
      }
    };
    
    socket.on('connect', this.socketReconnectHandler);
  }

  private setupSocketListeners() {
    if (!socket || this.socketListenersBound) return;
    this.socketListenersBound = true;

    socket.on('webrtc:call', (data: any) => {
      this.handleIncomingCall(data);
    });

    socket.on('webrtc:signal', async (data: any) => {
      if (data.fromId !== this.targetId) return;
      if (data.usage !== 'media') return;

      try {
        if (data.type === 'offer') {
          await this.handleOffer(data.signal);
        } else if (data.type === 'answer') {
          await this.handleAnswer(data.signal);
        } else if (data.type === 'accepted') {
          if (this.status !== 'connected') {
            this.status = 'connected';
            this.onStatusChange('connected');
            this.callStartTime = Date.now();
            this.startStatsMonitor();
          }
        } else if (data.type === 'candidate') {
          await this.handleCandidate(data.signal);
        } else if (data.type === 'bye') {
          this.endCall(false);
        } else if (data.type === 'reject') {
          this.status = 'ended';
          this.onStatusChange('ended');
          this.cleanup();
          this.onError('对方已拒绝');
        } else if (data.type === 'busy') {
          this.status = 'ended';
          this.onStatusChange('ended');
          this.cleanup();
          this.onError('对方忙线中');
        }
      } catch (err: any) {
        console.error('Call signal error:', err);
        this.onError(err.message || 'Call error');
      }
    });
  }

  public async startCall(type: CallType) {
    if (this.status !== 'idle') return;
    
    this.callType = type;
    this.status = 'calling';
    this.onStatusChange('calling');

    try {
      if (!socket) {
        this.onError('Socket未连接');
        this.endCall(false);
        return;
      }
      await this.initMedia();
      this.createPeerConnection();
      
      socket.emit('webrtc:call', {
        targetId: this.targetId,
        roomId: this.roomId,
        type: this.callType
      });

      this.makingOffer = true;
      const offer = await this.pc!.createOffer();
      await this.pc!.setLocalDescription(offer);
      
      this.scheduleIceGatheringTimeout();
      this.scheduleConnectionTimeout();
      
      this.sendSignal('offer', this.pc!.localDescription);
    } catch (e: any) {
      console.error('Start call failed:', e);
      this.onError('无法启动通话: ' + e.message);
      this.endCall();
    } finally {
      this.makingOffer = false;
    }
  }

  public async acceptCall() {
    if (this.status !== 'incoming') return;
    
    this.status = 'connecting';
    this.onStatusChange('connecting');

    try {
      await this.initMedia();
      this.createPeerConnection();
      this.sendSignal('accepted', null);
      
      if (this.pc && this.pc.remoteDescription?.type === 'offer') {
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        
        this.scheduleIceGatheringTimeout();
        this.scheduleConnectionTimeout();
        
        this.sendSignal('answer', this.pc!.localDescription);
      }
    } catch (e: any) {
      console.error('Accept call failed:', e);
      this.onError('接听失败: ' + e.message);
      this.endCall();
    }
  }

  public rejectCall() {
    if (this.status !== 'incoming') return;
    this.sendSignal('reject', null);
    this.endCall();
  }

  public endCall(notify = true) {
    if (this.status === 'idle') return;
    
    if (notify) {
      this.sendSignal('bye', null);
    }

    this.status = 'ended';
    this.onStatusChange('ended');
    this.cleanup();
  }

  public cleanup() {
    this.clearAllTimers();
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    if (this.remoteStream) {
      this.remoteStream = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    
    if (socket && this.socketReconnectHandler) {
      socket.off('connect', this.socketReconnectHandler);
      this.socketReconnectHandler = null;
    }
    
    this.status = 'idle';
    this.reconnectAttempts = 0;
    this.hasIpv6HostCandidate = false;
    this.pendingCandidates = [];
  }

  private clearAllTimers() {
    if (this.iceGatheringTimer) {
      clearTimeout(this.iceGatheringTimer);
      this.iceGatheringTimer = null;
    }
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  }

  public async switchCamera() {
    if (!this.pc) return;
    if (!this.localStream) return;
    if (this.callType !== 'video') return;

    const currentTrack = this.localStream.getVideoTracks()[0];
    if (!currentTrack) return;

    const currentFacing = currentTrack.getSettings?.().facingMode;
    const nextFacing = currentFacing === 'environment' ? 'user' : 'environment';

    let newTrack: MediaStreamTrack | null = null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: nextFacing } },
        audio: false
      });
      newTrack = stream.getVideoTracks()[0] || null;
    } catch {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        newTrack = stream.getVideoTracks()[0] || null;
      } catch {
        return;
      }
    }
    if (!newTrack) return;

    const sender = this.pc.getSenders().find((s) => s.track?.kind === 'video') || null;

    try {
      await sender?.replaceTrack(newTrack);
    } catch {
      newTrack.stop();
      return;
    }

    try {
      this.localStream.removeTrack(currentTrack);
    } catch {}
    currentTrack.stop();
    this.localStream.addTrack(newTrack);
    this.onLocalStream(this.localStream);
  }

  public toggleMute(muted: boolean) {
    if (!this.localStream) return;
    this.localStream.getAudioTracks().forEach(track => {
      track.enabled = !muted;
    });
  }

  public async switchAudioDevice(deviceId: string) {
    if (!this.localStream || !this.pc) return;
    
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } },
        video: false
      });
      
      const newTrack = newStream.getAudioTracks()[0];
      if (!newTrack) return;
      
      const sender = this.pc.getSenders().find(s => s.track?.kind === 'audio');
      if (sender) {
        await sender.replaceTrack(newTrack);
      }
      
      const oldTrack = this.localStream.getAudioTracks()[0];
      if (oldTrack) {
        this.localStream.removeTrack(oldTrack);
        oldTrack.stop();
      }
      this.localStream.addTrack(newTrack);
      this.onLocalStream(this.localStream);
    } catch (e) {
      console.error('Switch audio device failed:', e);
    }
  }

  public getCallStats(): CallStats {
    const duration = this.callStartTime ? (Date.now() - this.callStartTime) / 1000 : 0;
    return {
      duration,
      quality: {
        level: 'good',
        isIPv6: this.hasIpv6HostCandidate,
        isDirect: true
      },
      bytesReceived: 0,
      bytesSent: 0
    };
  }

  private async initMedia() {
    try {
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: this.callType === 'video' ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        } : false
      };
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.onLocalStream(this.localStream);
    } catch (e: any) {
      console.warn('First attempt to get user media failed:', e);
      
      if (this.callType === 'video') {
        try {
          console.log('Falling back to audio only');
          this.localStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
              echoCancellation: true,
              noiseSuppression: true
            }, 
            video: false 
          });
          this.onLocalStream(this.localStream);
          return;
        } catch (e2) {
          console.warn('Fallback to audio only failed:', e2);
        }
      }

      console.warn('No local media available, proceeding in receive-only mode');
      this.onError('无法获取麦克风或摄像头，将仅接收对方画面');
      this.localStream = null;
    }
  }

  private createPeerConnection() {
    if (this.pc) return;

    const config = buildRtcConfiguration({
      iceServers: []
    });

    this.pc = new RTCPeerConnection(config);

    this.pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      
      const candidateInit: RTCIceCandidateInit = (event.candidate as any)?.toJSON 
        ? (event.candidate as any).toJSON() 
        : (event.candidate as any);
      
      const candStr = (candidateInit as any)?.candidate;
      
      if (typeof candStr === 'string' && this.isIpv6HostCandidateString(candStr)) {
        this.hasIpv6HostCandidate = true;
        this.sendSignal('candidate', candidateInit);
        return;
      }
      
      if (typeof candStr === 'string' && this.isIpv4HostCandidateString(candStr)) {
        return;
      }
      
      this.sendSignal('candidate', candidateInit);
    };

    this.pc.onicecandidateerror = (event) => {
      console.warn('ICE candidate error:', event);
    };

    this.pc.onicegatheringstatechange = () => {
      if (this.pc?.iceGatheringState === 'complete') {
        this.clearIceGatheringTimeout();
      }
    };

    this.pc.ontrack = (event) => {
      const stream = event.streams && event.streams[0] ? event.streams[0] : null;
      if (stream) {
        this.remoteStream = stream;
        this.onRemoteStream(this.remoteStream);
        return;
      }

      if (!this.remoteStream) {
        this.remoteStream = new MediaStream();
      }
      if (event.track) {
        const hasTrack = this.remoteStream.getTracks().some((t) => t.id === event.track.id);
        if (!hasTrack) {
          this.remoteStream.addTrack(event.track);
        }
      }
      this.onRemoteStream(this.remoteStream);
    };

    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState;
      console.log('Connection state:', state);
      
      if (state === 'connected') {
        this.clearConnectionTimeout();
        if (this.status !== 'connected') {
          this.status = 'connected';
          this.onStatusChange('connected');
          this.callStartTime = Date.now();
          this.reconnectAttempts = 0;
          this.startStatsMonitor();
        }
        return;
      }
      
      if (state === 'connecting') {
        if (this.status !== 'connecting' && this.status !== 'reconnecting') {
          this.status = 'connecting';
          this.onStatusChange('connecting');
        }
        return;
      }
      
      if (state === 'disconnected') {
        this.handleConnectionDisconnected();
        return;
      }
      
      if (state === 'failed') {
        this.handleConnectionFailed();
        return;
      }
      
      if (state === 'closed') {
        this.endCall(false);
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      const state = this.pc?.iceConnectionState;
      console.log('ICE connection state:', state);
      
      if (state === 'connected' || state === 'completed') {
        this.clearConnectionTimeout();
      }
      
      if (state === 'disconnected') {
        this.handleIceDisconnected();
      }
      
      if (state === 'failed') {
        this.handleIceFailed();
      }
    };

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.pc!.addTrack(track, this.localStream!);
      });
    } else {
      this.pc.addTransceiver('audio', { direction: 'recvonly' });
      if (this.callType === 'video') {
        this.pc.addTransceiver('video', { direction: 'recvonly' });
      }
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

  private scheduleIceGatheringTimeout() {
    this.iceGatheringTimer = window.setTimeout(() => {
      if (this.pc?.iceGatheringState !== 'complete') {
        console.log('ICE gathering timeout, proceeding with available candidates');
      }
    }, ICE_GATHERING_TIMEOUT);
  }

  private clearIceGatheringTimeout() {
    if (this.iceGatheringTimer) {
      clearTimeout(this.iceGatheringTimer);
      this.iceGatheringTimer = null;
    }
  }

  private scheduleConnectionTimeout() {
    this.connectionTimer = window.setTimeout(() => {
      if (this.status !== 'connected' && this.status !== 'ended') {
        console.log('Connection timeout');
        this.handleConnectionFailed();
      }
    }, CONNECTION_TIMEOUT);
  }

  private clearConnectionTimeout() {
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }
  }

  private handleConnectionDisconnected() {
    console.log('Connection disconnected, attempting to recover...');
    
    if (this.status === 'connected') {
      this.status = 'reconnecting';
      this.onStatusChange('reconnecting');
    }
    
    this.attemptIceRestart();
  }

  private handleIceDisconnected() {
    console.log('ICE disconnected, attempting to recover...');
    
    if (this.status === 'connected') {
      this.status = 'reconnecting';
      this.onStatusChange('reconnecting');
    }
    
    this.attemptIceRestart();
  }

  private handleConnectionFailed() {
    console.log('Connection failed');
    
    if (this.reconnectAttempts < RECONNECT_ATTEMPTS) {
      this.attemptReconnect();
    } else {
      this.onError('连接失败，请重试');
      this.endCall(false);
    }
  }

  private handleIceFailed() {
    console.log('ICE failed');
    
    if (this.reconnectAttempts < RECONNECT_ATTEMPTS) {
      this.attemptReconnect();
    } else {
      this.onError('连接失败，请重试');
      this.endCall(false);
    }
  }

  private async attemptIceRestart() {
    if (!this.pc || this.isRestartingIce) return;
    
    const now = Date.now();
    if (now - this.lastIceRestartTime < 3000) return;
    
    this.isRestartingIce = true;
    this.lastIceRestartTime = now;
    
    console.log('Attempting ICE restart...');
    
    try {
      this.makingOffer = true;
      const offer = await this.pc.createOffer({ iceRestart: true });
      await this.pc.setLocalDescription(offer);
      this.sendSignal('offer', this.pc.localDescription);
    } catch (e) {
      console.error('ICE restart failed:', e);
    } finally {
      this.makingOffer = false;
      this.isRestartingIce = false;
    }
  }

  private async attemptReconnect() {
    if (this.reconnectAttempts >= RECONNECT_ATTEMPTS) {
      this.onError('重连失败，请重试');
      this.endCall(false);
      return;
    }
    
    this.reconnectAttempts++;
    const delay = RECONNECT_DELAY_BASE * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Attempting reconnect (${this.reconnectAttempts}/${RECONNECT_ATTEMPTS}) in ${delay}ms`);
    
    this.status = 'reconnecting';
    this.onStatusChange('reconnecting');
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    if (this.status !== 'reconnecting') return;
    
    if (!socket?.connected) {
      console.log('Socket not connected, waiting...');
      return;
    }
    
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    
    this.pendingCandidates = [];
    this.hasIpv6HostCandidate = false;
    
    this.createPeerConnection();
    
    try {
      this.makingOffer = true;
      const offer = await this.pc!.createOffer();
      await this.pc!.setLocalDescription(offer);
      
      this.scheduleIceGatheringTimeout();
      this.scheduleConnectionTimeout();
      
      this.sendSignal('offer', this.pc!.localDescription);
    } catch (e) {
      console.error('Reconnect offer failed:', e);
      this.handleConnectionFailed();
    } finally {
      this.makingOffer = false;
    }
  }

  private startStatsMonitor() {
    if (this.statsInterval) return;
    
    this.statsInterval = window.setInterval(async () => {
      if (!this.pc || this.status !== 'connected') {
        this.stopStatsMonitor();
        return;
      }
      
      try {
        const stats = await this.pc.getStats();
        let selectedPair: any = null;
        let inboundStats: any = null;
        let outboundStats: any = null;
        
        stats.forEach((report: any) => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.nominated) {
            selectedPair = report;
          }
          if (report.type === 'inbound-rtp' && report.kind === 'audio') {
            inboundStats = report;
          }
          if (report.type === 'outbound-rtp' && report.kind === 'audio') {
            outboundStats = report;
          }
        });
        
        if (selectedPair && this.onQualityChange) {
          const quality = this.analyzeConnectionQuality(selectedPair, stats);
          this.onQualityChange(quality);
        }
      } catch (e) {
        console.warn('Failed to get connection stats:', e);
      }
    }, 2000);
  }

  private stopStatsMonitor() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  }

  private analyzeConnectionQuality(pair: any, stats: any): ConnectionQuality {
    const rtt = pair.currentRoundTripTime ? pair.currentRoundTripTime * 1000 : undefined;
    const availableBitrate = pair.availableOutgoingBitrate;
    
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
      if (rtt < 100) level = 'excellent';
      else if (rtt < 200) level = 'good';
      else if (rtt < 400) level = 'fair';
      else level = 'poor';
    }
    
    if (availableBitrate !== undefined && availableBitrate < 50000) {
      level = 'poor';
    }
    
    return {
      level,
      rtt,
      availableBitrate,
      isIPv6,
      isDirect,
      localCandidateType,
      remoteCandidateType
    };
  }

  private async handleOffer(offer: RTCSessionDescriptionInit) {
    if (!this.pc) this.createPeerConnection();

    const offerCollision = this.makingOffer || this.pc!.signalingState !== 'stable';
    this.ignoreOffer = !this.polite && offerCollision;
    if (this.ignoreOffer) return;
    
    if (offerCollision) {
      try {
        await this.pc!.setLocalDescription({ type: 'rollback' });
      } catch {}
    }

    await this.pc!.setRemoteDescription(new RTCSessionDescription(offer));
    await this.flushPendingCandidates();
    
    if (this.status === 'connected' || this.status === 'reconnecting') {
      const answer = await this.pc!.createAnswer();
      await this.pc!.setLocalDescription(answer);
      this.sendSignal('answer', this.pc!.localDescription);
    }
  }

  private async handleAnswer(answer: RTCSessionDescriptionInit) {
    if (!this.pc) return;
    
    try {
      await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
      await this.flushPendingCandidates();
      
      if (this.status !== 'connected') {
        this.status = 'connected';
        this.onStatusChange('connected');
        this.callStartTime = Date.now();
        this.startStatsMonitor();
      }
    } catch (e) {
      console.error('Failed to handle answer:', e);
    }
  }

  private async handleCandidate(candidate: RTCIceCandidateInit) {
    if (!this.pc) this.createPeerConnection();

    if (!this.pc!.remoteDescription) {
      this.pendingCandidates.push(candidate);
      return;
    }
    
    try {
      await this.pc!.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.error('Add candidate failed', e);
    }
  }

  private async flushPendingCandidates() {
    if (!this.pc || !this.pc.remoteDescription) return;
    const pending = this.pendingCandidates;
    this.pendingCandidates = [];
    for (const c of pending) {
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(c));
      } catch {}
    }
  }

  private sendSignal(type: string, signal: any) {
    if (!socket) return;
    const data = {
      targetId: this.targetId,
      roomId: this.roomId,
      type,
      signal,
      usage: 'media'
    };
    socket.emit('webrtc:signal', data);
  }
}
