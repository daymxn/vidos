import { Config, Domain, DomainStatus, FileSystem } from "@src/controllers";
import {
  COMMON_CONFIG,
  COMMON_CONFIG_FILE,
  Changes,
  IOError,
  NetworkError,
  downloadAndUnzipFolder,
  tryOrThrow,
} from "@src/util";
import { execa } from "execa";

import axios from "axios";
import dedent from "dedent";
import {
  concat,
  difference,
  every,
  includes,
  last,
  map,
  partition,
  replace,
  startsWith,
  trimStart,
} from "lodash-es";

/**
 * Class representing Nginx server operations.
 *
 * @property {string} nginx_conf - Path to the main `nginx.conf` file.
 * @property {string} nginx - Path to the nginx executable.
 * @property {string} domains_folder - Path to a subdirectory in the nginx directory for domain conf files.
 * @property {string} include_symbol - The include symbol for Nginx configurations- for linking conf files.
 */
class Nginx {
  private readonly nginx_conf: string;
  private readonly nginx: string;
  private readonly domains_folder: string;
  private readonly include_symbol: string;

  /**
   * The default path for Nginx installations.
   *
   * @static
   */
  static default_path = `${FileSystem.root}/nginx`;

  constructor(
    private readonly config: Config,
    private readonly files: FileSystem
  ) {
    this.nginx_conf = `${config.settings.nginx}/conf/nginx.conf`;
    this.domains_folder = `${config.settings.nginx}/conf/local-domains`;
    this.nginx = `${config.settings.nginx}/nginx.exe`;

    this.include_symbol = `include ${config.settings.nginx_folder_name}/*.conf;`;
  }

  // TODO(): when the application runs, if it cant find nginx at the default path, it'll prompt the user with something like
  // "couldn't find nginx here X, would you like me to download it myself?"
  // TODO(): thinking about this ^ happy path. esp since we have init... idk what I wanna do
  // If there's no config present- or the path is empty, ask them to `init` or `download` (empty = `download`, not present = `init`)
  // And wrap all the commands that require it in it (pretty much all besides download and init respectively. list maybe too. idk if theres any other non nginx commands)
  // then call this method if yes else exit
  // init should try to find an existing nginx (maybe by trying to use it on the path with whereis or whatever), and asking if we should use it
  /**
   * Downloads the latest version of Nginx to a local /nginx directory.
   *
   * Properly knows how to download and unzip the files, regardless of the OS.
   * //TODO: I don't think the unzipper we use supports .tar.gz (no linux/mac support)
   *
   * @static
   */
  static async download() {
    const suffix = FileSystem.isWindows ? ".zip" : ".tar.gz";
    const base_url = "https://nginx.org/download/nginx-";

    const latestVersion = await this.getLatestReleasedVersion();

    const url = `${base_url}${latestVersion}${suffix}`;

    await downloadAndUnzipFolder(url, Nginx.default_path);
  }

  /**
   * Gets the latest released version of Nginx.
   *
   * This is done by polling the release tags from the nginx GitHub repo.
   *
   * @private
   * @static
   * @returns {Promise<string>} - The latest version number.
   */
  private static async getLatestReleasedVersion(): Promise<string> {
    return tryOrThrow(async () => {
      const response = await axios.get(
        "https://raw.githubusercontent.com/nginx/nginx/master/.hgtags"
      );
      const lines: string[] = response.data.trim().split("\n");
      const latest_version = last(lines)!!.split("-")[1];

      return trimStart(latest_version, "release-");
    }, new NetworkError("Failed to fetch the latest released version of nginx"));
  }

  /**
   * Reloads the Nginx server.
   *
   * @returns {Promise<void>}
   */
  async reload(): Promise<void> {
    await tryOrThrow(
      execa(this.nginx, ["-s", "reload"], { cwd: this.config.settings.nginx }),
      new IOError("Failed to reload the server")
    );
  }

  /**
   * Updates the Nginx server configuration.
   *
   * Reads the local config to find domains that had their state changed
   * manually, and corrects the nginx configuration files to reflect the actual
   * config state.
   *
   * @returns {Promise<Changes<string>>} - The changes made, including files added or removed.
   */
  async update(): Promise<Changes<string>> {
    return tryOrThrow(async () => {
      await this.createCommonDomainConfig();
      await this.addAllDomains();

      const files = await this.files.listFiles(this.domains_folder, [COMMON_CONFIG_FILE]);
      const domains = map(this.config.domains, "file_name");

      const [valid_files, invalid_files] = partition(files, (file) => domains.includes(file));
      const missing_files = difference(domains, valid_files);

      await Promise.all([
        ...this.updateDomainStatuses(),
        ...this.removeInvalidFiles(invalid_files),
      ]);

      return {
        added: missing_files,
        removed: invalid_files,
      };
    }, new IOError("Failed to update the server files"));
  }

  /**
   * Adds a domain configuration to Nginx.
   *
   * @param {Domain} domain - The domain to add.
   * @returns {Promise<boolean>} - True if successful, false otherwise.
   */
  async addDomain(domain: Domain): Promise<boolean> {
    return tryOrThrow(async () => {
      const path = this.domainPath(domain);

      if (await this.exists(domain)) return false;

      await this.files.write(path, this.domainServerFileContent(domain));

      return true;
    }, new IOError("Failed to create a server file for a domain"));
  }

  /**
   * Removes a domain configuration from Nginx.
   *
   * @param {Domain} domain - The domain to remove.
   * @returns {Promise<boolean>} - True if successful, false otherwise.
   */
  async removeDomain(domain: Domain): Promise<boolean> {
    return tryOrThrow(async () => {
      const path = this.domainPath(domain);

      if (!(await this.exists(domain))) return false;

      await this.files.delete(path);

      return true;
    }, new IOError("Failed to delete the server file for a domain"));
  }

  /**
   * Checks if a domain configuration exists in Nginx.
   *
   * @param {Domain} domain - The domain to check.
   * @returns {Promise<boolean>} - True if exists, false otherwise.
   */
  async exists(domain: Domain): Promise<boolean> {
    return tryOrThrow(async () => {
      const path = this.domainPath(domain);

      return this.files.exists(path);
    }, new IOError("Failed to validate the existence of a server file"));
  }

  /**
   * Disables a domain in the Nginx configuration.
   *
   * @param {Domain} domain - The domain to disable.
   * @returns {Promise<boolean>} - True if successful, false otherwise.
   */
  async disableDomain(domain: Domain): Promise<boolean> {
    return tryOrThrow(async () => {
      const file = this.domainPath(domain);
      const file_data = await this.files.readLines(file);

      if (every(file_data, (line) => startsWith(line, "#"))) return false;

      const new_lines = map(file_data, (line) => `#${line}`);

      await this.files.writeLines(file, new_lines);

      return true;
    }, new IOError("Failed to edit a server file to disable a domain"));
  }

  /**
   * Enables a domain in the Nginx configuration.
   *
   * @param {Domain} domain - The domain to enable.
   * @returns {Promise<boolean>} - True if successful, false otherwise.
   */
  async enableDomain(domain: Domain): Promise<boolean> {
    return tryOrThrow(async () => {
      const file = this.domainPath(domain);
      const file_data = await this.files.readLines(file);

      if (!every(file_data, (line) => startsWith(line, "#"))) return false;

      const new_lines = map(file_data, (line) => trimStart(line, "#"));

      await this.files.writeLines(file, new_lines);

      return true;
    }, new IOError("Failed to edit a server file to enable a domain"));
  }

  /**
   * Creates a common domain configuration file for Nginx.
   *
   * These are common configurations shared across all domains, which they will
   * automatically include in their declaration.
   *
   * @returns {Promise<boolean>} - True if successful, false otherwise.
   */
  async createCommonDomainConfig(): Promise<boolean> {
    return tryOrThrow(async () => {
      const common_config_file = `${this.domains_folder}/${COMMON_CONFIG_FILE}`;

      if (await this.files.exists(common_config_file)) return false;

      await this.files.write(common_config_file, COMMON_CONFIG);

      return true;
    }, new IOError("Failed to write to the (common) server config"));
  }

  /**
   * Links our configurations with the main nginx config file.
   *
   * @returns {Promise<boolean>} - True if successful, false otherwise.
   */
  async link(): Promise<boolean> {
    return tryOrThrow(async () => {
      const file_content = await this.files.readData(this.nginx_conf);

      if (includes(file_content, this.include_symbol)) return false;

      const regex = new RegExp("^http {", "gm");
      const new_line = `$1\n    ${this.include_symbol}`;

      // TODO: should test if remove works
      const updated_lines = replace(file_content, regex, new_line);

      await this.files.write(this.nginx_conf, updated_lines);

      return true;
    }, new IOError("Failed to update the main server config file"));
  }

  /**
   * Unlinks our configurations from the main nginx config file.
   *
   * @returns {Promise<boolean>} - True if successful, false otherwise.
   */
  async unlink(): Promise<boolean> {
    return tryOrThrow(async () => {
      const file_content = await this.files.readData(this.nginx_conf);

      if (!includes(file_content, this.include_symbol)) return false;

      const updated_lines = replace(file_content, this.include_symbol, "");

      await this.files.write(this.nginx_conf, updated_lines);

      return true;
    }, new IOError("Failed to remove the includes symbol from the main server config file"));
  }

  /**
   * Gets the path for a domain's configuration file.
   *
   * @private
   * @param {Domain} domain - The domain.
   * @returns {string} - The file path.
   */
  private domainPath(domain: Domain): string {
    return `${this.domains_folder}/${domain.file_name}`;
  }

  /**
   * Generates the server file content for a domain.
   *
   * @private
   * @param {Domain} domain - The domain.
   * @returns {string} - The file content.
   */
  private domainServerFileContent(domain: Domain): string {
    return dedent`server {
          listen 80;
          server_name ${domain.source};
          location / {
            proxy_pass http://${domain.destination};
            include local-domains/local-domains-common.conf;
          }
        }
        `;
  }

  /**
   * Removes invalid domain configuration files.
   *
   * A domain is considered invalid if it is present in our configuration files,
   * but not in the local config; meaning either cleanup did not occur or the
   * config file was manually edited.
   *
   * @private
   * @param {string[]} invalid_files - The files to remove.
   * @returns {Promise<void>[]} - An array of promises.
   */
  private removeInvalidFiles(invalid_files: string[]): Promise<void>[] {
    return map(invalid_files, (file) => this.files.delete(`${this.domains_folder}/${file}`));
  }

  /**
   * Adds all domains to the Nginx configuration.
   *
   * @private
   * @returns {Promise<boolean[]>} - An array of results.
   */
  private addAllDomains(): Promise<boolean[]> {
    return Promise.all(map(this.config.domains, (domain) => this.addDomain(domain)));
  }

  /**
   * Updates the status of domains in the Nginx configuration.
   *
   * @private
   * @returns {Promise<boolean[]>} - An array of results.
   */
  private updateDomainStatuses(): Promise<boolean>[] {
    const [active, inactive] = partition(this.config.domains, { status: DomainStatus.ACTIVE });

    return concat(
      map(active, (domain) => this.enableDomain(domain)),
      map(inactive, (domain) => this.disableDomain(domain))
    );
  }
}

export { Nginx };
