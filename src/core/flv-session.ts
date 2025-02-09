import { Writable } from "stream";
import { FLVHeader, FLVParser, ScriptData, FLVTag } from "./flv-parser";
import type { Http2ServerRequest, Http2ServerResponse } from "http2";

interface StreamClient {
  write(data: Buffer): void;
}

export class FLVSession extends Writable {
  #flvParser: FLVParser;
  #clients: Set<StreamClient>;
  #flvHeader: FLVHeader | undefined;
  #metadata: ScriptData | undefined;
  #gopCache: Buffer[] = [];
  #currentGop: Buffer[] = [];
  #req: Http2ServerRequest;
  #res: Http2ServerResponse;
  #headerSent: boolean = false;
  #waitingForKeyFrame: boolean = true;

  constructor(req: Http2ServerRequest, res: Http2ServerResponse) {
    super();
    this.#flvParser = new FLVParser();
    this.#clients = new Set<StreamClient>();
    this.#req = req;
    this.#res = res;
  }

  run() {
    this.#flvParser.pipe(this);
  }

  addClient(client: StreamClient) {
    this.#clients.add(client);

    // 如果有新客户端连接且已经有元数据,发送头部和元数据
    if (this.#flvHeader && this.#metadata) {
      try {
        // 重新发送 FLV 头部
        const headerBuf = Buffer.alloc(13);
        headerBuf.write("FLV", 0, "utf-8");
        headerBuf.writeUInt8(this.#flvHeader.version, 3);
        headerBuf.writeUInt8(
          (this.#flvHeader.hasAudio ? 0x04 : 0) |
            (this.#flvHeader.hasVideo ? 0x01 : 0),
          4
        );
        headerBuf.writeUInt32BE(9, 5);
        headerBuf.writeUInt32BE(0, 9);
        client.write(headerBuf);

        // 重新发送元数据
        // TODO: 将元数据重新编码为 FLV Tag

        // 发送 GOP 缓存
        if (this.#gopCache.length > 0) {
          for (const frame of this.#gopCache) {
            client.write(frame);
          }
        }
      } catch (error) {
        this.emit("error", error);
      }
    }
  }

  removeClient(client: StreamClient) {
    this.#clients.delete(client);
  }

  handleData(data: Buffer) {
    try {
      // 如果还没解析过头部,先尝试解析
      if (!this.#headerSent) {
        this.#flvParser.parseHeader(data);
      }

      // 解析 FLV Tag
      const tagSize = this.#flvParser.parseTag(data);
      if (tagSize) {
        // 如果解析成功,广播数据给所有客户端
        this.#broadcast(data);

        // 检查是否需要更新 GOP 缓存
        const tagType = data[0];
        if (tagType === 0x09) {
          // 视频标签
          const frameType = (data[11] & 0xf0) >> 4; // 第一个字节的高4位表示帧类型
          const isKeyFrame = frameType === 1;

          if (isKeyFrame) {
            // 当遇到关键帧时,将当前 GOP 缓存替换为新的 GOP
            if (this.#currentGop.length > 0) {
              this.#gopCache = this.#currentGop;
              this.#currentGop = [];
            }
            this.#waitingForKeyFrame = false;
          }

          if (!this.#waitingForKeyFrame) {
            this.#currentGop.push(Buffer.from(data));
          }
        }
      }
    } catch (error) {
      this.emit("error", error);
    }
  }

  #broadcast(data: Buffer) {
    for (const client of this.#clients) {
      try {
        client.write(data);
      } catch (error) {
        this.emit("error", error);
        // 如果写入失败,移除该客户端
        this.removeClient(client);
      }
    }
  }

  // 获取当前会话信息
  getSessionInfo() {
    return {
      clientCount: this.#clients.size,
      hasHeader: !!this.#flvHeader,
      hasMetadata: !!this.#metadata,
      header: this.#flvHeader,
      metadata: this.#metadata,
      gopCacheSize: this.#gopCache.length,
      currentGopSize: this.#currentGop.length,
    };
  }

  override _write(
    chunk: any,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void
  ): void {
    try {
      this.#res.write(chunk);
      callback();
    } catch (error) {
      callback(error as Error);
    }
  }

  _destroy(
    error: Error | null,
    callback: (error?: Error | null) => void
  ): void {}
}
