import { Command } from "@src/commands/command";

import { Domain, HostEntry } from "@src/controllers";
import { NotFoundError } from "@src/util";
import { remove } from "lodash";

export class DeleteCommand extends Command {
  constructor() {
    super();
  }

  async action(args: any) {
    this.intro("Deleting a domain");

    await this.enforceConfigExists();

    const { source } = args;
    const domain = this.validateDomain(source);

    await this.removeFromFiles(domain);

    if (this.config.settings.auto_refresh) await this.refreshServer();

    await this.removeFromConfig(domain);

    this.outro("Domain deleted!");
  }

  validateDomain(source: string): Domain {
    this.start("Checking if the domain exists");

    const domain = this.config.domainByName(source);
    if (!domain) throw new NotFoundError("Domain not found");

    this.success("Domain Exists");

    return domain;
  }

  async removeFromFiles(domain: Domain) {
    this.start("Removing from hosts and server file(s)");

    const removeFromHosts = this.hosts.remove(HostEntry.fromDomain(domain));
    const removeFromNginx = this.nginx.removeDomain(domain);

    const [inHosts, inNginx] = await Promise.all([removeFromHosts, removeFromNginx]);

    if (inHosts) {
      this.success("Removed from hosts file");
    } else {
      this.info("Already removed from hosts file");
    }
    if (inNginx) {
      this.success("Removed from server files");
    } else {
      this.info("Already removed from server file");
    }
  }

  async removeFromConfig(domain: Domain) {
    this.start("Removing from config");

    remove(this.config.domains, domain);
    await this.config.save();

    this.success("Removed from config");
  }
}
