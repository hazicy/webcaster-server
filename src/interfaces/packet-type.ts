export interface ScriptData {
  name: string;
  metadata: Record<string, unknown>;
}

export interface AudioData {
  format: number;
  sampleRate: number;
  sampleSize: number;
  channels: number;
  data: Buffer;
}

export interface VideoData {
  frameType: number;
  codecId: number;
  data: Buffer;
}

export interface MediaPacket<T extends "audio" | "video"> {
  type: T;
  pts: number;
  dts: number;
  size: number;
  data: T extends "audio" ? AudioData : VideoData;
}
