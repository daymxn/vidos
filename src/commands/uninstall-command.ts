import { Command } from "@src/commands/command";

import { HostEntry, Nginx } from "@src/controllers";
import { remove } from "fs-extra";
import { map, some } from "lodash-es";

export class UninstallCommand extends Command {
  constructor() {
    super();
  }

  async action() {
    this.intro("Uninstalling vidos");

    await this.enforceConfigExists();

    await this.deleteHostsEntries();
    await this.unlinkServer();
    await this.stopServer();
    await this.deleteServerFiles();

    this.outro("vidos uninstalled!");
  }

  async deleteServerFiles() {
    if (this.nginx.isOurs) {
      this.start("Deleting server");

      await remove(this.config.settings.nginx);

      this.success("Server deleted");
    }
  }

  async deleteHostsEntries() {
    this.start("Removing domains from hosts file");

    if (!this.config.domains.length) return this.info("No domains to remove");

    const remove_hosts = map(this.config.domains, (domain) =>
      this.hosts.remove(HostEntry.fromDomain(domain))
    );

    const results = await Promise.all(remove_hosts);

    if (results.length && some(results)) this.success("Domains removed from hosts file");
    else this.warn("No domains found in hosts file to remove");
  }

  async unlinkServer() {
    this.start("Unlinking the server from the config files");

    if (await this.nginx.unlink()) {
      this.success("Server unlinked from config files");
    } else {
      this.warn("Server was not linked with config files");
    }
  }

  async stopServer() {
    if (!(await Nginx.isRunning())) return this.warn("Server already stopped");

    if (this.nginx.isOurs) {
      this.start("Stopping the server");

      await this.nginx.stop();

      this.success("Server stopped");
    } else {
      await this.restartServer();
    }
  }

  async restartServer() {
    this.start(
      "Restarting the server instead of stopping it since we don't own the nginx instance"
    );

    await this.nginx.reload();

    this.success("Server restarted");
  }
}
