import { WebSocketProvider } from "./providers/websocket-provider";
import { HttpServer } from "./servers/http-server";
import { Context } from "./core/context";
import { Logger } from "./utils/logger";

(async function start() {
  try {
    // 创建全局上下文
    const ctx = new Context();

    const wsProvider = new WebSocketProvider(ctx);

    // 创建HTTP分发
    const httpEgress = new HttpServer(ctx);

    // 启动WebSocket服务器
    await wsProvider.start(9001);
    Logger.info("WebSocket server started on port 9001");

    // 启动HTTP分发服务器
    httpEgress.run();
    Logger.info("HTTP server started on port 3000");

    // 优雅退出处理
    process.on("SIGINT", async () => {
      Logger.info("Shutting down...");
      await wsProvider.stop();
      process.exit(0);
    });
  } catch (error) {
    Logger.error("Failed to start server:", error);
    process.exit(1);
  }
})();
