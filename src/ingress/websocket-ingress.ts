import "reflect-metadata";
import { App, TemplatedApp } from "uWebSockets.js";
import { Readable } from "stream";
import type { BaseIngress } from "./base-ingress";
import { Logger } from "../utils/logger";

export class WebSocketIngress extends Readable implements BaseIngress {
  private app: TemplatedApp;
  private sockets: Set<any> = new Set();

  constructor() {
    super();
    this.app = App();
    this.#setupServer();
  }

  #setupServer() {
    this.app.ws("/*", {
      open: (ws) => {
        this.sockets.add(ws);
        console.log("A WebSocket connected!");
      },
      message: (ws, message, isBinary) => {
        if (isBinary) {
          this.handleMediaData(connection, data);
        }
      },
      close: (ws) => {
        this.sockets.delete(ws);
        console.log("WebSocket closed");
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
      for (const ws of this.sockets) {
        ws.close();
      }
      this.sockets.clear();
      resolve();
    });
  }

  protected handleConnection(connection: any): void {}

  protected handleDisconnection(connection: any): void {}

  protected handleMediaData(connection: any, data: Buffer): void {}

  protected handleError(error: Error, connection?: any): void {}
}
