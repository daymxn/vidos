import {Config, Domain, DomainStatus, FileSystem} from "@src/controllers";
import {
    Changes,
    downloadAndUnzip,
    IOError,
    tryOrThrow,
    COMMON_CONFIG,
    COMMON_CONFIG_FILE,
    commentedOut,
    commentOut,
    removeFirst,
    NetworkError
} from "@src/util";
import {execa} from "execa";
import _ from "lodash";
import dedent from 'dedent'
import { every, padCharsStart, map } from "lodash/fp"
import axios from "axios";
import {load} from "cheerio";
import * as os from "os";

class Nginx {
    private readonly nginx_conf: string;
    private readonly nginx: string;
    private readonly domains_folder: string;
    private readonly include_symbol: string;

    constructor(private readonly config: Config, private readonly files: FileSystem) {
        this.nginx_conf = `${config.settings.nginx}/conf/nginx.conf`
        this.domains_folder = `${config.settings.nginx}/conf/local-domains`
        this.nginx = `${config.settings.nginx}/nginx.exe`

        this.include_symbol = `include ${config.settings.nginx_folder_name}/*.conf;`
    }

    // TODO(): when the application runs, if it cant find nginx at the default path, it'll prompt the user with something like
    // "couldn't find nginx here X, would you like me to download it myself?"
    // TODO(): thinking about this ^ happy path. esp since we have init... idk what I wanna do
    // If there's no config present- or the path is empty, ask them to `init` or `download` (empty = `download`, not present = `init`)
    // And wrap all the commands that require it in it (pretty much all besides download and init respectively. list maybe too. idk if theres any other non nginx commands)
    // then call this method if yes else exit
    // init should try to find an existing nginx (maybe by trying to use it on the path with whereis or whatever), and asking if we should use it
    static async download(output_path: string) {
        const suffix = os.type() == 'Windows_NT' ? '.zip' : '.tar.gz'
        const base_url = "https://nginx.org/download/nginx-"

        const latestVersion = await this.getLatestReleasedVersion()

        const url = `${base_url}${latestVersion}${suffix}`

        await downloadAndUnzip(url, output_path)
    }

    private static async getLatestReleasedVersion(): Promise<string> {
        return tryOrThrow(async () => {
            const response = await axios.get("https://hg.nginx.org/nginx/tags")
            const $ = load(response.data)
            const link = $('a.tagEntry')[1]

            return _.trimStart($(link).text().trim(), "release-")
        }, new NetworkError("Failed to fetch the latest released version of nginx"))
    }

    async reload() {
        await tryOrThrow(
            execa(this.nginx, ["-s", "reload"], { cwd: this.config.settings.nginx }),
            new IOError("Failed to reload the server")
        )
    }

    async update(): Promise<Changes<string>> {
        return tryOrThrow(async () => {
            await this.createCommonDomainConfig()
            await this.addAllDomains()

            const files = await this.files.listFiles(this.domains_folder, [COMMON_CONFIG_FILE])
            const domains = _.map(this.config.domains, 'file_name')

            const [valid_files, invalid_files] = _.partition(files, file => domains.includes(file))
            const missing_files = _.difference(domains, valid_files)

            await Promise.all([
                ...this.updateDomainStatuses(),
                ...this.removeInvalidFiles(invalid_files)
            ])

            return {
                added: missing_files,
                removed: invalid_files
            }
        }, new IOError("Failed to update the server files"))
    }

    async addDomain(domain: Domain): Promise<boolean> {
        return tryOrThrow(async () => {
            const path = this.domainPath(domain)

            if(await this.exists(domain)) return false

            await this.files.write(path, this.domainServerFileContent(domain))

            return true
        }, new IOError("Failed to create a server file for a domain"))
    }

    async removeDomain(domain: Domain): Promise<boolean> {
        return tryOrThrow(async () => {
            const path = this.domainPath(domain)

            if(!await this.exists(domain)) return false

            await this.files.delete(path)

            return true
        }, new IOError("Failed to delete the server file for a domain"))
    }

    async exists(domain: Domain): Promise<boolean> {
        return tryOrThrow(async () => {
            const path = this.domainPath(domain)

            return this.files.exists(path)
        }, new IOError("Failed to validate the existence of a server file"))
    }

    async disableDomain(domain: Domain): Promise<boolean> {
        return tryOrThrow(async () => {
            const file = this.domainPath(domain)
            const file_data = await this.files.readLines(file)

            if(every(commentedOut)(file_data)) return false

            const new_lines = map(commentOut)(file_data)

            await this.files.writeLines(file, new_lines)

            return true
        }, new IOError("Failed to edit a server file to disable a domain"))
    }

    async enableDomain(domain: Domain): Promise<boolean> {
        return tryOrThrow(async () => {
            const file = this.domainPath(domain)
            const file_data = await this.files.readLines(file)

            if(!every(commentedOut)(file_data)) return false

            const new_lines = map(removeFirst)(file_data)

            await this.files.writeLines(file, new_lines)

            return true
        }, new IOError("Failed to edit a server file to enable a domain"))
    }

    async createCommonDomainConfig(): Promise<boolean> {
        return tryOrThrow(async ()=> {
            const common_config_file = `${this.domains_folder}/${COMMON_CONFIG_FILE}`

            if(await this.files.exists(common_config_file)) return false

            await this.files.write(common_config_file, COMMON_CONFIG)

            return true
        }, new IOError("Failed to write to the (common) server config"))
    }

    async includeRoutes(): Promise<boolean> {
        return tryOrThrow(async () => {
            const file_content = await this.files.readData(this.nginx_conf)

            if(_.includes(file_content, this.include_symbol)) return false

            const regex = new RegExp("^http {", "gm")
            const new_line = `$1\n${padCharsStart(this.include_symbol, 4)}`

            // TODO: should test if remove works
            const updated_lines = _.replace(file_content, regex, new_line)

            await this.files.write(this.nginx_conf, updated_lines)

            return true
        }, new IOError("Failed to update the main server config file"))
    }

    async removeRoutes(): Promise<boolean> {
        return tryOrThrow(async () => {
            const file_content = await this.files.readData(this.nginx_conf)

            if(!_.includes(file_content, this.include_symbol)) return false

            const updated_lines = _.replace(file_content, this.include_symbol, "")

            await this.files.write(this.nginx_conf, updated_lines)

            return true
        }, new IOError("Failed to remove the includes symbol from the main server config file"))
    }

    private domainPath(domain: Domain): string {
        return `${this.domains_folder}/${domain.file_name}`
    }

    private domainServerFileContent(domain: Domain): string {
        return dedent`server {
          listen 80;
          server_name ${domain.source};
          location / {
            proxy_pass http://${domain.destination};
            include local-domains/local-domains-common.conf;
          }
        }
        `
    }

    private removeInvalidFiles(invalid_files: string[]): Promise<void>[] {
        return _.map(invalid_files, file => this.files.delete(`${this.domains_folder}/${file}`))
    }

    private addAllDomains(): Promise<boolean[]> {
        return Promise.all(_.map(this.config.domains, domain => this.addDomain(domain)))
    }

    private updateDomainStatuses(): Promise<boolean>[] {
        const [active, inactive] = _.partition(this.config.domains, { status: DomainStatus.ACTIVE })

        return _.concat(
            _.map(active, domain => this.enableDomain(domain)),
            _.map(inactive, domain => this.disableDomain(domain))
        )
    }
}

export { Nginx }
