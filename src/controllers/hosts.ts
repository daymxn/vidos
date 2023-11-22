import { Config, Domain, DomainStatus, FileSystem } from "@src/controllers";
import { Changes, IOError, arrayContains, removePortFromIp, tryOrThrow } from "@src/util";
import chalk from "chalk";
import { chain, filter, isEqual } from "lodash";

const VIDOS_COMMENT = "vidos";
const HOST_ENTRY_REGEX = RegExp(
  "(?<address>^[^#\\s]+) (?<hostname>[^#\\s]+)(?:\\s*#\\s*(?<comment>.+))?"
);

/**
 * Represents an entry in the hosts file.
 *
 * Note that this intentionally does not support multiple names, as to avoid complexity for this project
 */
// TODO: worth separating into its own repo/npm project, with support for blocking websites + host file features
class HostEntry {
  /**
   * Creates a HostEntry instance.
   *
   * @param {string} ip - The address of the host entry.
   * @param {string} name - The hostname of the host entry.
   */
  constructor(
    public ip: string,
    public name: string
  ) {}

  /**
   * Returns a pretty string representation of the host entry.
   *
   * Intended to be used for end-user display purposes.
   *
   * @returns {string} Formatted host entry.
   */
  prettyString(): string {
    return `${chalk.green(this.name)} => ${chalk.blue(this.ip)}`;
  }

  /**
   * Converts the host entry to a string in hosts file format.
   *
   * Has the {VIDOS_COMMENT} appended to it, to distinguish between other entries.
   *
   * @returns {string} Host entry as a string.
   */
  toString(): string {
    return `\n${this.ip} ${this.name} # ${VIDOS_COMMENT}`.trim();
  }

  /**
   * Creates a HostEntry from a string.
   *
   * If the entry doesn't have our signature comment (meaning we didn't creat it), this method will ignore it.
   *
   * @param {string} str - A line from the hosts file.
   * @returns {HostEntry|null} The HostEntry object or null if the line is invalid (or not one that we created)
   */
  static fromString(str: string): HostEntry | null {
    const match = str.match(HOST_ENTRY_REGEX);

    if (!match || !match.groups) return null;

    const { address, hostname, comment = undefined } = match.groups;

    if (comment != VIDOS_COMMENT) return null;

    return new HostEntry(address, hostname);
  }

  /**
   * Creates a HostEntry from a Domain object.
   *
   * @param {Domain} domain - The domain object.
   * @returns {HostEntry} The corresponding HostEntry object.
   */
  static fromDomain(domain: Domain): HostEntry {
    return new HostEntry(removePortFromIp(domain.destination), domain.source);
  }
}

/**
 * Provides functionality to manage the hosts file.
 */
class Hosts {
  private readonly path: string;

  /**
   * Constructs a Hosts object with the provided configuration.
   *
   * @param {Config} config - The configuration object including hosts file path.
   * @param {FileSystem} files - An instance of FileSystem to make I/O calls
   */
  constructor(
    private readonly config: Config,
    private readonly files: FileSystem
  ) {
    this.path = config.settings.host_file;
  }

  /**
   * Updates the hosts file based on active domains in the configuration.
   *
   * @returns {Promise<Changes<HostEntry>>} An object detailing the changes made.
   */
  async update(): Promise<Changes<HostEntry>> {
    return tryOrThrow(async () => {
      const activeHosts = filter(this.config.domains, { status: DomainStatus.ACTIVE }).map(
        (domain) => HostEntry.fromDomain(domain)
      );

      const hostEntries = await this.readHostsFile();

      const entriesToRemove = hostEntries.filter((host) => !arrayContains(activeHosts, host));
      const entriesToAdd = activeHosts.filter((host) => !arrayContains(hostEntries, host));

      const lines = chain(await this.readFile())
        .filter((line) => {
          const host = HostEntry.fromString(line);
          return !(host && arrayContains(entriesToRemove, host));
        })
        .concat(entriesToAdd.map((entry) => entry.toString()))
        .value();

      await this.files.writeLines(this.path, lines);

      return {
        added: entriesToAdd,
        removed: entriesToRemove,
      };
    }, new IOError("Failed to update the hosts file"));
  }

  /**
   * Reads the hosts file and returns an array of HostEntry objects.
   *
   * @returns {Promise<HostEntry[]>} An array of HostEntry objects.
   */
  async readHostsFile(): Promise<HostEntry[]> {
    const lines = await this.readFile();

    return chain(lines)
      .map((line) => HostEntry.fromString(line))
      .filter((line): line is HostEntry => line !== null)
      .value();
  }

  /**
   * Checks if a given HostEntry exists in the hosts file.
   *
   * @param {HostEntry} host - The HostEntry to check.
   * @returns {Promise<boolean>} True if the entry exists, false otherwise.
   */
  async exists(host: HostEntry): Promise<boolean> {
    const entries = await this.readHostsFile();

    return arrayContains(entries, host);
  }

  /**
   * Adds a new HostEntry to the hosts file.
   *
   * @param {HostEntry} host - The HostEntry to add.
   * @returns {Promise<boolean>} True if the entry was added, false if it already exists.
   */
  async add(host: HostEntry): Promise<boolean> {
    return tryOrThrow(async () => {
      const hosts = await this.readHostsFile();

      if (arrayContains(hosts, host)) return false;

      await this.files.append(this.path, `\n${host.toString()}`);

      return true;
    }, new IOError("Failed to add an entry to the hosts file"));
  }

  /**
   * Removes a HostEntry from the hosts file.
   *
   * @param {HostEntry} host - The HostEntry to remove.
   */
  async remove(host: HostEntry): Promise<boolean> {
    return tryOrThrow(async () => {
      const hosts = await this.readHostsFile();

      if (!arrayContains(hosts, host)) return false;

      const lines = chain(await this.readFile())
        .filter((line) => !isEqual(HostEntry.fromString(line), host))
        .value();

      await this.files.writeLines(this.path, lines);

      return true;
    }, new IOError("Failed to remove a host from the hosts file"));
  }

  /**
   * Reads the hosts file and returns its contents as an array of strings.
   *
   * @returns {Promise<string[]>} The contents of the hosts file.
   */
  private async readFile(): Promise<string[]> {
    return tryOrThrow(this.files.readLines(this.path), new IOError("Failed to read hosts file"));
  }
}

export { HostEntry, Hosts };
