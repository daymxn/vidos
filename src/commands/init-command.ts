import { Command } from "@src/commands/command";
import { Nginx } from "@src/controllers";

export class InitCommand extends Command {
  constructor() {
    super();
  }

  async action(args: any) {
    this.intro("Initializing local-domains");

    if (!(await this.validateNginx())) return;

    await this.downloadNginx();

    await this.updateConfigFile();

    // TODO: have box or message like thanks for using us and ./help to get started

    this.outro("Server files downloaded!");
  }

  async checkForLocalConfig(): Promise<void> {
    this.start("Looking for a local config file");

    this.success("Nginx downloaded and extracted");
  }

  async validateNginx(): Promise<boolean> {
    return this.config.settings.nginx.length
      ? await this.confirm(
          "Config already has an nginx file path specified. Continuing with the download will overwrite this path. Is that okay?"
        )
      : true;
  }

  async downloadNginx() {
    this.start("Downloading and extracting nginx");

    await Nginx.download();

    this.success("Nginx downloaded and extracted");
  }

  async updateConfigFile() {
    this.start("Updating config file");

    this.config.settings.nginx = Nginx.default_path;
    await this.config.save();

    this.success("Config file updated");
  }
}
