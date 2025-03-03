import type { Readable } from "stream";
import { StreamHub } from "./stream-hub";

type StreamName = string;
type StreamSource = Readable;

export class Context {
  sources: Map<StreamName, StreamSource>;
  streamHub: StreamHub;

  constructor() {
    this.sources = new Map();
    this.streamHub = new StreamHub();
  }
}
