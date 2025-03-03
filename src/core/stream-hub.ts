import { EventEmitter } from "events";

export class StreamHub extends EventEmitter {
  constructor() {
    super();
  }

  subscribe(room: string, listener: (chunk: Buffer) => void) {
    this.on(room, listener);
  }

  unsubscribe(room: string, listener: (chunk: Buffer) => void) {
    this.off(room, listener);
  }
}
