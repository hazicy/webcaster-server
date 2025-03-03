import type { FastifyReply, FastifyRequest } from "fastify";
import type { Context } from "./context";
import { Logger } from "../utils/logger";

export class FLVSession {
  #context: Context;
  #request: FastifyRequest<{
    Params: {
      app: string;
      name: string;
    };
  }>;
  #reply: FastifyReply;
  streamApp: string;
  streamName: string;

  constructor(
    context: Context,
    request: FastifyRequest<{
      Params: {
        app: string;
        name: string;
      };
    }>,
    reply: FastifyReply
  ) {
    this.#context = context;
    this.#request = request;
    this.#reply = reply;

    this.streamApp = request.params.app;
    this.streamName = request.params.name.split(".").shift() as string;
  }

  run() {
    this.#context.streamHub.subscribe(this.streamName, (chunk: Buffer) => {
      this.#reply.send(chunk);
    });

    // this.#request.raw.on("close", () => {
    //   Logger.info("FLVSession closed");
    //   this.#context.streamHub.unsubscribe(this.streamName, callback);
    // });
  }
}
