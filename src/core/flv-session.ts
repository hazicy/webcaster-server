import { Writable } from "stream";
import { FLVHeader, FLVParser, ScriptData } from "./flv-parser";
import type { FastifyReply, FastifyRequest } from "fastify";

export class FLVSession extends Writable {
  #flvParser: FLVParser;
  #flvHeader: FLVHeader | undefined;
  #metadata: ScriptData | undefined;
  #gopCache: Buffer[] = [];
  #currentGop: Buffer[] = [];
  #req: FastifyRequest;
  #res: FastifyReply;
  #streamApp: string;
  #streamName: string;
  #headerSent: boolean = false;
  #waitingForKeyFrame: boolean = true;

  constructor(
    req: FastifyRequest<{
      Params: {
        app: string;
        name: string;
      };
    }>,
    res: FastifyReply
  ) {
    super();
    this.#flvParser = new FLVParser();
    this.#req = req;
    this.#res = res;
    this.#streamApp = req.params.app;
    this.#streamName = req.params.name;
  }

  run() {
    this.#flvParser.pipe(this);
  }

  getParser() {
    return this.#flvParser;
  }

  override _write(
    chunk: Buffer,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void
  ): void {
    try {
      this.#res.send(chunk);
      callback();
    } catch (error) {
      callback(error as Error);
    }
  }
}
