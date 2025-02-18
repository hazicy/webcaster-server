import type { FastifyReply, FastifyRequest } from "fastify";
import { pipeline, Writable } from "stream";
import type { Context } from "./context";
import { FLVProcessor } from "./flv-processor";

export abstract class StreamSession extends Writable {
  protected gopCache: Buffer[] = [];
  protected currentGop: Buffer[] = [];
  protected ip: string;
  protected streamApp: string;
  protected streamName: string;
  protected waitingForKeyFrame: boolean = true;

  constructor(
    protected ctx: Context,
    protected req: FastifyRequest<{
      Params: {
        app: string;
        name: string;
      };
    }>,
    protected res: FastifyReply
  ) {
    super();
    this.ip = req.ip;
    this.streamApp = req.params.app;
    this.streamName = req.params.name;
  }
}

export class FLVHandler extends StreamSession {
  constructor(
    protected ctx: Context,
    protected req: FastifyRequest<{
      Params: {
        app: string;
        name: string;
      };
    }>,
    protected res: FastifyReply
  ) {
    super(ctx, req, res);
  }

  run() {
    const roomId = this.req.url.split("/").pop();
    if (roomId) {
      const readable = this.ctx.sessions.get(roomId);
      const processor = new FLVProcessor();

      if (readable) {
        pipeline(readable, processor, this);
      }
    }
  }

  override _write(
    chunk: Buffer,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void
  ): void {
    try {
      this.res.send(chunk);
      callback();
    } catch (error) {
      callback(error as Error);
    }
  }
}
