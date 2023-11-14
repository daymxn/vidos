import {Config, Hosts, Nginx} from "@src/controllers";
import ora, {Ora} from "ora";
import chalk from "chalk";
import {DISABLE_LOGGING} from "@src/util";

export interface CommandConfig {
    config: Config,
    hosts: Hosts,
    nginx: Nginx,
    root: string
}

// TODO: wrap the action in a try catch that calls spinner.fail with err message if spinner active- else just logs it and exits with error code (1 or 0?)
export abstract class Command {
    protected readonly config: Config;
    protected readonly hosts: Hosts;
    protected readonly nginx: Nginx;
    protected readonly root: string;

    protected readonly config_path: string;

    private spinner: Ora = ora();

    protected constructor(
        config: CommandConfig
    ) {
        this.config = config.config
        this.hosts = config.hosts
        this.nginx = config.nginx
        this.root = config.root

        this.config_path = `${this.root}/config.json`
    }

    async refreshServer() {
        this.start("Refreshing server")
        await this.nginx.reload().catch(err => {
            this.fail("Failed to refresh the server")
            throw err
        })
        this.success("Server refreshed")
    }

    start(message: string) {
        if(DISABLE_LOGGING) return

        this.spinner = ora(message).start()
    }

    success(message: string) {
        if(DISABLE_LOGGING) return

        this.spinner.succeed(message)
    }

    fail(message: string) {
        if(DISABLE_LOGGING) return

        this.spinner.fail(message)
    }

    intro(message: string) {
        if(DISABLE_LOGGING) return

        console.log(chalk.cyan(message))
    }

    outro(message: string) {
        if(DISABLE_LOGGING) return

        console.log(chalk.cyan(message))
    }

    log(message: string) {
        if(DISABLE_LOGGING) return

        console.log(message)
    }


    abstract action(...args: any[]): Promise<void> | void
}
