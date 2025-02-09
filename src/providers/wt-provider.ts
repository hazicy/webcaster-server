import "reflect-metadata";
import { Injectable } from "../core/injector";
import { FLVSession } from "../core/flv-session";
import { readFileSync } from "fs";
import { Http3Server } from "@fails-components/webtransport";
import { createServer } from "http";

@Injectable()
export class WebTransportProvider {
  private server: ReturnType<typeof createServer> | null = null;
  private wtServer: Http3Server | null = null;

  constructor(private flvSession: FLVSession) {}

  private async setupWebTransportServer(port: number) {
    if (!this.server) return;

    this.wtServer = new Http3Server({
      port,
      host: "0.0.0.0",
      secret: "mySecret",
      cert: readFileSync("certs/cert.pem").toString("utf-8"),
      privKey: readFileSync("certs/key.pem").toString("utf-8"),
    });

    const stream = this.wtServer.sessionStream("/wt");
    const sessionReader = stream.getReader();

    while (true) {
      const { done, value } = await sessionReader.read();
      if (done) {
        break;
      }
    }
  }

  private async handleStream(
    readable: ReadableStream<Uint8Array>
  ): Promise<void> {
    const reader = readable.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        if (value) {
          this.flvSession.pushData(value);
        }
      }
    } catch (error: unknown) {
      console.error("Error reading from WebTransport stream:", error);
    } finally {
      reader.releaseLock();
    }
  }

  public async startServer(port: number = 4433): Promise<void> {
    this.setupWebTransportServer(port);
    this.wtServer?.startServer();

    return new Promise((resolve, reject) => {
      if (!this.server || !this.wtServer) {
        reject(new Error("Server not initialized"));
        return;
      }

      try {
        this.server.listen(port, () => {
          console.log(`WebTransport server started on port ${port}`);
          resolve();
        });
      } catch (error: unknown) {
        console.error("Failed to start WebTransport server:", error);
        reject(error);
      }
    });
  }

  public shutdown(): void {}
}
