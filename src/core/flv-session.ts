import { TagType } from "../constants/tag-type";
import { FlvParser, FlvTag } from "./flv-parser";
import { EventEmitter } from "events";

interface HttpClient {
  id: string;
  res: any; // HTTP Response对象
  startTime: number;
  lastTag?: FlvTag;
}

export class FlvSession extends FlvParser {
  private readonly sessionId: string;
  private readonly clients: Map<string, HttpClient>;
  private readonly cacheSize: number;
  private readonly tagCache: FlvTag[];
  private readonly events: EventEmitter;
  private firstTag?: FlvTag;
  private lastTag?: FlvTag;

  constructor(sessionId: string, options: { cacheSize?: number } = {}) {
    super();
    this.sessionId = sessionId;
    this.clients = new Map();
    this.cacheSize = options.cacheSize || 100;
    this.tagCache = [];
    this.events = new EventEmitter();
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  protected override onTag(tag: FlvTag): void {
    // 缓存首个Tag
    if (!this.firstTag) {
      this.firstTag = tag;
    }
    this.lastTag = tag;

    // 缓存Tag
    this.tagCache.push(tag);
    if (this.tagCache.length > this.cacheSize) {
      this.tagCache.shift();
    }

    // 向所有客户端分发数据
    this.distributeTag(tag);
  }

  private distributeTag(tag: FlvTag): void {
    for (const [clientId, client] of this.clients) {
      try {
        // 检查是否是关键帧
        const isKeyFrame =
          tag.type === TagType.VIDEO && (tag.data[0] & 0xf0) === 0x10;

        // 如果客户端还没有收到过Tag,等待关键帧
        if (!client.lastTag && !isKeyFrame) {
          continue;
        }

        // 发送Tag数据
        this.sendTagToClient(client, tag);
        client.lastTag = tag;
      } catch (error) {
        console.error(`Error sending tag to client ${clientId}:`, error);
        this.removeClient(clientId);
      }
    }
  }

  private sendTagToClient(client: HttpClient, tag: FlvTag): void {
    // 构建FLV Tag数据包
    const headerSize = 11; // Tag Header大小
    const packet = new Uint8Array(headerSize + tag.dataSize + 4); // +4 for PreviousTagSize

    // 写入Tag Header
    packet[0] = tag.type;
    packet[1] = (tag.dataSize >> 16) & 0xff;
    packet[2] = (tag.dataSize >> 8) & 0xff;
    packet[3] = tag.dataSize & 0xff;
    packet[4] = (tag.timestamp >> 16) & 0xff;
    packet[5] = (tag.timestamp >> 8) & 0xff;
    packet[6] = tag.timestamp & 0xff;
    packet[7] = (tag.timestamp >> 24) & 0xff; // Timestamp Extended
    packet[8] = (tag.streamId >> 16) & 0xff;
    packet[9] = (tag.streamId >> 8) & 0xff;
    packet[10] = tag.streamId & 0xff;

    // 写入Tag Data
    packet.set(tag.data, headerSize);

    // 写入PreviousTagSize
    const previousTagSize = headerSize + tag.dataSize;
    packet[headerSize + tag.dataSize] = (previousTagSize >> 24) & 0xff;
    packet[headerSize + tag.dataSize + 1] = (previousTagSize >> 16) & 0xff;
    packet[headerSize + tag.dataSize + 2] = (previousTagSize >> 8) & 0xff;
    packet[headerSize + tag.dataSize + 3] = previousTagSize & 0xff;

    // 发送数据
    client.res.write(packet);
  }

  public addClient(clientId: string, res: any): void {
    // 设置HTTP响应头
    res.writeHead(200, {
      "Content-Type": "video/x-flv",
      Connection: "close",
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "*",
    });

    // 写入FLV文件头
    const header = new Uint8Array([
      0x46,
      0x4c,
      0x56, // 'FLV'
      0x01, // Version
      0x05, // 音视频流
      0x00,
      0x00,
      0x00,
      0x09, // Header Size
    ]);
    res.write(header);

    // 添加客户端
    this.clients.set(clientId, {
      id: clientId,
      res,
      startTime: Date.now(),
    });

    // 如果有缓存的Tag,从最近的关键帧开始发送
    let keyFrameIndex = -1;
    for (let i = this.tagCache.length - 1; i >= 0; i--) {
      const tag = this.tagCache[i];
      if (tag.type === TagType.VIDEO && (tag.data[0] & 0xf0) === 0x10) {
        keyFrameIndex = i;
        break;
      }
    }

    if (keyFrameIndex >= 0) {
      for (let i = keyFrameIndex; i < this.tagCache.length; i++) {
        this.sendTagToClient(this.clients.get(clientId)!, this.tagCache[i]);
      }
    }

    // 监听客户端断开连接
    res.on("close", () => {
      this.removeClient(clientId);
    });
  }

  public removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      try {
        client.res.end();
      } catch (error) {
        console.error(`Error ending response for client ${clientId}:`, error);
      }
      this.clients.delete(clientId);
      this.events.emit("clientDisconnected", clientId);
    }
  }

  public getClientCount(): number {
    return this.clients.size;
  }

  public on(event: string, listener: (...args: any[]) => void): void {
    this.events.on(event, listener);
  }

  public destroy(): void {
    // 断开所有客户端连接
    for (const [clientId] of this.clients) {
      this.removeClient(clientId);
    }
    this.events.removeAllListeners();
  }
}
