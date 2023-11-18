import { confirm, select } from "@inquirer/prompts";
import { Config, FileSystem, Hosts, Nginx } from "@src/controllers";
import { DISABLE_LOGGING, lateInit, lazy } from "@src/util";
import chalk from "chalk";
import CliTable3 from "cli-table3";
import { map } from "lodash-es";
import ora, { Ora } from "ora";

export abstract class Command {
  protected files: FileSystem;
  protected root: string;
  protected readonly config_path: string;

  protected config: Config = lateInit();
  protected hosts: Hosts = lazy(() => new Hosts(this.config, this.files));
  protected nginx: Nginx = lazy(() => new Nginx(this.config, this.files));

  private spinner: Ora = ora();

  protected constructor() {
    this.files = new FileSystem();
    this.root = FileSystem.root;
    this.config_path = `${this.root}/config.json`;
  }

  async enforceConfigExists() {
    this.config = await Config.load();
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

    this.spinner = ora(` ${message}\n`).start();
  }

  warn(message: string) {
    if (DISABLE_LOGGING) return;

    this.spinner.warn(` ${message}\n`);
  }

  success(message: string) {
    if (DISABLE_LOGGING) return;

    this.spinner.succeed(` ${message}\n`);
  }

  fail(message: string) {
    if (DISABLE_LOGGING) return;

    this.spinner.fail(` ${message}\n`);
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

  async select(message: string, options: string[]): Promise<string> {
    return select({
      message,
      choices: map(options, (option) => ({
        name: option,
        value: option,
      })),
    });
  }

  async box(...messages: string[]): Promise<void> {
    const table = new CliTable3({});

    table.push([messages.join("\n")]);

    this.log(table.toString());
    this.log("\n");
  }

  log(message: string) {
    if (DISABLE_LOGGING) return;

    console.log(message);
  }

  abstract action(...args: any[]): Promise<void> | void;
}
