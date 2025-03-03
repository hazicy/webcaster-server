import { Transform, type TransformCallback } from "stream";
import type { TagType } from "../constants/tag-type";
import { ScriptDecoder } from "./script-decoder";
import type {
  AudioData,
  StreamPacket,
  VideoData,
  ScriptData,
} from "../interfaces/packet-type";
import { Logger } from "../utils/logger";
import type { StreamProcessor } from "../interfaces/stream-process";

const FLV_SIGNATURE = "FLV";
const FLV_HEADER_SIZE = 9;
const TAG_HEADER_SIZE = 11;
const PREVIOUS_TAG_SIZE = 4;

interface ParserResult {
  parsed: boolean;
  consumed: number;
}

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

export class FLVProcessor extends Transform implements StreamProcessor {
  #buffer: Buffer = Buffer.alloc(0);
  #headerParsed: boolean = false;

  constructor() {
    super();
  }

  process(data: Buffer | object): void {
    console.log(data);
  }

  parseHeader(chunk: Buffer): ParserResult {
    if (chunk.length < FLV_HEADER_SIZE)
      return {
        parsed: false,
        consumed: 0,
      };

    const signature = chunk.toString("utf-8", 0, 3);
    if (signature !== FLV_SIGNATURE) {
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
    return {
      parsed: true,
      consumed: 9,
    };
  }

  parseTag(chunk: Buffer): ParserResult {
    if (chunk.length < TAG_HEADER_SIZE)
      return {
        parsed: false,
        consumed: 0,
      };

    const tagType = chunk[0];
    const dataSize = chunk.readUintBE(1, 3);
    const timestamp = chunk.readUintBE(4, 3) | (chunk[7] << 24);
    const totalSize = TAG_HEADER_SIZE + dataSize + PREVIOUS_TAG_SIZE;

    if (totalSize)
      return {
        parsed: false,
        consumed: 0,
      };

    const data = chunk.subarray(TAG_HEADER_SIZE, TAG_HEADER_SIZE + dataSize);
    this.ensureCapacity(totalSize);

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

    return {
      parsed: true,
      consumed: totalSize,
    };
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

    const packet: StreamPacket<"audio"> = {
      type: "audio",
      data: audioData,
      dts: timestamp,
      pts: timestamp,
      size,
    };

    this.push(packet);
  }

  parseVideoData(data: Buffer, timestamp: number, size: number): void {
    const frameType = (data[0] & 0xf0) >> 4;
    const codecId = data[0] & 0x0f;

    const videoData: VideoData = {
      frameType,
      codecId,
      data: data.subarray(1),
    };

    const packet: StreamPacket<"video"> = {
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

  ensureCapacity(capacity: number) {
    if (this.#buffer.length < capacity) {
      this.#buffer = Buffer.concat([
        this.#buffer,
        Buffer.allocUnsafe(capacity - this.#buffer.length),
      ]);
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
        const parsedInfo = this.parseTag(this.#buffer);

        if (parsedInfo.parsed) {
          this.#buffer = this.#buffer.subarray(parsedInfo.consumed);
        }
      }

      callback();
    } catch (error) {
      callback(error instanceof Error ? error : new Error(String(error)));
      Logger.error(error instanceof Error ? error.message : "Unknown error");
    }
  }
}
