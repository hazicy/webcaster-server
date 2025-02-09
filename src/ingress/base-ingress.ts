export abstract class BaseIngress {
  protected port: number;
  protected isRunning: boolean = false;
  protected connections: Set<any> = new Set();

  constructor(port: number) {
    this.port = port;
  }

  // 启动服务器
  abstract start(): Promise<void>;

  // 停止服务器
  abstract stop(): Promise<void>;

  // 处理新的连接
  protected abstract handleConnection(connection: any): void;

  // 处理连接关闭
  protected abstract handleDisconnection(connection: any): void;

  // 处理接收到的媒体数据
  protected abstract handleMediaData(connection: any, data: Buffer): void;

  // 获取当前连接数
  public getConnectionCount(): number {
    return this.connections.size;
  }

  // 检查服务器是否运行中
  public isServerRunning(): boolean {
    return this.isRunning;
  }

  // 获取服务器端口
  public getPort(): number {
    return this.port;
  }

  // 设置新的端口（仅在服务器未运行时可设置）
  protected setPort(newPort: number): boolean {
    if (this.isRunning) {
      return false;
    }
    this.port = newPort;
    return true;
  }

  // 广播数据给所有连接
  protected broadcast(data: Buffer, excludeConnection?: any): void {
    for (const connection of this.connections) {
      if (connection !== excludeConnection) {
        this.sendToConnection(connection, data);
      }
    }
  }

  // 发送数据到特定连接
  protected abstract sendToConnection(connection: any, data: Buffer): void;

  // 基础的错误处理方法
  protected handleError(error: Error, connection?: any): void {
    console.error(`Ingress Error: ${error.message}`, {
      port: this.port,
      connectionId: connection?.id,
      timestamp: new Date().toISOString(),
    });
  }
}
