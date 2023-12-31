import { Command } from "@src/commands/command";

import { Nginx } from "@src/controllers";

export class StartCommand extends Command {
  constructor() {
    super();
  }

  async action() {
    this.intro("Starting vidos");

    await this.enforceConfigExists();

    await this.updateHosts();

    await this.updateServer();

    await this.linkServer();

    await this.startServer();

    this.outro("vidos started!");

    /**
     * TODO: would be cool to add a 'metadata' method to command and print it
     * here showing active and inactive services or stuff (similar to list)
     */
  }

  async linkServer() {
    this.start("Checking if the server is linked with our config files");

    if (await this.nginx.link()) {
      this.success("Server is now linked");
    } else {
      this.success("Server is already linked");
    }
  }

  async startServer() {
    this.start("Checking if the server is currently online");

    if (await Nginx.isRunning()) {
      this.success("Server is already running");
      if (this.config.settings.auto_refresh) await this.refreshServer();
    } else {
      this.info("Server is not currently online");
      this.success("Starting a server instance");
      await this.nginx.start();
      this.success("Server started");
    }
  }

  async updateHosts() {
    this.start("Making sure the hosts file is up to date");

    const result = await this.hosts.update();

    if (result.added.length || result.removed.length) {
      this.success("Hosts file updated");
    } else {
      this.success("Hosts file up to date");
    }
  }

  async updateServer() {
    this.start("Making sure the server files are up to date");

    const result = await this.nginx.update();

    if (typeof result == "boolean") {
      if (result) {
        this.success("Server files updated");
      } else {
        this.success("Server files up to date");
      }
      return;
    }

    this.success("Server files updated");
  }
}
