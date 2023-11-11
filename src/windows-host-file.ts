import {appendFile, readFile, writeFile} from 'fs/promises';
import {
    arrayContains,
    Comparable,
    findIndexOrNull,
    hasCommonElements,
    includesInstance,
    removePortFromIp,
    splitArray
} from "./util.js";
import {Config, Domain, DomainStatus} from "./config.js";
import chalk from "chalk";
import _ from "lodash";

const COMMENT = "local-domains"

class HostEntry implements Comparable {
    constructor(
        public ip: string,
        // TODO: remove names support; just support a single name
        public names: string[]
    ) {}

    prettyString(): string {
        const mapped = this.names.map(name =>
            `${chalk.green(name)} => ${chalk.blue(this.ip)}`
        )

        return mapped.join('\n')
    }

    toString(): string {
        return `\n${this.ip} ${this.names.join(" ")} # ${COMMENT}`.trim()
    }

    // TODO: could prob do _.equals or whatever
    equals(other: HostEntry): boolean {
        // I like to live dangerously
        return this.toString() === other.toString()
    }

    static fromString(str: string): HostEntry | null {
        const trimmed = str.trim()

        if(trimmed.startsWith("#")) return null

        const parts = trimmed.split(/\s+/);
        if (parts.length < 2) return null

        const ip = parts[0];
        const commentIndex = findIndexOrNull(parts, ((char) => char === '#'))
        const names = parts.slice(1, commentIndex);
        const comment = (commentIndex) ? parts.slice(commentIndex+1).join(" ") : undefined

        if(comment != COMMENT) return null

        return new HostEntry(ip, names)
    }

    static fromDomain(domain: Domain): HostEntry {
        return new HostEntry(removePortFromIp(domain.destination), [domain.source])
    }
}

interface ChangesMade {
    removed: HostEntry[],
    added: HostEntry[]
}

class WindowsHostsFile {
    private readonly path: string;
    constructor(private readonly config: Config) {
        this.path = config.settings.host_file
    }

    /**
     * Assumes our domains have ${COMMENT} on them
     */
    async rectifyHosts(): Promise<ChangesMade> {
        const [activeDomains, inactiveDomains] = splitArray(this.config.domains, domain => domain.status == DomainStatus.ACTIVE)

        const activeHosts = activeDomains.map(domain => HostEntry.fromDomain(domain))
        const hostEntries = await this.readHostsFile()

        const entriesToRemove = hostEntries.filter(host => !includesInstance(activeHosts, host))
        const entriesToAdd = activeHosts.filter(host => !includesInstance(hostEntries, host))

        try {
            const data = await readFile(this.path, 'utf8');
            const lines = data.split('\n');

            const mappedLines = lines.map(line => {
                const host = HostEntry.fromString(line)
                if(host == null || !includesInstance(entriesToRemove, host)) return line

                return null
            })

            const filteredLines = mappedLines.filter((line): line is string => line !== null)
            const newData = filteredLines.join('\n')

            const readyData = (entriesToAdd.length) ? newData.trimEnd() + "\n\n" + entriesToAdd.join("\n") : newData

            await writeFile(this.path, readyData)

            return {
                added: entriesToAdd,
                removed: entriesToRemove
            };
        } catch (error: any) {
            throw new Error('Failed to rectify host mapping: ' + error.message);
        }
    }

    async readHostsFile(): Promise<HostEntry[]> {
        try {
            const data = await readFile(this.path, 'utf8');
            const lines = data.split('\n');

            const maybeMappings = lines.map(line => HostEntry.fromString(line))

            return maybeMappings.filter((line): line is HostEntry => line !== null)
        } catch (error: any) {
            throw new Error('Failed to read hosts file: ' + error.message);
        }
    }

    async exists(host: HostEntry): Promise<boolean> {
        const entries = await this.readHostsFile()

        return arrayContains(entries, host)
    }

    async addHostMapping(host: HostEntry) {
        try {
            const currentMappings = await this.readHostsFile();
            // TODO() - could prob change this now
            const mappingExists = currentMappings.some((mapping) =>
                host.ip == mapping.ip && hasCommonElements(host.names, mapping.names)
            );

            if(mappingExists) return false;

            await appendFile(this.path, `${host.toString()}\n`)

            return true
        } catch (error: any) {
            throw new Error('Failed to add host mapping: ' + error.message);
        }
    }

    async removeHostMapping(host: HostEntry) {
        try {
            const data = await readFile(this.path, 'utf8');
            const lines = data.split('\n');

            const mappedLines = lines.map(line => {
                const mapping = HostEntry.fromString(line)
                if(mapping == null || mapping.ip !== host.ip) return line
                const filteredNames = mapping.names.filter(name => !host.names.includes(name))

                if(!filteredNames.length) return null
                const newHost = new HostEntry(host.ip, filteredNames)
                return newHost.toString()
            })


            const filteredLines = mappedLines.filter((line): line is string => line !== null)
            const newData = filteredLines.join('\n')

            await writeFile(this.path, newData)

            return true;
        } catch (error: any) {
            throw new Error('Failed to remove host mapping: ' + error.message);
        }
    }
}

export { WindowsHostsFile, HostEntry, COMMENT}
