import {appendFile, readFile, writeFile} from 'fs/promises';
import {arrayContains, Changes, removePortFromIp} from "./util.js";
import {Config, Domain, DomainStatus} from "./config.js";
import chalk from "chalk";
import _ from "lodash";
import {IOError, tryOrThrow} from "./errors.js";

const LOCAL_DOMAINS_COMMENT = "local-domains"
const HOST_ENTRY_REGEX = RegExp("(?<address>^[^#\\s]+) (?<hostname>[^#\\s]+) ?(?<comment>#.+)?")

/**
 * Represents an entry in the hosts file.
 *
 * Note that this intentionally does not support multiple names, as to avoid complexity for this project
 */
// TODO: worth separating into its own repo/npm project, with support for blocking websites + host file features
class HostEntry {

    /**
     * Creates a HostEntry instance.
     *
     * @param {string} ip - The address of the host entry.
     * @param {string} name - The hostname of the host entry.
     */
    constructor(
        public ip: string,
        public name: string
    ) {}

    /**
     * Returns a pretty string representation of the host entry.
     *
     * Intended to be used for end-user display purposes.
     *
     * @returns {string} Formatted host entry.
     */
    prettyString(): string {
        return `${chalk.green(this.name)} => ${chalk.blue(this.ip)}`
    }

    /**
     * Converts the host entry to a string in hosts file format.
     *
     * Has the {LOCAL_DOMAINS_COMMENT} appended to it, to distinguish between other entries.
     *
     * @returns {string} Host entry as a string.
     */
    toString(): string {
        return `\n${this.ip} ${this.name} # ${LOCAL_DOMAINS_COMMENT}`.trim()
    }

    /**
     * Creates a HostEntry from a string.
     *
     * If the entry doesn't have our signature comment (meaning we didn't creat it), this method will ignore it.
     *
     * @param {string} str - A line from the hosts file.
     * @returns {HostEntry|null} The HostEntry object or null if the line is invalid (or not one that we created)
     */
    static fromString(str: string): HostEntry | null {
        const match = str.match(HOST_ENTRY_REGEX)

        if(!match || !match.groups) return null

        const { address, hostname, comment = undefined } = match.groups

        if(comment != LOCAL_DOMAINS_COMMENT) return null

        return new HostEntry(address, hostname)
    }

    /**
     * Creates a HostEntry from a Domain object.
     *
     * @param {Domain} domain - The domain object.
     * @returns {HostEntry} The corresponding HostEntry object.
     */
    static fromDomain(domain: Domain): HostEntry {
        return new HostEntry(removePortFromIp(domain.destination), domain.source)
    }
}

/**
 * Provides functionality to manage the hosts file.
 */
class Hosts {
    private readonly path: string;

    /**
     * Constructs a Hosts object with the provided configuration.
     *
     * @param {Config} config - The configuration object including hosts file path.
     */
    constructor(private readonly config: Config) {
        this.path = config.settings.host_file
    }

    /**
     * Updates the hosts file based on active domains in the configuration.
     *
     * @returns {Promise<Changes<HostEntry>>} An object detailing the changes made.
     */
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

    /**
     * Reads the hosts file and returns an array of HostEntry objects.
     *
     * @returns {Promise<HostEntry[]>} An array of HostEntry objects.
     */
    async readHostsFile(): Promise<HostEntry[]> {
        const lines = await this.readFile()

        return _.chain(lines)
            .map(HostEntry.fromString)
            .filter((line): line is HostEntry => line !== null)
            .value();
    }

    /**
     * Checks if a given HostEntry exists in the hosts file.
     *
     * @param {HostEntry} host - The HostEntry to check.
     * @returns {Promise<boolean>} True if the entry exists, false otherwise.
     */
    async exists(host: HostEntry): Promise<boolean> {
        const entries = await this.readHostsFile()

        return arrayContains(entries, host)
    }

    /**
     * Adds a new HostEntry to the hosts file.
     *
     * @param {HostEntry} host - The HostEntry to add.
     * @returns {Promise<boolean>} True if the entry was added, false if it already exists.
     */
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

    /**
     * Removes a HostEntry from the hosts file.
     *
     * @param {HostEntry} host - The HostEntry to remove.
     */
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

    /**
     * Reads the hosts file and returns its contents as an array of strings.
     *
     * @returns {Promise<string[]>} The contents of the hosts file.
     */
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
