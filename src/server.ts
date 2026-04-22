import http from 'http';
import app from './app';
import connectDB from './config/db';
import config from './config/config';
import { initSocket } from './socket';

const startServer = async () => {
  try {
    await connectDB();
    const httpServer = http.createServer(app);
    initSocket(httpServer);
    httpServer.listen(config.port, () => {
      console.log(`Server running in ${config.nodeEnv} mode on port ${config.port}`);
    });
  } catch (error) {
    console.error(`Failed to start server: ${error}`);
    process.exit(1);
  }
};

startServer();
