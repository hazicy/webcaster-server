import "reflect-metadata";
import { createServer } from "http";
import { Injector } from "./core/injector";
import { FlvSession } from "./core/flv-session";
import { WebSocketProvider } from "./providers/websocket";
import { WebTransportProvider } from "./providers/webtransport";
import { randomUUID } from "crypto";

// 创建依赖注入容器
const injector = Injector.getInstance();

// 创建并注册FLV会话
const flvSession = new FlvSession(randomUUID());
injector.register("FlvSession", flvSession);

// 创建并注册提供者
const wsProvider = new WebSocketProvider(flvSession);
const wtProvider = new WebTransportProvider(flvSession);

injector.register("WebSocketProvider", wsProvider);
injector.register("WebTransportProvider", wtProvider);

// 创建HTTP服务器处理HTTP分发
const httpServer = createServer((req, res) => {
  if (req.url === "/flv" && req.method === "GET") {
    const clientId = randomUUID();
    console.log(`New HTTP client connected: ${clientId}`);
    flvSession.addClient(clientId, res);
  } else {
    res.writeHead(404);
    res.end();
  }
});

// 启动所有服务器
async function startServers() {
  try {
    // 启动HTTP服务器
    await new Promise<void>((resolve) => {
      httpServer.listen(8080, () => {
        console.log("HTTP server started on port 8080");
        resolve();
      });
    });

    // 启动WebSocket服务器
    await wsProvider.startServer(8081);
    console.log("WebSocket server started on port 8081");

    // 启动WebTransport服务器
    await wtProvider.startServer(4433);
    console.log("WebTransport server started on port 4433");

    console.log("All servers started successfully");
  } catch (error) {
    console.error("Failed to start servers:", error);
    process.exit(1);
  }
}

// 处理进程退出
process.on("SIGINT", () => {
  console.log("Shutting down servers...");
  httpServer.close();
  wsProvider.shutdown();
  wtProvider.shutdown();
  process.exit(0);
});

// 启动服务器
startServers();
