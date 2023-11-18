import chalk from "chalk";
import { encodeClassToJSON } from "@src/util";

enum DomainStatus {
  INACTIVE = 0,
  ACTIVE = 1,
}

class Domain {
  public readonly file_name: string;

  constructor(
    public readonly source: string,
    public readonly destination: string,
    public readonly status: DomainStatus = DomainStatus.ACTIVE
  ) {
    const destWithFixedPorts = destination.replace(":", "$");

    this.file_name = `${source}-${destWithFixedPorts}.conf`;
  }

  static fromString(str: string): Domain {
    const json = JSON.parse(str);

    return this.fromObject(json);
  }

  static fromObject(obj: { [key: string]: any }): Domain {
    return new Domain(obj.source, obj.destination, obj.status);
  }

  prettyString(): string {
    const str = `${chalk.green(this.source)} => ${chalk.blue(this.destination)}`;

    if (this.status == DomainStatus.INACTIVE) return chalk.dim(str);
    return str;
  }

  toString(): string {
    return encodeClassToJSON(this, ["file_name"]);
  }
}

export { Domain };
export { DomainStatus };
