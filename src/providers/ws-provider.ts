import "reflect-metadata";
import { Injectable } from "../core/injector";
import { FlvSession } from "../core/flv-session";
import {
  App,
  TemplatedApp,
  WebSocket,
  SHARED_COMPRESSOR,
  us_listen_socket,
} from "uWebSockets.js";

interface WSData {
  id: string;
}

type WebSocketClient = WebSocket<WSData>;

@Injectable()
export class WebSocketProvider {
  private app: TemplatedApp;
  private clients: Map<string, WebSocketClient>;

  constructor(private flvSession: FlvSession) {
    this.app = App();
    this.clients = new Map();
    this.setupWebSocketServer();
  }

  private setupWebSocketServer(): void {
    this.app.ws("/flv", {
      compression: SHARED_COMPRESSOR,
      maxPayloadLength: 16 * 1024 * 1024, // 16MB
      idleTimeout: 60,

      open: (ws: WebSocketClient) => {
        const id = Math.random().toString(36).substr(2, 9);
        ws.getUserData().id = id;
        this.clients.set(id, ws);
        console.log("New WebSocket connection established");
      },

      message: (
        ws: WebSocketClient,
        message: ArrayBuffer,
        isBinary: boolean
      ) => {
        if (!isBinary) {
          console.warn("Received non-binary message, ignoring");
          return;
        }

        try {
          // uWebSockets.js已经提供了ArrayBuffer,直接转换为Uint8Array
          this.flvSession.pushData(new Uint8Array(message));
        } catch (error) {
          console.error("Error processing WebSocket message:", error);
          ws.end();
        }
      },

      drain: (ws: WebSocketClient) => {
        console.log("WebSocket backpressure: " + ws.getBufferedAmount());
      },

      close: (ws: WebSocketClient, code: number, message: ArrayBuffer) => {
        const userData = ws.getUserData();
        if (userData.id) {
          this.clients.delete(userData.id);
        }
        console.log(`WebSocket connection closed with code ${code}`);
      },
    });
  }

  public async startServer(port: number = 8080): Promise<void> {
    return new Promise((resolve, reject) => {
      this.app.listen(port, (listenSocket: us_listen_socket) => {
        if (listenSocket) {
          console.log(`WebSocket server started on port ${port}`);
          resolve();
        } else {
          reject(new Error(`Failed to listen on port ${port}`));
        }
      });
    });
  }

  public shutdown(): void {
    // uWS.App()没有直接的关闭方法
    // 通常进程退出时会自动关闭
    console.log("WebSocket server resources released");
  }
}
