import { Transform, type TransformCallback } from "stream";
import type { TagType } from "../constants/tag-type";
import { ScriptDecoder } from "./script-decoder";
import type {
  AudioData,
  MediaPacket,
  VideoData,
  ScriptData,
} from "../interfaces/packet-type";
import { Logger } from "../utils/logger";
import type { MediaProcessor } from "../interfaces/media-processor";

export interface FLVHeader {
  version: number;
  hasVideo: boolean;
  hasAudio: boolean;
  headerSize: number;
}

export interface FLVTag {
  type: TagType;
  dataSize: number;
  timestamp: number;
  streamId: number; // 通常是0
  data: Uint8Array;
}

export class FLVProcessor extends Transform implements MediaProcessor {
  #buffer: Buffer = Buffer.alloc(0);
  #headerParsed: boolean = false;

  constructor() {
    super();
  }

  process(data: Buffer | object): void {
    console.log(data);
  }

  parseHeader(chunk: Buffer): boolean {
    if (chunk.length < 9) return false;

    const signature = chunk.toString("utf-8", 0, 3);
    if (signature !== "FLV") {
      throw new Error("Invalid FLV signature");
    }

    const header: FLVHeader = {
      version: chunk[3],
      hasVideo: (chunk[4] & 0x01) !== 0,
      hasAudio: (chunk[4] & 0x04) !== 0,
      headerSize: chunk.readUint32BE(5),
    };

    if (header.headerSize !== 9) {
      throw new Error("Invalid FLV header size");
    }

    this.push(chunk);
    return true;
  }

  parseTag(chunk: Buffer) {
    if (chunk.length < 11) return false;

    const tagType = chunk[0];
    const dataSize = chunk.readUintBE(1, 3);
    const timestamp = chunk.readUintBE(4, 3) | (chunk[7] << 24);

    if (chunk.length < 11 + dataSize) return false;

    const data = chunk.subarray(11, 11 + dataSize);

    switch (tagType) {
      case 0x08:
        this.parseAudioData(data, timestamp, dataSize);
        break;
      case 0x09:
        this.parseVideoData(data, timestamp, dataSize);
        break;
      case 0x12:
        this.parseScriptData(data);
        break;
      default:
        break;
    }

    return 11 + dataSize;
  }

  parseAudioData(data: Buffer, timestamp: number, size: number) {
    const soundFormat = data[0] & (0xf0 >> 4);
    const soundRate = (data[0] & 0x0c) >> 2;
    const soundSize = (data[0] & 0x02) >> 1;
    const soundType = data[0] & 0x01;

    const audioData: AudioData = {
      format: soundFormat,
      sampleRate: [5500, 11025, 22050, 44100][soundRate],
      sampleSize: soundSize ? 16 : 8,
      channels: soundType ? 2 : 1,
      data: data.subarray(1),
    };

    const packet: MediaPacket<"audio"> = {
      type: "audio",
      data: audioData,
      dts: timestamp,
      pts: timestamp,
      size,
    };

    this.push(packet);
  }

  parseVideoData(data: Buffer, timestamp: number, size: number) {
    const frameType = (data[0] & 0xf0) >> 4;
    const codecId = data[0] & 0x0f;

    const videoData: VideoData = {
      frameType,
      codecId,
      data: data.subarray(1),
    };

    const packet: MediaPacket<"video"> = {
      type: "video",
      data: videoData,
      dts: timestamp,
      pts: timestamp,
      size,
    };

    this.push(packet);
  }

  parseScriptData(data: Buffer) {
    try {
      const decoder = new ScriptDecoder(data);
      const { name, data: metadata } = decoder.decode();
      const scriptData: ScriptData = {
        name,
        metadata,
      };
      this.push(scriptData);
    } catch (error) {
      Logger.error(error instanceof Error ? error.message : "Unknown error");
    }
  }

  override _transform(
    chunk: Buffer,
    encoding: BufferEncoding,
    callback: TransformCallback
  ): void {
    this.#buffer = Buffer.concat([this.#buffer, chunk]);

    try {
      if (!this.#headerParsed) {
        this.parseHeader(this.#buffer);
        this.#headerParsed = true;
        this.#buffer = this.#buffer.subarray(9);
      }

      while (this.#buffer.length > 0) {
        const tagSize = this.parseTag(this.#buffer);

        if (!tagSize) break;

        this.#buffer = this.#buffer.subarray(tagSize + 4);
      }

      callback();
    } catch (error) {
      callback(error instanceof Error ? error : new Error(String(error)));
      Logger.error(error instanceof Error ? error.message : "Unknown error");
    }
  }

  override _flush(callback: TransformCallback): void {
    callback();
  }
}
