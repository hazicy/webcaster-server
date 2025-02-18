import Fastify from "fastify";
import type { Context } from "../core/context";
import { FLVHandler } from "../core/flv-handler";

export class HttpServer {
  constructor(private ctx: Context) {}

  run() {
    const fastify = Fastify({
      logger: true,
    });

    fastify.get<{ Params: { app: string; name: string } }>(
      "/:app/:name.flv",
      (request, reply) => {
        const handler = new FLVHandler(this.ctx, request, reply);
        handler.run();
      }
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
}
