export enum TagType {
  AUDIO = 8,
  VIDEO = 9,
  SCRIPT = 18,
}

export interface FlvHeader {
  signature: string; // 'FLV'
  version: number; // 通常是1
  flags: number; // 5表示同时包含音频和视频
  headerSize: number; // 通常是9
}

export interface FlvTag {
  type: TagType;
  dataSize: number;
  timestamp: number;
  streamId: number; // 通常是0
  data: Uint8Array;
}

export class FlvParser {
  private buffer: Uint8Array;
  private position: number;

  constructor() {
    this.buffer = new Uint8Array(0);
    this.position = 0;
  }

  public pushData(data: Uint8Array): void {
    const newBuffer = new Uint8Array(this.buffer.length + data.length);
    newBuffer.set(this.buffer);
    newBuffer.set(data, this.buffer.length);
    this.buffer = newBuffer;
    this.parse();
  }

  private parse(): void {
    // 确保至少有9字节用于解析文件头
    if (this.buffer.length < 9 && this.position === 0) {
      return;
    }

    // 第一次解析文件头
    if (this.position === 0) {
      const header = this.parseHeader();
      if (!header) return;
      this.position = header.headerSize;
    }

    // 解析连续的Tag
    while (this.position < this.buffer.length) {
      // Tag header = 11 bytes
      // 确保有足够的数据解析Tag头部
      if (this.buffer.length - this.position < 11) {
        break;
      }

      const dataSize =
        (this.buffer[this.position + 1] << 16) |
        (this.buffer[this.position + 2] << 8) |
        this.buffer[this.position + 3];

      // 确保有足够的数据解析整个Tag
      if (this.buffer.length - this.position < 11 + dataSize + 4) {
        break;
      }

      const tag = this.parseTag();
      if (!tag) break;

      // 发出解析后的Tag
      this.onTag(tag);

      // 跳过PreviousTagSize(4字节)
      this.position += 4;
    }

    // 移除已处理的数据
    if (this.position > 0) {
      this.buffer = this.buffer.slice(this.position);
      this.position = 0;
    }
  }

  private parseHeader(): FlvHeader | null {
    if (this.buffer.length < 9) return null;

    const signature = String.fromCharCode(
      this.buffer[0],
      this.buffer[1],
      this.buffer[2]
    );
    if (signature !== "FLV") {
      throw new Error("Invalid FLV signature");
    }

    return {
      signature,
      version: this.buffer[3],
      flags: this.buffer[4],
      headerSize:
        (this.buffer[5] << 24) |
        (this.buffer[6] << 16) |
        (this.buffer[7] << 8) |
        this.buffer[8],
    };
  }

  private parseTag(): FlvTag | null {
    if (this.buffer.length - this.position < 11) return null;

    const type = this.buffer[this.position] as TagType;
    const dataSize =
      (this.buffer[this.position + 1] << 16) |
      (this.buffer[this.position + 2] << 8) |
      this.buffer[this.position + 3];

    const timestamp =
      (this.buffer[this.position + 7] << 24) |
      (this.buffer[this.position + 4] << 16) |
      (this.buffer[this.position + 5] << 8) |
      this.buffer[this.position + 6];

    const streamId =
      (this.buffer[this.position + 8] << 16) |
      (this.buffer[this.position + 9] << 8) |
      this.buffer[this.position + 10];

    const data = this.buffer.slice(
      this.position + 11,
      this.position + 11 + dataSize
    );

    this.position += 11 + dataSize;

    return {
      type,
      dataSize,
      timestamp,
      streamId,
      data,
    };
  }

  protected onTag(tag: FlvTag): void {
    // 由子类实现具体的Tag处理逻辑
  }
}
