import {appendFile, readFile, writeFile} from 'fs/promises';
import {arrayContains, Changes, Comparable, hasCommonElements, includesInstance, removePortFromIp} from "./util.js";
import {Config, Domain, DomainStatus} from "./config.js";
import chalk from "chalk";
import _, {map, split} from "lodash";
import {IOError, tryOrThrow} from "./errors.js";

const LOCAL_DOMAINS_COMMENT = "local-domains"
const HOST_ENTRY_REGEX = RegExp("(?<address>^[^#\\s]+) (?<hostname>[^#\\s]+) ?(?<comment>#.+)?")

// TODO: worth separating into its own repo/npm project, with support for blocking websites + host file features
// note that this intentionally does not support multiple names, as to avoid complexity for this project
class HostEntry {
    constructor(
        public ip: string,
        public name: string
    ) {}

    prettyString(): string {
        return `${chalk.green(this.name)} => ${chalk.blue(this.ip)}`
    }

    toString(): string {
        return `\n${this.ip} ${this.name} # ${LOCAL_DOMAINS_COMMENT}`.trim()
    }

    static fromString(str: string): HostEntry | null {
        const match = str.match(HOST_ENTRY_REGEX)

        if(!match || !match.groups) return null

        const { address, hostname, comment = undefined } = match.groups

        if(comment != LOCAL_DOMAINS_COMMENT) return null

        return new HostEntry(address, hostname)
    }

    static fromDomain(domain: Domain): HostEntry {
        return new HostEntry(removePortFromIp(domain.destination), domain.source)
    }
}

class Hosts {
    private readonly path: string;
    constructor(private readonly config: Config) {
        this.path = config.settings.host_file
    }

    async update(): Promise<Changes<HostEntry>> {
        return tryOrThrow(async () => {
            const activeHosts = _.filter(this.config.domains, { status: DomainStatus.ACTIVE })
                .map(domain => HostEntry.fromDomain(domain))

            const hostEntries = await this.readHostsFile()

            const entriesToRemove = hostEntries.filter(host => !arrayContains(activeHosts, host))
            const entriesToAdd = activeHosts.filter(host => !arrayContains(hostEntries, host))

            const lines = _.chain(await this.readFile())
                .filter(line => {
                    const host = HostEntry.fromString(line)
                    return !(host && arrayContains(entriesToRemove, host))
                })
                .concat(entriesToAdd.map(entry => entry.toString()))
                .join('\n')
                .value()

            await writeFile(this.path, lines)

            return {
                added: entriesToAdd,
                removed: entriesToRemove
            }
        },
            new IOError("Failed to update the hosts file")
        )
    }

    async readHostsFile(): Promise<HostEntry[]> {
        const lines = await this.readFile()

        return _.chain(lines)
            .map(HostEntry.fromString)
            .filter((line): line is HostEntry => line !== null)
            .value();
    }

    async exists(host: HostEntry): Promise<boolean> {
        const entries = await this.readHostsFile()

        return arrayContains(entries, host)
    }

    async add(host: HostEntry) {
        return tryOrThrow(async () => {
            const hosts = await this.readHostsFile();

            if (arrayContains(hosts, host)) return false

            await appendFile(this.path, `${host.toString()}\n`)

            return true
        },
            new IOError("Failed to add an entry to the hosts file")
        )
    }

    async remove(host: HostEntry) {
        return tryOrThrow(async () => {
            const lines = _.chain(await this.readFile())
                .filter(line => !_.isEqual(HostEntry.fromString(line), host))
                .join('\n')
                .value()

            await writeFile(this.path, lines)
        },
            new IOError("Failed to remove a host from the hosts file")
        )
    }

    private async readFile(): Promise<string[]> {
        return tryOrThrow(async () => {
                const data = await readFile(this.path, 'utf8')
                return data.split('\n')
            },
            new IOError("Failed to read hosts file")
        )
    }
}

export { Hosts, HostEntry}
