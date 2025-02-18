import { readFile } from "fs";
import { describe, it } from "vitest";

describe("livestream test", () => {
  it("should process FLV data correctly", () => {
    const ws = new WebSocket("ws://localhost:9001/live");
    readFile("./test.flv", "binary", (err, data) => {
      if (err) {
        console.error("读取文件时发生错误");
        return;
      }

      console.log(data);

      ws.send(data);
    });
  });
});
