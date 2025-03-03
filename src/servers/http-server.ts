import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import type { Context } from "../core/context";
import { FLVSession } from "../core/flv-session";

export class HttpServer {
  constructor(private ctx: Context) {}

  run() {
    const fastify = Fastify({
      logger: true,
    });

    fastify.get<{ Params: { app: string; name: string } }>(
      "/:app/:name.flv",
      this.#handleFLV.bind(this)
    );

    fastify.listen(
      {
        port: 3000,
      },
      (err, address) => {
        if (err) throw err;
        console.log(`Server is now listening on ${address}`);
      }
    );
  }

  #handleFLV(
    request: FastifyRequest<{ Params: { app: string; name: string } }>,
    reply: FastifyReply
  ) {
    reply.header("access-control-allow-origin", "*");
    reply.header("content-type", "video/x-flv");
    reply.header("cache-control", "no-cache");
    reply.header("connection", "keep-alive");

    const session = new FLVSession(this.ctx, request, reply);
    session.run();
  }
}
