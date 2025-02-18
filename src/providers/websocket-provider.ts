import "reflect-metadata";
import { App, TemplatedApp } from "uWebSockets.js";
import { Logger } from "../utils/logger";
import type { ClientProvider } from "../interfaces/client-provider";
import { Readable } from "stream";
import type { Context } from "../core/context";

interface WSUserData {
  roomId: string; // 存储路径信息
}

export class WebSocketProvider implements ClientProvider {
  private app: TemplatedApp;
  private ctx: Context;

  constructor(ctx: Context) {
    this.app = App();
    this.ctx = ctx;

    this.setupServer();
  }

  setupServer() {
    this.app.ws<WSUserData>("/livestream/*", {
      maxPayloadLength: 16 * 1024 * 1024,
      upgrade: (res, req, context) => {
        // 在 upgrade 时获取路径
        const path = req.getUrl();

        // 创建 userData 对象，用于存储路径信息
        const userData: WSUserData = {
          roomId: path,
        };

        // 完成 upgrade，传入 userData
        res.upgrade(
          userData, // 传递用户数据
          req.getHeader("sec-websocket-key"),
          req.getHeader("sec-websocket-protocol"),
          req.getHeader("sec-websocket-extensions"),
          context
        );
      },
      open: (ws) => {
        const roomId = ws.getUserData().roomId.split("/")[2];
        const readable = new Readable({
          read() {},
        });

        this.ctx.sessions.set(roomId, readable);

        Logger.info(`A WebSocket connected, roomId: ${roomId}`);
      },
      message: (ws, message, isBinary) => {
        if (isBinary) {
          const roomId = ws.getUserData().roomId.split("/")[2];
          this.ctx.sessions.get(roomId)?.push(Buffer.from(message));
        }
      },
      close: (_, code, message) => {
        Logger.info(
          `WebSocket closed, code: ${code}, message: ${Buffer.from(
            message
          ).toString()}`
        );
      },
    });
  }

  start(port: number = 9001): Promise<void> {
    return new Promise((resolve, reject) => {
      this.app.listen(port, (token) => {
        if (token) {
          Logger.info(`Listening to port ${port}`);
          resolve();
        } else {
          Logger.error(`Failed to listen to port ${port}`);
          reject(new Error(`Failed to listen to port ${port}`));
        }
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      resolve();
    });
  }
}
