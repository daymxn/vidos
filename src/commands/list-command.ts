import { Command } from "@src/commands/command";
import { DomainStatus } from "@src/controllers";

import chalk from "chalk";
import CliTable3 from "cli-table3";
import { invokeMap, partition } from "lodash-es";

export class ListCommand extends Command {
  constructor() {
    super();
  }

  async action(args: any) {
    await this.enforceConfigExists();

    const status = args.status;
    const [active_domains, inactive_domains] = partition(this.config.domains, {
      status: DomainStatus.ACTIVE,
    });

    const pretty_active = invokeMap(active_domains, "prettyString").join("\n");
    const pretty_inactive = invokeMap(inactive_domains, "prettyString").join("\n");

    switch (status) {
      case "active": {
        this.log(pretty_active);
        break;
      }
      case "inactive": {
        this.log(pretty_inactive);
        break;
      }
      default: {
        const table = new CliTable3({
          head: [chalk.green("Active"), chalk.red("Inactive")],
        });

        table.push([pretty_active, pretty_inactive]);

        this.log(table.toString());
        break;
      }
    }
  }
}
