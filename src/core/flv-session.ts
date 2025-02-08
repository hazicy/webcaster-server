import { FLVHeader, FLVParser, ScriptData, FLVTag } from "./flv-parser";
import { EventEmitter } from "events";

interface StreamClient {
  write(data: Buffer): void;
}

export class FLVSession extends EventEmitter {
  #clients: Set<StreamClient>;
  #flvParser: FLVParser;
  #flvHeader: FLVHeader | undefined;
  #metadata: ScriptData | undefined;
  #headerSent: boolean = false;
  #gopCache: Buffer[] = [];
  #currentGop: Buffer[] = [];
  #waitingForKeyFrame: boolean = true;

  constructor() {
    super();
    this.#clients = new Set<StreamClient>();
    this.#flvParser = new FLVParser();
    this.#setupEvents();
  }

  #setupEvents() {
    // 处理 FLV 头部
    this.#flvParser.on("header", (header: FLVHeader) => {
      if (!this.#flvHeader) {
        this.#flvHeader = header;
        // 创建 FLV 头部缓冲区
        const headerBuf = Buffer.alloc(13);
        headerBuf.write("FLV", 0, "utf-8"); // 签名
        headerBuf.writeUInt8(header.version, 3); // 版本
        headerBuf.writeUInt8(
          (header.hasAudio ? 0x04 : 0) | (header.hasVideo ? 0x01 : 0),
          4
        ); // 标志
        headerBuf.writeUInt32BE(9, 5); // 头部大小
        headerBuf.writeUInt32BE(0, 9); // PreviousTagSize0
        this.#broadcast(headerBuf);
        this.#headerSent = true;
      }
    });

    // 处理脚本数据
    this.#flvParser.on("script", (scriptData: ScriptData) => {
      if (scriptData.name === "onMetaData") {
        this.#metadata = scriptData;
      }
      this.emit("script", scriptData);
    });

    // 处理音频数据
    this.#flvParser.on("audio", (audioData) => {
      this.emit("audio", audioData);
    });

    // 处理视频数据
    this.#flvParser.on("video", (videoData) => {
      const frameType = (videoData.data[0] & 0xf0) >> 4;
      const isKeyFrame = frameType === 1;

      if (isKeyFrame) {
        // 当遇到关键帧时,将当前 GOP 缓存替换为新的 GOP
        if (this.#currentGop.length > 0) {
          this.#gopCache = this.#currentGop;
          this.#currentGop = [];
        }
        this.#waitingForKeyFrame = false;
      }

      // 构建完整的 FLV Tag
      const tagData = Buffer.alloc(11 + videoData.data.length + 4);
      tagData.writeUInt8(0x09, 0); // 视频标签类型
      tagData.writeUIntBE(videoData.data.length, 1, 3); // 数据大小
      tagData.writeUIntBE(0, 4, 3); // 时间戳
      tagData.writeUInt8(0, 7); // 时间戳扩展
      tagData.writeUIntBE(0, 8, 3); // StreamID
      videoData.data.copy(tagData, 11); // 视频数据
      tagData.writeUInt32BE(11 + videoData.data.length, tagData.length - 4); // Previous Tag Size

      if (!this.#waitingForKeyFrame) {
        this.#currentGop.push(tagData);
      }

      this.emit("video", videoData);
    });

    // 处理错误
    this.#flvParser.on("error", (error) => {
      this.emit("error", error);
    });
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
        if (tagType === 0x09) { // 视频标签
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

  // 清除 GOP 缓存
  clearGopCache() {
    this.#gopCache = [];
    this.#currentGop = [];
    this.#waitingForKeyFrame = true;
  }

  // 设置最大 GOP 缓存大小
  setMaxGopCacheSize(maxFrames: number) {
    if (this.#gopCache.length > maxFrames) {
      this.#gopCache = this.#gopCache.slice(-maxFrames);
    }
    if (this.#currentGop.length > maxFrames) {
      this.#currentGop = this.#currentGop.slice(-maxFrames);
    }
  }
}
