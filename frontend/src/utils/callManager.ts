import { socket } from './socket';
import { buildRtcConfiguration } from './rtcConfig';

export type CallType = 'video' | 'audio';
export type CallStatus = 'idle' | 'calling' | 'incoming' | 'connected' | 'ended';

export interface CallEvent {
  type: 'incoming' | 'accepted' | 'rejected' | 'ended' | 'busy' | 'error';
  fromId?: number;
  callType?: CallType;
  error?: string;
}

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

  private pendingCandidates: RTCIceCandidateInit[] = [];
  private makingOffer = false;
  private ignoreOffer = false;
  private polite = false;

  constructor(
    targetId: number,
    onStatusChange: (status: CallStatus) => void,
    onRemoteStream: (stream: MediaStream) => void,
    onLocalStream: (stream: MediaStream) => void,
    onError: (error: string) => void,
    roomId?: string,
    selfId?: number,
    onCallTypeChange?: (type: CallType) => void
  ) {
    this.targetId = targetId;
    this.roomId = roomId;
    this.onStatusChange = onStatusChange;
    this.onRemoteStream = onRemoteStream;
    this.onLocalStream = onLocalStream;
    this.onError = onError;
    this.onCallTypeChange = onCallTypeChange;

    if (typeof selfId === 'number') {
      this.polite = selfId > targetId;
    } else {
      this.polite = true;
    }

    this.setupSocketListeners();
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

  private setupSocketListeners() {
    if (!socket) return;

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
      
      // Notify target
      socket.emit('webrtc:call', {
        targetId: this.targetId,
        roomId: this.roomId,
        type: this.callType
      });

      // Start negotiation
      this.makingOffer = true;
      const offer = await this.pc!.createOffer();
      await this.pc!.setLocalDescription(offer);
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
    
    this.status = 'connected';
    this.onStatusChange('connected');

    try {
      await this.initMedia();
      this.createPeerConnection();
      this.sendSignal('accepted', null);
      
      if (this.pc && this.pc.remoteDescription?.type === 'offer') {
          const answer = await this.pc.createAnswer();
          await this.pc.setLocalDescription(answer);
          this.sendSignal('answer', this.pc.localDescription);
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
    this.status = 'idle';
    // No auto reset timeout here, store handles it
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

  private async initMedia() {
    try {
      const constraints = {
        audio: true,
        video: this.callType === 'video'
      };
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.onLocalStream(this.localStream);
    } catch (e: any) {
      console.warn('First attempt to get user media failed:', e);
      
      // Fallback: If video call failed, try audio only
      if (this.callType === 'video') {
        try {
          console.log('Falling back to audio only');
          this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          this.onLocalStream(this.localStream);
          return;
        } catch (e2) {
          console.warn('Fallback to audio only failed:', e2);
        }
      }

      // Final Fallback: Receive only mode
      console.warn('No local media available, proceeding in receive-only mode');
      this.onError('无法获取麦克风或摄像头，将仅接收对方画面');
      this.localStream = null;
    }
  }

  private createPeerConnection() {
    if (this.pc) return;

    this.pc = new RTCPeerConnection(buildRtcConfiguration());

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        const candidateInit: RTCIceCandidateInit = (event.candidate as any)?.toJSON ? (event.candidate as any).toJSON() : (event.candidate as any);
        this.sendSignal('candidate', candidateInit);
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
        if (this.pc?.connectionState === 'connected') {
            if (this.status !== 'connected') {
              this.status = 'connected';
              this.onStatusChange('connected');
            }
            return;
        }
        if (this.pc?.connectionState === 'failed' || this.pc?.connectionState === 'disconnected') {
            this.endCall();
            this.onError('连接断开');
        }
    };

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.pc!.addTrack(track, this.localStream!);
      });
    } else {
      // Receive only mode
      this.pc.addTransceiver('audio', { direction: 'recvonly' });
      if (this.callType === 'video') {
        this.pc.addTransceiver('video', { direction: 'recvonly' });
      }
    }
  }

  private async handleOffer(offer: RTCSessionDescriptionInit) {
    if (!this.pc) this.createPeerConnection();

    // If we are incoming and haven't accepted yet, we should probably wait?
    // But `setRemoteDescription` is needed to handle candidates.
    // If we setRemoteDescription now, we can createAnswer later when user accepts.
    
    const offerCollision = this.makingOffer || this.pc!.signalingState !== 'stable';
    this.ignoreOffer = !this.polite && offerCollision;
    if (this.ignoreOffer) return;

    await this.pc!.setRemoteDescription(new RTCSessionDescription(offer));
    await this.flushPendingCandidates();
    
    // If we are already connected (renegotiation) or if user accepted
    if (this.status === 'connected') {
        const answer = await this.pc!.createAnswer();
        await this.pc!.setLocalDescription(answer);
        this.sendSignal('answer', this.pc!.localDescription);
    }
    // If status is incoming, we wait for acceptCall() to trigger createAnswer
    // But we need to store that we have an offer pending response?
    // No, `signalingState` will be `have-remote-offer`.
  }

  // Modified acceptCall to handle the answer creation
  // Wait, I need to override the previous acceptCall logic.
  // The previous logic just called initMedia().
  // Now I need to check if I have a remote description and create answer.
  
  // Re-writing acceptCall logic below...
  
  private async handleAnswer(answer: RTCSessionDescriptionInit) {
    if (!this.pc) return;
    await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
    await this.flushPendingCandidates();
    if (this.status !== 'connected') {
      this.status = 'connected';
      this.onStatusChange('connected');
    }
  }

  private async handleCandidate(candidate: RTCIceCandidateInit) {
    if (!this.pc) this.createPeerConnection(); // Should exist by now

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
