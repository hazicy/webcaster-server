export interface ClientProvider {
  setupServer(): void;
  start(): Promise<void>;
  stop(): Promise<void>;
}
