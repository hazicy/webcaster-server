import type { Readable } from "stream";

type streamName = string;
type rawStream = Readable;

export class Context {
  sessions: Map<streamName, rawStream>;

  constructor() {
    this.sessions = new Map();
  }
}
