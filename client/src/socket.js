import { io } from 'socket.io-client';

// In production the client is served by the same server, so connect to same origin.
// In development, use VITE_SERVER_URL or fallback to localhost:4000.
const SERVER_URL = import.meta.env.VITE_SERVER_URL || (import.meta.env.PROD ? undefined : 'http://localhost:4000');

const socket = io(SERVER_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});

socket.on('connect', () => {
  console.log('[socket] Connected:', socket.id);
});
socket.on('disconnect', (reason) => {
  console.log('[socket] Disconnected:', reason);
});
socket.on('connect_error', (err) => {
  console.error('[socket] Connection error:', err.message);
});

export default socket;
