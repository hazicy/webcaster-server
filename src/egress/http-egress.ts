import Fastify from "fastify";
import { FLVSession } from "../core/flv-session";

export class HttpEgress {
  constructor() {}

  run() {
    const fastify = Fastify({
      logger: true,
    });

    fastify.get<{ Params: { app: string; name: string } }>(
      "/:app/:name.flv",
      (request, reply) => {
        const session = new FLVSession(request, reply);
        session.run();
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
