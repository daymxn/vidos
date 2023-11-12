import { readFile, writeFile } from 'fs/promises';
import { encodeClassToJSON, fileExists} from "./util.js";
import chalk from "chalk";
import {ApplicationError, IOError, tryOrThrow} from "./errors.js";

enum DomainStatus {
    INACTIVE = 0,
    ACTIVE = 1
}

class Domain {
    public readonly file_name: string;

    constructor(
        public readonly source: string,
        public readonly destination: string,
        public readonly status: DomainStatus = DomainStatus.ACTIVE
    ) {
        const destWithFixedPorts = destination.replace(":", "$")

        this.file_name = `${source}-${destWithFixedPorts}.conf`
    }

    static fromString(str: string): Domain {
        const json = JSON.parse(str)

        return this.fromObject(json)
    }

    static fromObject(obj: { [key: string]: any }): Domain {
        return new Domain(obj.source, obj.destination, obj.status)
    }

    prettyString(): string {
        const str = `${chalk.green(this.source)} => ${chalk.blue(this.destination)}`

        if(this.status == DomainStatus.INACTIVE) return chalk.dim(str)
        return str
    }

    toString(): string {
        return encodeClassToJSON(this, ["file_name"])
    }
}

class Config {
    constructor(
        public domains: Domain[],
        public settings: {
            host_file: string,
            backup_host_file: string,
            nginx: string,
            nginx_folder_name: string,
            backup_nginx_conf: string,
            auto_refresh: boolean
        }
    ) {}

    domainByName(name: string): Domain | undefined {
        return this.domains.find(domain => domain.source === name)
    }

    static fromJSON(str: string): Config {
        const json = JSON.parse(str)

        const domains: Domain[] = json.domains.map((domain: any) => Domain.fromObject(domain))

        return new Config(domains, json.settings)
    }

    toJSONString(): string {
        return encodeClassToJSON(this, ["file_name"])
    }
}

const DEFAULT_CONFIG = new Config([],
    {
        host_file: "C:/Windows/System32/drivers/etc/hosts",
        backup_host_file: "backup_hosts_local-domains",
        nginx: "C:/Users/Daymon/Documents/nginx-1.25.3",
        nginx_folder_name: "local-domains",
        backup_nginx_conf: "backup_nginx_local-domains.conf",
        auto_refresh: true
    }

)
async function loadConfig(filePath: string): Promise<Config> {
    return tryOrThrow(async () => {
        if(await fileExists(filePath)) {
            const data = await readFile(filePath, 'utf8')
            return Config.fromJSON(data)
        } else {
            console.info("Config file not found, creating a default one.")
            return await createConfig(filePath)
        }
    }, new IOError("Failed to load the local config file"))
}

async function createConfig(filePath: string): Promise<Config> {
    return tryOrThrow(async () => {
        await writeFile(filePath, DEFAULT_CONFIG.toJSONString(), 'utf8')
        return DEFAULT_CONFIG
    },
        new IOError("Failed to create a local config file")
    )
}

async function saveConfig(filePath: string, config: Config): Promise<void> {
    return tryOrThrow(
        writeFile(filePath, config.toJSONString(), 'utf8'),
        new IOError("Failed to save config")
    )
}

export { loadConfig, createConfig, saveConfig, Config, Domain, DomainStatus }
