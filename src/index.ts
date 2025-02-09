import { FLVParser } from "./core/flv-parser";
import { WebSocketIngress } from "./ingress/websocket-ingress";
import { HttpEgress } from "./egress/http-egress";

const server = new HttpEgress();
const ws = new WebSocketIngress();

ws.pipe(parser);
server.run();
