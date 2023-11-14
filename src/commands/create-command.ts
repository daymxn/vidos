import {Command, CommandConfig} from "@src/commands/command";
import _ from "lodash";
import {HostEntry, Config, Domain, saveConfig} from "@src/controllers";
import {AlreadyExistsError} from "@src/util";

export class CreateCommand extends Command {
    constructor(config: CommandConfig) {
        super(config);
    }

    async action(args: any) {
        this.intro("Creating a new domain")

        const { source, destination } = args
        const domain = this.validateDomain(source, destination)

        await this.saveToFiles(domain)

        if(this.config.settings.auto_refresh) await this.refreshServer()

        await this.saveToConfig(domain)

        this.outro("Domain created!")
    }

    validateDomain(source: string, destination: string): Domain {
        this.start("Checking if the domain already exists")

        const domain = new Domain(source, destination)
        if(_.some(this.config.domains, { source })) throw new AlreadyExistsError("Domain already exists")

        this.success("Domain can be created")

        return domain
    }

    async saveToFiles(domain: Domain) {
        this.start("Saving to hosts and server file(s)")

        const addToHosts = this.hosts.add(HostEntry.fromDomain(domain))
        const addToNginx = this.nginx.addDomain(domain)

        await Promise.all([addToHosts, addToNginx])

        this.success("Added to hosts file and server")
    }

    async saveToConfig(domain: Domain) {
        this.start("Saving to config")

        const newConfig = new Config([...this.config.domains, domain], this.config.settings)
        await saveConfig(this.config_path, newConfig)

        this.success("Saved to config")
    }
}
