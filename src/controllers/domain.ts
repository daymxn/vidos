import { encodeClassToJSON } from "@src/util";
import chalk from "chalk";

/**
 * Status representing if a domain is enabled or not.
 *
 * @enum {number}
 */
enum DomainStatus {
  INACTIVE = 0,
  ACTIVE = 1,
}

/**
 * Common interface for creating and interacting with domains.
 *
 * @property {string} file_name - nginx config file name representation for this domain.
 * @property {string} source - The http domain to direct traffic from.
 * @property {string} destination - The local IP to direct traffic to.
 * @property {DomainStatus} status - Whether the domain is currently enabled or not.
 */
class Domain {
  public readonly file_name: string;

  constructor(
    public readonly source: string,
    public readonly destination: string,
    public status: DomainStatus = DomainStatus.ACTIVE
  ) {
    const destWithFixedPorts = destination.replace(":", "$");

    this.file_name = `${source}-${destWithFixedPorts}.conf`;
  }

  /**
   * Creates a Domain instance from a JSON string.
   *
   * @param {string} str - The JSON string to parse.
   * @returns {Domain} - The created Domain instance.
   */
  static fromString(str: string): Domain {
    const json = JSON.parse(str);

    return this.fromObject(json);
  }

  /**
   * Creates a Domain instance from a javascript object.
   *
   * @param {Object} obj - The javascript object with domain properties.
   * @returns {Domain} - The created Domain instance.
   */
  static fromObject(obj: { [key: string]: any }): Domain {
    return new Domain(obj.source, obj.destination, obj.status);
  }

  /**
   * Generates a pretty string representation of the domain.
   *
   * Intended to be used when displaying the domain the CLI; with pretty colors
   * and formatting.
   *
   * @returns {string} - The pretty string representation.
   */
  prettyString(): string {
    const str = `${chalk.green(this.source)} => ${chalk.blue(this.destination)}`;

    if (this.status == DomainStatus.INACTIVE) return chalk.dim(str);
    return str;
  }

  /**
   * Converts the Domain instance to a JSON string.
   *
   * Will filter out properties not intended to be saved.
   *
   * @returns {string} - The JSON string representation of the instance.
   */
  toString(): string {
    return encodeClassToJSON(this, ["file_name"]);
  }
}

export { Domain, DomainStatus };
