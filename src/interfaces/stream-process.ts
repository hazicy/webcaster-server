export interface StreamProcessor {
  process(data: Buffer | object): void;
}
