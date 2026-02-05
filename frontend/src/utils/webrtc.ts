import { socket } from './socket';

export interface P2PSignal {
  fromId: number;
  signal: any;
  type: 'offer' | 'answer' | 'candidate';
  roomId?: string;
  timestamp: number;
}

export interface P2PTransportInfo {
  isConnected: boolean;
  isDirect: boolean;
  isIPv6: boolean;
  localCandidateType?: string;
  remoteCandidateType?: string;
  localAddress?: string;
  remoteAddress?: string;
}

export class P2PConnection {
  private pc: RTCPeerConnection | null = null;
  private controlChannel: RTCDataChannel | null = null;
  private channels: Map<string, RTCDataChannel> = new Map();
  private targetId: number;
  private roomId?: string;
  private selfId?: number;
  private socketListenersBound: boolean = false;
  private onMessageCallback: (data: any) => void;
  private onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  private isInitiator: boolean = false;
  private makingOffer: boolean = false;
  private ignoreOffer: boolean = false;
  private polite: boolean = true;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private incomingFile: {
    name: string;
    mimeType: string;
    size: number;
    received: number;
    chunks: Array<Uint8Array | null>;
    totalChunks?: number;
    receivedChunks?: number;
    transferId?: number;
    endReceived?: boolean;
    messageId?: number;
  } | null = null;
  private statsInterval: number | null = null;
  private onTransportInfo?: (info: P2PTransportInfo) => void;

  private config: RTCConfiguration = {
    iceServers: [],
    iceCandidatePoolSize: 2,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require'
  };

  constructor(
    targetId: number,
    onMessage: (data: any) => void,
    onStateChange: (state: RTCPeerConnectionState) => void,
    onTransportInfo?: (info: P2PTransportInfo) => void,
    roomId?: string,
    selfId?: number
  ) {
    this.targetId = targetId;
    this.onMessageCallback = onMessage;
    this.onConnectionStateChange = onStateChange;
    this.onTransportInfo = onTransportInfo;
    this.roomId = roomId;
    this.selfId = selfId;
    if (typeof selfId === 'number') {
      this.polite = selfId > targetId;
    } else {
      this.polite = true;
    }
    this.setupSocketListeners();
  }

  private setupSocketListeners() {
    if (this.socketListenersBound) return;
    if (!socket) {
      window.setTimeout(() => {
        this.setupSocketListeners();
      }, 500);
      return;
    }
    this.socketListenersBound = true;

    socket.on('webrtc:signal', async (data: P2PSignal) => {
      if (data.fromId !== this.targetId) return;

      try {
        if (data.type === 'offer') {
          await this.handleOffer(data.signal);
        } else if (data.type === 'answer') {
          await this.handleAnswer(data.signal);
        } else if (data.type === 'candidate') {
          await this.handleCandidate(data.signal);
        }
      } catch (err) {
        console.error('WebRTC signal handling error:', err);
      }
    });

    socket.on('webrtc:call', (data: any) => {
      if (data.fromId === this.targetId) {
        if (this.pc?.connectionState === 'connected') return;
        const shouldInitiate = typeof this.selfId === 'number' ? this.selfId < this.targetId : true;
        if (shouldInitiate) {
          this.initiate().catch(() => {});
        }
      }
    });
  }

  private createPeerConnection() {
    this.pc = new RTCPeerConnection(this.config);

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        const cand = event.candidate;
        if (isIPv6HostCandidate(cand)) {
          this.sendSignal('candidate', cand);
        }
      }
    };

    this.pc.onconnectionstatechange = () => {
      if (this.pc) {
        this.onConnectionStateChange(this.pc.connectionState);
        if (this.pc.connectionState === 'connected') {
          this.startStatsMonitor();
        }
        if (this.pc.connectionState === 'failed' || this.pc.connectionState === 'closed' || this.pc.connectionState === 'disconnected') {
          this.stopStatsMonitor();
        }
      }
    };

    this.pc.ondatachannel = (event) => {
      this.setupDataChannel(event.channel);
    };
  }

  private setupDataChannel(channel: RTCDataChannel) {
    this.channels.set(channel.label, channel);
    if (!this.controlChannel || channel.label === 'chat-data') {
      this.controlChannel = channel;
    }
    channel.binaryType = 'arraybuffer';
    channel.onmessage = (event) => {
      this.handleDataChannelMessage(event.data);
    };
    channel.onopen = () => console.log('P2P DataChannel opened:', channel.label);
    channel.onclose = () => console.log('P2P DataChannel closed:', channel.label);
  }

  private async handleDataChannelMessage(data: any) {
    if (typeof data === 'string') {
      let parsed: any = null;
      try {
        parsed = JSON.parse(data);
      } catch {
        this.onMessageCallback(data);
        return;
      }

      if (parsed?.type === 'file-start') {
        const transferId = typeof parsed.transferId === 'number' ? parsed.transferId : undefined;
        const totalChunks = typeof parsed.totalChunks === 'number' ? parsed.totalChunks : undefined;
        this.incomingFile = {
          name: parsed.name || 'file',
          mimeType: parsed.mimeType || 'application/octet-stream',
          size: typeof parsed.size === 'number' ? parsed.size : 0,
          received: 0,
          chunks: totalChunks ? new Array(totalChunks).fill(null) : [],
          totalChunks,
          receivedChunks: totalChunks ? 0 : undefined,
          transferId,
          endReceived: false,
          messageId: typeof parsed.messageId === 'number' ? parsed.messageId : undefined
        };
        this.onMessageCallback({ type: 'file-start', name: this.incomingFile.name, messageId: this.incomingFile.messageId, totalBytes: this.incomingFile.size });
        return;
      }

      if (parsed?.type === 'file-end') {
        const f = this.incomingFile;
        if (!f) return;
        f.endReceived = true;
        this.tryFinalizeIncomingFile(parsed);
        return;
      }

      this.onMessageCallback(parsed);
      return;
    }

    if (data instanceof ArrayBuffer) {
      this.handleIncomingBuffer(data);
      return;
    }

    if (data instanceof Blob) {
      const buf = await data.arrayBuffer();
      this.handleIncomingBuffer(buf);
    }
  }

  private handleIncomingBuffer(buffer: ArrayBuffer) {
    if (!this.incomingFile) return;

    const f = this.incomingFile;
    if (typeof f.transferId === 'number' && buffer.byteLength >= 8 && typeof f.totalChunks === 'number') {
      const view = new DataView(buffer);
      const transferId = view.getUint32(0, true);
      const seq = view.getUint32(4, true);
      if (transferId !== f.transferId) return;
      if (seq >= f.totalChunks) return;
      if (f.chunks[seq]) return;
      const payload = new Uint8Array(buffer, 8);
      f.chunks[seq] = payload;
      f.received += payload.byteLength;
      f.receivedChunks = (f.receivedChunks || 0) + 1;
    } else {
      const chunk = new Uint8Array(buffer);
      f.chunks.push(chunk);
      f.received += chunk.byteLength;
    }

    if (f.size > 0) {
      const progress = Math.min(100, Math.round((f.received / f.size) * 100));
      this.onMessageCallback({ type: 'file-progress', name: f.name, progress, messageId: f.messageId, receivedBytes: f.received, totalBytes: f.size });
    }

    if (f.endReceived) this.tryFinalizeIncomingFile();
  }

  private tryFinalizeIncomingFile(parsedEnd?: any) {
    const f = this.incomingFile;
    if (!f) return;
    if (!f.endReceived) return;

    if (typeof f.totalChunks === 'number') {
      if ((f.receivedChunks || 0) !== f.totalChunks) return;
      if (f.chunks.some((c) => !c)) return;
    }

    const blob = new Blob(f.chunks as Uint8Array[], { type: f.mimeType });
    const messageId = f.messageId;
    const name = parsedEnd?.name || f.name;
    this.incomingFile = null;
    this.onMessageCallback({ type: 'file-complete', name, mimeType: f.mimeType, blob, messageId: typeof parsedEnd?.messageId === 'number' ? parsedEnd.messageId : messageId });
  }

  public async initiate() {
    this.isInitiator = true;
    this.createPeerConnection();
    
    if (!this.pc) return;

    this.controlChannel = this.pc.createDataChannel('chat-data', { ordered: true });
    this.setupDataChannel(this.controlChannel);

    try {
      this.makingOffer = true;
      await this.pc.setLocalDescription(await this.pc.createOffer());
      this.sendSignal('offer', this.pc.localDescription);
    } finally {
      this.makingOffer = false;
    }
  }

  private async handleOffer(offer: RTCSessionDescriptionInit) {
    if (!this.pc) this.createPeerConnection();
    if (!this.pc) return;

    const offerDesc = new RTCSessionDescription(offer);
    const offerCollision = this.makingOffer || this.pc.signalingState !== 'stable';
    this.ignoreOffer = !this.polite && offerCollision;
    if (this.ignoreOffer) return;

    if (offerCollision) {
      try {
        await this.pc.setLocalDescription({ type: 'rollback' });
      } catch {}
    }

    await this.pc.setRemoteDescription(offerDesc);
    await this.flushPendingCandidates();
    await this.pc.setLocalDescription(await this.pc.createAnswer());
    this.sendSignal('answer', this.pc.localDescription);
  }

  private async handleAnswer(answer: RTCSessionDescriptionInit) {
    if (!this.pc) return;
    await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
    await this.flushPendingCandidates();
  }

  private async handleCandidate(candidate: RTCIceCandidateInit) {
    if (!this.pc) return;
    if (!isIPv6HostCandidate(candidate)) return;
    if (this.ignoreOffer) return;
    if (!this.pc.remoteDescription) {
      this.pendingCandidates.push(candidate);
      return;
    }
    await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
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

  private sendSignal(type: 'offer' | 'answer' | 'candidate', signal: any) {
    if (!socket) return;
    if (this.roomId) {
      socket.emit('webrtc:signal', {
        roomId: this.roomId,
        type,
        signal
      });
      return;
    }

    socket.emit('webrtc:signal', {
      targetId: this.targetId,
      type,
      signal
    });
  }

  public send(data: any) {
    const dc = this.controlChannel;
    if (!dc || dc.readyState !== 'open') return false;

    if (typeof data === 'string') {
      dc.send(data);
      return true;
    }

    if (data instanceof ArrayBuffer) {
      dc.send(data);
      return true;
    }

    if (data instanceof Uint8Array) {
      dc.send(data);
      return true;
    }

    if (data instanceof Blob) {
      dc.send(data);
      return true;
    }

    dc.send(JSON.stringify(data));
    return true;
  }

  private waitForBufferedAmountLow(dc: RTCDataChannel, lowThreshold: number): Promise<void> {
    dc.bufferedAmountLowThreshold = lowThreshold;
    return new Promise((resolve) => {
      const handler = () => {
        dc.removeEventListener('bufferedamountlow', handler);
        resolve();
      };
      dc.addEventListener('bufferedamountlow', handler);
    });
  }

  public async sendWithBackpressure(data: any, highWaterMark: number = 8 * 1024 * 1024) {
    const dc = this.controlChannel;
    if (!dc || dc.readyState !== 'open') return false;

    const lowWaterMark = Math.max(256 * 1024, Math.floor(highWaterMark / 2));
    while (dc.bufferedAmount > highWaterMark) {
      await this.waitForBufferedAmountLow(dc, lowWaterMark);
      if (!this.controlChannel || this.controlChannel.readyState !== 'open') return false;
    }

    return this.send(data);
  }

  private getOpenBulkChannels(transferId: number): RTCDataChannel[] {
    const prefix = `bulk:${transferId}:`;
    const out: RTCDataChannel[] = [];
    for (const [label, ch] of this.channels.entries()) {
      if (!label.startsWith(prefix)) continue;
      if (ch.readyState !== 'open') continue;
      out.push(ch);
    }
    return out;
  }

  private async ensureBulkChannels(transferId: number, count: number, timeoutMs: number = 8000) {
    if (!this.pc) return;
    if (!this.isInitiator) {
      await this.waitForBulkChannels(transferId, count, timeoutMs);
      return;
    }

    for (let i = 0; i < count; i++) {
      const label = `bulk:${transferId}:${i}`;
      if (this.channels.has(label)) continue;
      const ch = this.pc.createDataChannel(label, { ordered: false });
      this.setupDataChannel(ch);
    }
    await this.waitForBulkChannels(transferId, count, timeoutMs);
  }

  private async waitForBulkChannels(transferId: number, count: number, timeoutMs: number) {
    const prefix = `bulk:${transferId}:`;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      let open = 0;
      for (const [label, ch] of this.channels.entries()) {
        if (!label.startsWith(prefix)) continue;
        if (ch.readyState === 'open') open++;
      }
      if (open >= count) return;
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  public async sendFileChunksParallel(file: File, opts: { transferId: number; chunkSize: number; channels: number }, onProgress?: (sentBytes: number) => void) {
    if (!this.pc || this.pc.connectionState !== 'connected') throw new Error('P2P连接未建立');
    const channels = Math.max(1, Math.min(8, Math.floor(opts.channels || 1)));
    const chunkSize = Math.max(16 * 1024, Math.min(1024 * 1024, Math.floor(opts.chunkSize || 256 * 1024)));
    const totalChunks = Math.ceil(file.size / chunkSize);

    await this.ensureBulkChannels(opts.transferId, channels);
    const dcs = this.getOpenBulkChannels(opts.transferId);
    const use = dcs.length > 0 ? dcs : (this.controlChannel ? [this.controlChannel] : []);
    if (use.length === 0) throw new Error('P2P通道未就绪');

    let nextSeq = 0;
    let sentBytes = 0;
    const highWaterMark = 16 * 1024 * 1024;
    const lowWaterMark = 4 * 1024 * 1024;

    const sendOne = async (dc: RTCDataChannel) => {
      while (true) {
        const seq = nextSeq;
        nextSeq++;
        if (seq >= totalChunks) return;

        const start = seq * chunkSize;
        const end = Math.min(file.size, start + chunkSize);
        const payload = await file.slice(start, end).arrayBuffer();
        const packet = new ArrayBuffer(8 + payload.byteLength);
        const view = new DataView(packet);
        view.setUint32(0, opts.transferId >>> 0, true);
        view.setUint32(4, seq >>> 0, true);
        new Uint8Array(packet, 8).set(new Uint8Array(payload));

        while (dc.bufferedAmount > highWaterMark) {
          await this.waitForBufferedAmountLow(dc, lowWaterMark);
          if (dc.readyState !== 'open') throw new Error('P2P连接已断开');
        }
        dc.send(packet);
        sentBytes += payload.byteLength;
        if (onProgress) onProgress(sentBytes);
      }
    };

    const workers = use.map((dc) => sendOne(dc));
    await Promise.all(workers);
  }

  private startStatsMonitor() {
    if (!this.pc || this.statsInterval) return;
    const pc = this.pc;

    const tick = async () => {
      try {
        const stats = await pc.getStats();
        let selectedPair: any = null;
        stats.forEach((r: any) => {
          if (r.type === 'candidate-pair' && r.state === 'succeeded' && r.nominated) {
            selectedPair = r;
          }
        });

        const localCandidate = selectedPair ? stats.get(selectedPair.localCandidateId) : null;
        const remoteCandidate = selectedPair ? stats.get(selectedPair.remoteCandidateId) : null;

        const localAddr = localCandidate?.address || localCandidate?.ip;
        const remoteAddr = remoteCandidate?.address || remoteCandidate?.ip;
        const isV6 = typeof localAddr === 'string' && localAddr.includes(':') && typeof remoteAddr === 'string' && remoteAddr.includes(':');

        const info: P2PTransportInfo = {
          isConnected: pc.connectionState === 'connected',
          isDirect: (localCandidate?.candidateType === 'host' && remoteCandidate?.candidateType === 'host') || false,
          isIPv6: isV6,
          localCandidateType: localCandidate?.candidateType,
          remoteCandidateType: remoteCandidate?.candidateType,
          localAddress: localAddr,
          remoteAddress: remoteAddr
        };

        if (this.onTransportInfo) this.onTransportInfo(info);
      } catch {}
    };

    this.statsInterval = window.setInterval(() => {
      tick();
    }, 2000);
    tick();
  }

  private stopStatsMonitor() {
    if (this.statsInterval) {
      window.clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  }

  public disconnect() {
    if (this.dataChannel) this.dataChannel.close();
    if (this.pc) this.pc.close();
    this.stopStatsMonitor();
    this.pc = null;
    this.dataChannel = null;
  }
}

function isIPv6HostCandidate(candidate: any): boolean {
  const candStr = typeof candidate === 'string' ? candidate : candidate?.candidate;
  if (!candStr || typeof candStr !== 'string') return false;
  if (!/\btyp\s+host\b/.test(candStr)) return false;

  // candidate:foundation component protocol priority ip port typ host ...
  const parts = candStr.trim().split(/\s+/);
  const ip = parts[4];
  return typeof ip === 'string' && ip.includes(':') && !ip.startsWith('::ffff:');
}
