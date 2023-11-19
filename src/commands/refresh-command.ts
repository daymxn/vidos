import { Command } from "@src/commands/command";

import chalk from "chalk";
import { map } from "lodash-es";

export class RefreshCommand extends Command {
  constructor() {
    super();
  }

  async action() {
    this.intro("Refreshing configurations");

    await this.enforceConfigExists();

    await this.updateHosts();

    await this.updateServer();

    if (this.config.settings.auto_refresh) await this.refreshServer();

    this.outro("Configurations refreshed!");
  }

  async updateHosts() {
    this.start("Updating the hosts file");

    const result = await this.hosts.update();

    if (result.added.length || result.removed.length) {
      this.success("Hosts file updated");
      const added = map(
        result.added,
        (entry) => `${chalk.green("added")} ${chalk.dim(entry.prettyString())}`
      );
      const removed = map(
        result.removed,
        (entry) => `${chalk.red("removed")} ${chalk.dim(entry.prettyString())}`
      );

      this.log(added.join("\n"));
      this.log(removed.join("\n"));
    } else {
      this.info("Hosts file already up to date");
    }
  }

  async updateServer() {
    this.start("Updating the server files");

    const result = await this.nginx.update();

    if (typeof result == "boolean") {
      if (result) {
        this.success("Server files updated");
      } else {
        this.info("Server files already up to date");
      }
      return;
    }

    if (result.added.length || result.removed.length) {
      this.success("Server files updated");
      const added = map(result.added, (entry) => `${chalk.green("added")} ${chalk.dim(entry)}`);
      const removed = map(result.removed, (entry) => `${chalk.red("removed")} ${chalk.dim(entry)}`);

      this.log(added.join("\n"));
      this.log(removed.join("\n"));
    } else {
      this.info("Server files already up to date");
    }
  }
}
