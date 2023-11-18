import { Command } from "@src/commands/command";
import { Config, FileSystem, Nginx } from "@src/controllers";
import chalk from "chalk";
import { execa } from "execa";

export class InitCommand extends Command {
  constructor() {
    super();
  }

  async action(args: any) {
    this.intro("Initializing local-domains");

    await this.createConfig();

    let nginx_path = await this.computeNginxPath();
    if (!nginx_path) return this.outro("Can not continue without an nginx installation.");
    this.config.settings.nginx = nginx_path;

    await this.setAutoRefresh();
    await this.setBackups();

    await this.saveConfig();
    await this.complete();
  }

  async complete(): Promise<void> {
    await this.box(
      chalk.bold(chalk.green("Initialization complete!")),
      chalk.dim("------------------------"),
      chalk.italic(`run ${chalk.blueBright("local-domains help")} to get started`),
      "",
      chalk.dim("💗 thank you for using local-domains 💗")
    );
  }

  async setBackups(): Promise<void> {
    const make_backups = await this.confirm(
      "Should we make a backup of the hosts and nginx config files before making changes?"
    );

    if (!make_backups) return;

    this.config.settings.backup_host_file = "backup_hosts_local-domains";
    this.config.settings.backup_nginx_conf = "backup_nginx_conf";
  }

  async setAutoRefresh(): Promise<void> {
    this.config.settings.auto_refresh = await this.confirm(
      "Should we automatically refresh nginx whenever we make changes?"
    );
  }

  findHostsFile(): string {
    return FileSystem.isWindows ? "C:/Windows/System32/drivers/etc/hosts" : "/etc/hosts";
  }

  async computeNginxPath(): Promise<string | undefined> {
    this.log("We can download the server files (nginx), or look for an existing installation.");
    let nginx_path = await this.tryToDownloadNginx();
    if (!nginx_path) nginx_path = await this.lookForNginx();
    if (!nginx_path) nginx_path = await this.tryToDownloadNginx();

    return nginx_path;
  }

  async tryToDownloadNginx(): Promise<string | undefined> {
    const shouldDownload = await this.confirm(
      "Would you like us to download and save a local copy of nginx ourselves?"
    );
    if (!shouldDownload) return;

    this.start("Downloading nginx");

    await Nginx.download();

    this.success("Downloaded nginx");

    return Nginx.default_path;
  }

  async createConfig(): Promise<void> {
    if (await this.files.exists(Config.path)) {
      const result = await this.confirm(
        "You already have a local config file. Would you like to use it as a base?"
      );
      if (result) return await this.enforceConfigExists();
    }

    this.start("Creating a base config");

    this.config = new Config([], new FileSystem(), {
      auto_refresh: true,
      backup_host_file: "",
      backup_nginx_conf: "",
      host_file: this.findHostsFile(),
      nginx: "",
      nginx_folder_name: "local-domains",
    });

    this.success("Config created!");
  }

  async lookForNginx(): Promise<string | undefined> {
    this.start("Looking for an existing nginx installation");

    const path = await this.findNginxPath();

    if (path) {
      this.success("Found an existing nginx installation");

      const result = await this.confirm(`Can we use this nginx installation? \"${path}\"`);

      return result ? path : undefined;
    } else {
      this.warn("Couldn't find an existing nginx installation");
      return;
    }
  }

  private async findNginxPath(): Promise<string | undefined> {
    try {
      const { stdout } = await execa("which", ["nginx"]);
      if (stdout.length == 0) return;
      if (!FileSystem.isWindows) return stdout;

      const cygpath_result = await execa("cygpath", ["-w", `${stdout}`]);
      return cygpath_result.stdout;
    } catch (e: any) {
      return;
    }
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

  async saveConfig() {
    this.start("Saving config file to disc");

    await this.config.save();

    this.success("Config file saved!");
  }
}
