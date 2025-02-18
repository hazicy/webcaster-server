export interface MediaProcessor {
  process(data: Buffer | object): void;
}
