import { Domain } from "@src/controllers/domain";
import { FileSystem } from "@src/controllers/file-system";
import { encodeClassToJSON, IOError, NotFoundError, tryOrThrow } from "@src/util";

/**
 * Interface representing the settings for a Config instance.
 *
 * @property {string} host_file - The path to the host file.
 * @property {string} backup_host_file - Where to save a backup host file before mutations.
 * @property {string} nginx - The path to the Nginx folder (where the executable is).
 * @property {string} nginx_folder_name - Directory under which nginx domain configurations will be created in.
 * @property {string} backup_nginx_conf - Where to save a backup nginx conf file before mutations.
 * @property {boolean} auto_refresh - Flag indicating whether to auto-refresh nginx when making changes.
 */
interface ConfigSettings {
  host_file: string;
  backup_host_file: string;
  nginx: string;
  nginx_folder_name: string;
  backup_nginx_conf: string;
  auto_refresh: boolean;
}

/**
 * Represents the application configuration.
 *
 * Saved locally as `config.json` at the application root.
 *
 * @property {Domain[]} domains - Created domains, with their respective configurations.
 * @property {FileSystem} files - A FileSystem object for file operations.
 * @property {ConfigSettings} settings - The settings for the configuration.
 * @property {string} path - Path to the local config file.
 */
class Config {
  private readonly path: string = `${FileSystem.root}/config.json`;

  constructor(
    public domains: Domain[],
    public files: FileSystem,
    public settings: ConfigSettings
  ) {}

  /**
   * Creates a Config object from a JSON string.
   *
   * @param {string} str - The JSON string to parse.
   * @returns {Config} - The created Config object.
   */
  static fromJSON(str: string): Config {
    const json = JSON.parse(str);

    const domains: Domain[] = json.domains.map((domain: any) => Domain.fromObject(domain));

    return new Config(domains, new FileSystem(), json.settings);
  }

  /**
   * Loads the Config object from a file.
   *
   * @returns {Promise<Config>} - A promise that resolves with the loaded Config object.
   */
  static async load(): Promise<Config> {
    const files = new FileSystem();
    const path = `${FileSystem.root}/config.json`;

    return tryOrThrow(async () => {
      if (await files.exists(path)) {
        const data = await files.readData(path);
        return this.fromJSON(data);
      } else {
        throw new NotFoundError("Missing local config. Please run `init` to create one.");
      }
    }, new IOError("Failed to load the local config file"));
  }

  /**
   * Retrieves a domain by its name.
   *
   * @param {string} name - The name of the domain to find.
   * @returns {Domain | undefined} - The found Domain object, or undefined if not found.
   */
  domainByName(name: string): Domain | undefined {
    return this.domains.find((domain) => domain.source === name);
  }

  /**
   * Converts the Config object to a JSON string.
   *
   * @returns {string} - The JSON string representation of the Config object.
   */
  toJSONString(): string {
    return encodeClassToJSON(this);
  }

  /**
   * Saves the Config object to a file.
   *
   * @returns {Promise<void>} - A promise that resolves when the save operation is complete.
   */
  async save(): Promise<void> {
    return tryOrThrow(
      this.files.write(this.path, this.toJSONString()),
      new IOError("Failed to save config")
    );
  }
}

export { Config, ConfigSettings };
