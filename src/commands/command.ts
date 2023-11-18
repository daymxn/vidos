import { confirm } from "@inquirer/prompts";
import { Config, Hosts, Nginx } from "@src/controllers";
import { DISABLE_LOGGING } from "@src/util";
import chalk from "chalk";
import ora, { Ora } from "ora";

export interface CommandConfig {
  config: Config;
  hosts: Hosts;
  nginx: Nginx;
  root: string;
}

export abstract class Command {
  protected readonly config: Config;
  protected readonly hosts: Hosts;
  protected readonly nginx: Nginx;
  protected readonly root: string;

  protected readonly config_path: string;

  private spinner: Ora = ora();

  protected constructor(config: CommandConfig) {
    this.config = config.config;
    this.hosts = config.hosts;
    this.nginx = config.nginx;
    this.root = config.root;

    this.config_path = `${this.root}/config.json`;
  }

  async refreshServer() {
    this.start("Refreshing server");
    await this.nginx.reload().catch((err) => {
      this.fail("Failed to refresh the server");
      throw err;
    });
    this.success("Server refreshed");
  }

  start(message: string) {
    if (DISABLE_LOGGING) return;

    this.spinner = ora(`${message}\n`).start();
  }

  success(message: string) {
    if (DISABLE_LOGGING) return;

    this.spinner.succeed(`${message}\n`);
  }

  fail(message: string) {
    if (DISABLE_LOGGING) return;

    this.spinner.fail(`${message}\n`);
  }

  intro(message: string) {
    if (DISABLE_LOGGING) return;

    this.log(chalk.cyan(message));
  }

  outro(message: string) {
    if (DISABLE_LOGGING) return;

    this.log(chalk.cyan(message));
  }

  async confirm(message: string): Promise<boolean> {
    return confirm({ message, default: true });
  }

  log(message: string) {
    if (DISABLE_LOGGING) return;

    console.log(message);
  }

  abstract action(...args: any[]): Promise<void> | void;
}
