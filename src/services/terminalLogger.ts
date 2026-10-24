import { Server } from 'socket.io';

export class TerminalLogger {
  private static io: Server | null = null;
  private static stateGetter: () => any;

  static initialize(ioInstance: Server, stateGetter: () => any) {
    this.io = ioInstance;
    this.stateGetter = stateGetter;
    this.io.on('connection', (socket) => {
      console.log(`[Socket] Client connected: ${socket.id}`);
      // Send the secure backend state to the frontend
      socket.emit('state_init', this.stateGetter());
    });
  }

  static broadcast(event: string, data: any) {
    if (this.io) {
      this.io.emit(event, data);
    }
  }
}