import http2 from "http2";
import { FLVSession } from "../core/flv-session";

export class HttpServer {
  constructor() {}

  run() {
    http2
      .createServer((req, res) => {
        const parsedUrl = new URL(req.url!, `http://${req.headers.host}`);
        const pathname = parsedUrl.pathname;

        res.end("666");

        if (pathname === "/live") {
          const session = new FLVSession(req, res);
          session.run();
        }
      })
      .listen(8080, () => {
        console.log("HTTP Server running on port 8080");
      });
  }
}
