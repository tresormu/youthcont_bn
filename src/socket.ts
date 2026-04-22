import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import config from './config/config';

let io: SocketServer;

export const initSocket = (httpServer: HttpServer): SocketServer => {
  io = new SocketServer(httpServer, {
    cors: {
      origin: config.clientUrl,
      credentials: true,
    },
  });

  io.on('connection', (socket: Socket) => {
    // Client joins a room scoped to a specific event
    socket.on('joinEvent', (eventId: string) => {
      socket.join(`event:${eventId}`);
    });

    socket.on('leaveEvent', (eventId: string) => {
      socket.leave(`event:${eventId}`);
    });
  });

  return io;
};

export const emitToEvent = (eventId: string, event: string, payload: unknown): void => {
  if (!io) return;
  io.to(`event:${eventId}`).emit(event, payload);
};
