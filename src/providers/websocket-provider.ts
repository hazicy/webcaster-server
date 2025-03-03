import "reflect-metadata";
import { App, TemplatedApp } from "uWebSockets.js";
import { Logger } from "../utils/logger";
import type { ClientProvider } from "../interfaces/client-provider";
import { Readable } from "stream";
import type { Context } from "../core/context";
import { FLVHandler } from "../core/flv-handler";

interface WSUserData {
  streamApp?: string;
  streamName: string; // 存储路径信息
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
        const streamName = req.getUrl().split("/").pop()!;

        // 创建 userData 对象，用于存储路径信息
        const userData: WSUserData = {
          streamName,
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
        const streamName = ws.getUserData().streamName;
        const readable = new Readable({
          read() {},
        });

        this.ctx.sources.set(streamName, readable);

        const handler = new FLVHandler(this.ctx, streamName);
        handler.run();

        Logger.info(`A WebSocket connected, streamName: ${streamName}`);
      },
      message: (ws, message, isBinary) => {
        if (isBinary) {
          try {
            const streamName = ws.getUserData().streamName;
            this.ctx.sources.get(streamName)?.push(Buffer.from(message));
          } catch (error) {
            Logger.error(
              error instanceof Error ? error.message : "Unknown error"
            );
          }
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
