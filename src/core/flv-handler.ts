import { pipeline, Writable } from "stream";
import type { Context } from "./context";
import { FLVProcessor } from "./flv-processor";
import { Logger } from "../utils/logger";

export class FLVHandler extends Writable {
  protected gopCache: Buffer[] = [];
  protected currentGop: Buffer[] = [];
  protected waitingForKeyFrame: boolean = true;
  constructor(protected ctx: Context, private streamName: string) {
    super();
  }

  run() {
    if (this.streamName) {
      const readable = this.ctx.sources.get(this.streamName);

      if (readable) {
        const processor = new FLVProcessor();

        pipeline(readable, processor, this, (err) => {
          if (err) {
            Logger.error(`Pipeline failed: ${err.message}`);
          }
        });
      } else {
        Logger.error(
          `No readable stream found for room ID: ${this.streamName}`
        );
      }
    }
  }

  override _write(
    chunk: Buffer,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void
  ): void {
    try {
      this.ctx.streamHub.emit(this.streamName, chunk);
      callback();
    } catch (error) {
      callback(error as Error);
    }
  }
}
