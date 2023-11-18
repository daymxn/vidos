import { Domain } from "@src/controllers/domain";
import { FileSystem } from "@src/controllers/file-system";
import { encodeClassToJSON, IOError, NotFoundError, tryOrThrow } from "@src/util";

interface ConfigSettings {
  host_file: string;
  backup_host_file: string;
  nginx: string;
  nginx_folder_name: string;
  backup_nginx_conf: string;
  auto_refresh: boolean;
}

class Config {
  constructor(
    public domains: Domain[],
    public path: string,
    public files: FileSystem,
    public settings: ConfigSettings
  ) {}

  domainByName(name: string): Domain | undefined {
    return this.domains.find((domain) => domain.source === name);
  }

  static fromJSON(str: string, path: string): Config {
    const json = JSON.parse(str);

    const domains: Domain[] = json.domains.map((domain: any) => Domain.fromObject(domain));

    return new Config(domains, path, new FileSystem(), json.settings);
  }

  toJSONString(): string {
    return encodeClassToJSON(this, ["file_name", "path"]);
  }

  async save(): Promise<void> {
    return tryOrThrow(
      this.files.write(this.path, this.toJSONString()),
      new IOError("Failed to save config")
    );
  }

  static async load(): Promise<Config> {
    const files = new FileSystem();
    const path = `${FileSystem.root}/config.json`;

    return tryOrThrow(async () => {
      if (await files.exists(path)) {
        const data = await files.readData(path);
        return this.fromJSON(data, path);
      } else {
        throw new NotFoundError("Missing local config. Please run `init` to create one.");
      }
    }, new IOError("Failed to load the local config file"));
  }
}

export { Config, ConfigSettings };
