export class ScriptDecoder {
  private position = 0;

  constructor(private buffer: Buffer) {}

  readString(): string {
    const length = this.buffer.readUInt16BE(this.position);
    this.position += 2;
    const str = this.buffer.toString(
      "utf8",
      this.position,
      this.position + length
    );
    this.position += length;
    return str;
  }

  readNumber(): number {
    const num = this.buffer.readDoubleBE(this.position);
    this.position += 8;
    return num;
  }

  readBoolean(): boolean {
    const bool = this.buffer[this.position] !== 0;
    this.position += 1;
    return bool;
  }

  readObject(): Record<string, any> {
    const obj: Record<string, any> = {};

    while (true) {
      // 读取属性名长度
      const propertyNameLength = this.buffer.readUInt16BE(this.position);
      this.position += 2;

      // 如果长度为0,表示对象结束
      if (propertyNameLength === 0) {
        this.position += 1; // 跳过结束标记
        break;
      }

      // 读取属性名
      const propertyName = this.buffer.toString(
        "utf8",
        this.position,
        this.position + propertyNameLength
      );
      this.position += propertyNameLength;

      // 读取值类型
      const valueType = this.buffer[this.position];
      this.position += 1;

      // 根据类型读取值
      switch (valueType) {
        case 0: // Number
          obj[propertyName] = this.readNumber();
          break;
        case 1: // Boolean
          obj[propertyName] = this.readBoolean();
          break;
        case 2: // String
          obj[propertyName] = this.readString();
          break;
        case 3: // Object
          obj[propertyName] = this.readObject();
          break;
        case 8: // ECMA array
          this.position += 4; // 跳过数组长度
          obj[propertyName] = this.readObject();
          break;
        case 9: // End marker
          this.position += 1;
          break;
        case 10: // Array
          const arrayLength = this.buffer.readUInt32BE(this.position);
          this.position += 4;
          const array = [];
          for (let i = 0; i < arrayLength; i++) {
            const type = this.buffer[this.position];
            this.position += 1;
            switch (type) {
              case 0:
                array.push(this.readNumber());
                break;
              case 1:
                array.push(this.readBoolean());
                break;
              case 2:
                array.push(this.readString());
                break;
              default:
                throw new Error(`Unsupported array value type: ${type}`);
            }
          }
          obj[propertyName] = array;
          break;
        case 11: // Date
          const timestamp = this.readNumber();
          const offset = this.buffer.readInt16BE(this.position);
          this.position += 2;
          obj[propertyName] = new Date(timestamp + offset * 60 * 1000);
          break;
        default:
          throw new Error(`Unsupported value type: ${valueType}`);
      }
    }

    return obj;
  }

  decode(): { name: string; data: Record<string, any> } {
    const type = this.buffer[this.position];
    this.position += 1;

    if (type !== 2) {
      // String type
      throw new Error("Expected string type for script name");
    }

    const name = this.readString();

    const dataType = this.buffer[this.position];
    this.position += 1;

    let data: Record<string, any> = {};

    if (dataType === 8) {
      // ECMA array type
      this.position += 4; // 跳过数组长度
      data = this.readObject();
    } else {
      throw new Error(`Unexpected data type: ${dataType}`);
    }

    return { name, data };
  }
}
