import {Command, CommandConfig} from "./Command.js";
import {DomainStatus} from "../config.js";
import _ from "lodash";
import CliTable3 from "cli-table3";
import chalk from "chalk";

export class ListCommand extends Command {
    constructor(config: CommandConfig) {
        super(config);
    }

    action(args: any) {
        const status = args.status
        const [active_domains, inactive_domains] = _.partition(this.config.domains, { status: DomainStatus.ACTIVE })

        const pretty_active = _.invokeMap(active_domains, "prettyString").join("\n")
        const pretty_inactive = _.invokeMap(inactive_domains, "prettyString").join("\n")

        switch(status) {
            case "active": {
                this.log(pretty_active)
                break
            }
            case "inactive": {
                this.log(pretty_inactive)
                break
            }
            default: {
                const table = new CliTable3({
                    head: [chalk.green('Active'), chalk.red('Inactive')]
                })

                table.push([pretty_active, pretty_inactive])

                this.log(table.toString())
                break
            }
        }
    }
}
