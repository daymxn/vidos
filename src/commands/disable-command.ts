import { Command } from "@src/commands/command";

import { Domain, DomainStatus, HostEntry } from "@src/controllers";
import { NotFoundError } from "@src/util";
import { some } from "lodash-es";

export class DisableCommand extends Command {
  constructor() {
    super();
  }

  async action(args: any) {
    this.intro("Disabling domain");

    await this.enforceConfigExists();

    const { domain } = args;

    this.validateDomain(domain);
    if (domain.status == DomainStatus.INACTIVE) return this.outro("Domain already disabled");

    await this.disableDomain(domain);

    domain.status = DomainStatus.INACTIVE;

    if (this.config.settings.auto_refresh) await this.refreshServer();

    await this.saveToConfig();

    this.outro("Domain disabled!");
  }

  validateDomain(domain: Domain) {
    this.start("Checking if the domain exists");

    if (!some(this.config.domains, { domain })) throw new NotFoundError("Domain not found");

    this.success("Domain Exists");
  }

  async disableDomain(domain: Domain) {
    this.start("Updating hosts and server files");

    const removeFromHosts = this.hosts.remove(HostEntry.fromDomain(domain));
    const disableInNginx = this.nginx.disableDomain(domain);

    const [hostResult, nginxResult] = await Promise.all([removeFromHosts, disableInNginx]);

    hostResult
      ? this.success("Hosts file updated")
      : this.warn("Domain was already disabled in hosts file");

    this.start("Updating server file");

    nginxResult
      ? this.success("Server file updated")
      : this.warn("Domain was already disabled in server file");
  }

  async saveToConfig() {
    this.start("Updating the local config");

    await this.config.save();

    this.success("Local config updated");
  }
}
