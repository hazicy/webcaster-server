import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { FLVSession } from "../core/flv-session";
import { Logger } from "../utils/logger";

interface HTTPServerOptions {
  port?: number;
  host?: string;
  cors?: boolean;
}

export class HTTPServer {
  private server;
  private sessions: Map<string, FLVSession>;
  private logger: Logger;

  constructor(options: HTTPServerOptions = {}) {
    this.server = createServer(this.handleRequest.bind(this));
    this.sessions = new Map();
    this.logger = new Logger("HTTPServer");

    const { port = 8000, host = "0.0.0.0" } = options;

    this.server.listen(port, host, () => {
      this.logger.info(`HTTP Server running at http://${host}:${port}`);
    });

    // 错误处理
    this.server.on("error", (error) => {
      this.logger.error("Server error:", error);
    });
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse) {
    // 处理 CORS
    this.setCORSHeaders(res);
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // 只处理 GET 请求
    if (req.method !== "GET") {
      res.writeHead(405);
      res.end("Method Not Allowed");
      return;
    }

    const url = new URL(req.url!, `http://${req.headers.host}`);
    
    // 处理 FLV 请求
    if (url.pathname.endsWith(".flv")) {
      this.handleFLVRequest(req, res, url);
      return;
    }

    // 其他路径返回 404
    res.writeHead(404);
    res.end("Not Found");
  }

  private handleFLVRequest(
    req: IncomingMessage,
    res: ServerResponse,
    url: URL
  ) {
    const streamPath = url.pathname;
    
    const cleanup = () => {
      const session = this.sessions.get(streamPath);
      if (session?.getSessionInfo().clientCount === 0) {
        this.sessions.delete(streamPath);
        this.logger.info(`Session cleaned up: ${streamPath}`);
      }
    };

    // 获取或创建会话
    let session = this.sessions.get(streamPath);
    if (!session) {
      session = new FLVSession();
      this.sessions.set(streamPath, session);

      session.on("error", (error) => {
        this.logger.error(`Session error for ${streamPath}:`, error);
        cleanup();
      });
    }

    // 设置响应头
    res.writeHead(200, {
      "Content-Type": "video/x-flv",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });

    // 创建客户端对象
    const client = {
      write: (data: Buffer) => {
        try {
          // 检查连接是否仍然可写
          if (!res.writableEnded) {
            res.write(data);
          }
        } catch (error) {
          this.logger.error("Error writing to client:", error);
          session!.removeClient(client);
          cleanup();
        }
      },
    };

    // 添加客户端到会话
    session.addClient(client);
    this.logger.info(`New client connected to ${streamPath}`);

    // 处理客户端断开连接
    req.on("close", () => {
      session!.removeClient(client);
      this.logger.info(`Client disconnected from ${streamPath}`);
      
      // 检查是否需要清理会话
      if (session!.getSessionInfo().clientCount === 0) {
        this.sessions.delete(streamPath);
        this.logger.info(`Session cleaned up: ${streamPath}`);
      }
    });

    // 处理请求错误
    req.on("error", (error) => {
      this.logger.error(`Client error on ${streamPath}:`, error);
      session!.removeClient(client);
    });
  }

  private setCORSHeaders(res: ServerResponse) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }

  // 推送 FLV 数据到指定路径的会话
  pushFLVData(path: string, data: Buffer) {
    const session = this.sessions.get(path);
    if (session) {
      session.handleData(data);
    }
  }

  // 获取所有活动会话的信息
  getSessionsInfo() {
    const info: Record<string, any> = {};
    for (const [path, session] of this.sessions) {
      info[path] = session.getSessionInfo();
    }
    return info;
  }

  // 关闭服务器
  close() {
    return new Promise<void>((resolve, reject) => {
      // 清理所有会话
      this.sessions.clear();
      
      // 关闭服务器
      this.server.close((error) => {
        if (error) {
          this.logger.error("Error closing server:", error);
          reject(error);
        } else {
          this.logger.info("Server closed");
          resolve();
        }
      });
    });
  }
}
