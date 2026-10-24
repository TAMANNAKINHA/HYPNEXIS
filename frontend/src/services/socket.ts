import { io, Socket } from 'socket.io-client';
import { Dispatch } from 'react';
import type { Action } from '../state';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

let socket: Socket | null = null;

export function initializeSocket(dispatch: Dispatch<Action>): Socket {
  if (socket) {
    return socket;
  }

  socket = io(BACKEND_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => console.log('🔗 Socket connected to backend'));
  socket.on('disconnect', () => console.log('🔌 Socket disconnected'));
  socket.on('connect_error', (error) => console.error('❌ Socket connection error:', error));

  socket.on('state_init', (data) => {
    dispatch({ type: 'INIT_STATE', payload: data });
    if (data.missions) dispatch({ type: 'SET_MISSIONS', payload: data.missions });
  });
  socket.on('log', (entry) => dispatch({ type: 'ADD_LOG', payload: entry }));
  socket.on('chat', (entry) => dispatch({ type: 'ADD_CHAT', payload: entry }));
  socket.on('shield_update', (data) => dispatch({ type: 'UPDATE_SHIELD', payload: data }));
  socket.on('mission_update', (data) => dispatch({ type: 'SET_MISSION', payload: data.mission }));
  socket.on('missions_list', (data) => dispatch({ type: 'SET_MISSIONS', payload: data.missions }));
  socket.on('wallet_status', (data) => dispatch({ type: 'SET_WALLET_STATUS', payload: data.status }));
  socket.on('audit', (entry) => dispatch({ type: 'ADD_AUDIT', payload: entry }));
  socket.on('attack_stats', (data) => dispatch({ type: 'UPDATE_ATTACK_STATS', payload: data }));
  socket.on('policy_update', (data) => dispatch({ type: 'UPDATE_POLICIES', payload: data.policies }));
  socket.on('balance_update', (data) => dispatch({ type: 'UPDATE_BALANCES', payload: data }));
  socket.on('profile_update', (profile) => dispatch({ type: 'UPDATE_PROFILE', payload: profile }));
  socket.on('state_reset', (data) => dispatch({ type: 'INIT_STATE', payload: data }));
  socket.on('time_lock_update', (data) => dispatch({ type: 'UPDATE_TIMELOCK', payload: data.remaining }));
  socket.on('verification_update', (data) => dispatch({ type: 'SET_VERIFICATION', payload: data }));

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  if (socket && socket.connected) {
    socket.disconnect();
    socket = null;
    console.log('🔌 Socket manually disconnected');
  }
}