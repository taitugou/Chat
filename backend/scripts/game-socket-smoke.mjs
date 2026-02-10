import { io } from 'socket.io-client';

const SOCKET_URL = process.env.SOCKET_URL || 'https://localhost:888';
const TOKEN = process.env.TOKEN;
const ROOM_ID = process.env.ROOM_ID;

if (!TOKEN) {
  process.stderr.write('Missing TOKEN env\n');
  process.exit(2);
}

if (!ROOM_ID) {
  process.stderr.write('Missing ROOM_ID env\n');
  process.exit(2);
}

const socket = io(SOCKET_URL, {
  path: '/socket.io',
  transports: ['websocket'],
  auth: { token: TOKEN },
  reconnection: false,
  timeout: 10000
});

function once(event) {
  return new Promise((resolve) => socket.once(event, resolve));
}

async function run() {
  const events = [
    'connect',
    'disconnect',
    'connect_error',
    'game:started',
    'game:state_update',
    'game:hand',
    'game:player_action',
    'game:player_bet',
    'game:finished',
    'game:error'
  ];
  for (const e of events) {
    socket.on(e, (payload) => {
      const msg = typeof payload === 'string' ? payload : JSON.stringify(payload);
      process.stdout.write(`[${e}] ${msg}\n`);
    });
  }

  await once('connect');

  socket.emit('game:join_room', { roomId: Number(ROOM_ID) });

  await Promise.race([
    once('game:state_update'),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting game:state_update')), 8000))
  ]);

  socket.emit('game:leave_room', { roomId: Number(ROOM_ID) });
  socket.disconnect();
  process.stdout.write('game-socket-smoke: ok\n');
}

run().catch((e) => {
  process.stderr.write(`${e?.stack || e}\n`);
  try {
    socket.disconnect();
  } catch {}
  process.exit(1);
});

