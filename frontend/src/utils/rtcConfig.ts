export function getIceServersFromEnv(): RTCIceServer[] {
  const raw = (import.meta as any)?.env?.VITE_ICE_SERVERS;
  if (!raw || typeof raw !== 'string') return [];

  const trimmed = raw.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed as RTCIceServer[];
    if (parsed && Array.isArray((parsed as any).iceServers)) return (parsed as any).iceServers as RTCIceServer[];
  } catch {}

  const urls = trimmed
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (!urls.length) return [];
  return [{ urls }];
}

export function buildRtcConfiguration(overrides: Partial<RTCConfiguration> = {}): RTCConfiguration {
  return {
    iceServers: getIceServersFromEnv(),
    iceCandidatePoolSize: 2,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    ...overrides
  };
}

