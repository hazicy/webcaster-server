// 简单的依赖注入装饰器实现
export function Injectable(): ClassDecorator {
  return function (target: any) {
    // 标记类为可注入
    Reflect.defineMetadata("injectable", true, target);
  };
}

// 依赖注入容器
export class Injector {
  private static instance: Injector;
  private container: Map<string, any>;

  private constructor() {
    this.container = new Map();
  }

  public static getInstance(): Injector {
    if (!Injector.instance) {
      Injector.instance = new Injector();
    }
    return Injector.instance;
  }

  public register<T>(token: string, instance: T): void {
    this.container.set(token, instance);
  }

  public get<T>(token: string): T {
    const instance = this.container.get(token);
    if (!instance) {
      throw new Error(`No provider found for ${token}`);
    }
    return instance;
  }
}
