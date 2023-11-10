import { readFile, writeFile } from 'fs/promises';
import {areEqual, Comparable, encodeClassToJSON, fileExists} from "./util.js";
import chalk from "chalk";

enum DomainStatus {
    INACTIVE,
    ACTIVE
}

function prettyDomainStatus(status: DomainStatus): string {
    switch (status) {
        case DomainStatus.ACTIVE: return chalk.green("Active")
        case DomainStatus.INACTIVE: return chalk.red("Inactive")
    }
}

class Domain {
    public readonly file_name: string;

    constructor(
        public readonly source: string,
        public readonly destination: string,
        public readonly status: DomainStatus
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

    static fromString(str: string): Config {
        const json = JSON.parse(str)

        const domains: Domain[] = json.domains.map((domain: any) => Domain.fromObject(domain))

        return new Config(domains, json.settings)
    }

    toString(): string {
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
    try {
        const exists = await fileExists(filePath)
        if(!exists) {
            console.info("Config file not found, creating a default one...")
            return await createConfig(filePath)
        }

        const data = await readFile(filePath, 'utf8')

        return Config.fromString(data)
    } catch(error) {
        console.error("Failed to read config file:", error)
        throw error
    }
}

async function createConfig(filePath: string): Promise<Config> {
    try {
        await writeFile(filePath, DEFAULT_CONFIG.toString(), 'utf8');
        return DEFAULT_CONFIG
    } catch (error) {
        console.error('Failed to create config file:', error);
        throw error
    }
}

async function saveConfig(filePath: string, config: Config): Promise<void> {
    try {
        await writeFile(filePath, config.toString(), 'utf8');
    } catch (error) {
        console.error('Failed to save config file:', error);
    }
}

export { loadConfig, createConfig, saveConfig, Config, Domain, DomainStatus }
