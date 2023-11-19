import { Command } from "@src/commands/command";

import { Domain, DomainStatus, HostEntry } from "@src/controllers";
import { NotFoundError } from "@src/util";
import { some } from "lodash-es";

export class EnableCommand extends Command {
  constructor() {
    super();
  }

  async action(args: any) {
    this.intro("Enabling domain");

    await this.enforceConfigExists();

    const { domain } = args;

    this.validateDomain(domain);
    if (domain.status == DomainStatus.ACTIVE) return this.outro("Domain already enabled");

    await this.enableDomain(domain);

    domain.status = DomainStatus.ACTIVE;

    if (this.config.settings.auto_refresh) await this.refreshServer();

    await this.saveToConfig();

    this.outro("Domain enabled!");
  }

  validateDomain(domain: Domain) {
    this.start("Checking if the domain exists");

    if (!some(this.config.domains, { domain })) throw new NotFoundError("Domain not found");

    this.success("Domain Exists");
  }

  async enableDomain(domain: Domain) {
    this.start("Updating hosts and server files");

    const addToHosts = this.hosts.add(HostEntry.fromDomain(domain));
    const enableInNginx = this.nginx.enableDomain(domain);

    const [hostResult, nginxResult] = await Promise.all([addToHosts, enableInNginx]);

    hostResult
      ? this.success("Hosts file updated")
      : this.warn("Domain was already enabled in hosts file");

    this.start("Updating server file");

    nginxResult
      ? this.success("Server file updated")
      : this.warn("Domain was already enabled in server file");
  }

  async saveToConfig() {
    this.start("Updating the local config");

    await this.config.save();

    this.success("Local config updated");
  }
}
