import {Config, Domain, DomainStatus} from "./config.js";
import {mkdir, readdir, readFile, unlink, writeFile} from "fs/promises";
import {downloadAndUnzip, fileExists, splitArray} from "./util.js";
import {execa} from "execa";

const COMMON_CONFIG = "local-domains-common.conf"

interface ServerChangesMade {
    added: string[],
    removed: string[]
}

class Nginx {
    private readonly nginx_conf: string;
    private readonly nginx: string;
    private readonly domains_folder: string;

    constructor(private readonly config: Config) {
        this.nginx_conf = `${config.settings.nginx}/conf/nginx.conf`
        this.domains_folder = `${config.settings.nginx}/conf/local-domains`
        this.nginx = `${config.settings.nginx}/nginx.exe`
    }

    private domainPath(domain: Domain): string {
        return `${this.domains_folder}/${domain.file_name}`
    }

    // TODO(): when the application runs, if it cant find nginx at the default path, it'll prompt the user with something like
    // "couldn't find nginx here X, would you like me to download it myself?"
    // then call this method if yes else exit
    // TODO(stretch-goal): support linux
    // TODO(stretch-goal): get latest version from repo tags (http://hg.nginx.org/nginx/tags)
    static async download(output_path: string) {
        const url = "https://nginx.org/download/nginx-1.25.3.zip"

        // TODO(): show the progress in the console (prob gonna use clack/prompts- wherever this is called)
        await downloadAndUnzip(url, output_path)
    }

    // TODO(stretch-goal): better error propagation
    async reload() {
        try {
            await execa(this.nginx, ["-s", "reload"], { cwd: this.config.settings.nginx })
        } catch (error: any) {
            console.error("Failed to reload nginx:", error)
            throw error
        }
    }

    async rectifyDomains(): Promise<ServerChangesMade> {
        await this.createCommonDomainConfig()

        const domains = this.config.domains

        const files = await readdir(this.domains_folder)

        const filteredFiles = files.filter(file => file != COMMON_CONFIG)

        const fileNames = domains.map(domain => domain.file_name)

        const [validFiles, invalidFiles] = splitArray(filteredFiles, file => fileNames.includes(file))

        for(const file of invalidFiles) {
            console.log(`Removing invalid domain file: ${file}`)
            await unlink(`${this.domains_folder}/${file}`)
        }

        const missingFiles = domains.map(domain => domain.file_name).filter(file => !validFiles.includes(file))

        const addDomains = domains.map(domain => this.addDomain(domain))

        await Promise.all(addDomains)

        const [activeDomains, inactiveDomains] = splitArray(domains, domain => domain.status == DomainStatus.ACTIVE)

        const activateDomains = activeDomains.map(domain => this.enableDomain(domain))
        const deactivateDomains = inactiveDomains.map(domain => this.disableDomain(domain))

        await Promise.all([...activateDomains, ...deactivateDomains])

        return {
            added: missingFiles,
            removed: invalidFiles
        }
    }

    async addDomain(domain: Domain): Promise<boolean> {
        const path = this.domainPath(domain)

        const alreadyExists = await fileExists(path)
        if(alreadyExists) return false

        await writeFile(path, `server { listen 80; server_name ${domain.source}; location / { proxy_pass http://${domain.destination}; include local-domains/local-domains-common.conf; }}`)

        return true
    }

    async removeDomain(domain: Domain): Promise<boolean> {
        const path = this.domainPath(domain)

        await unlink(path)

        return true
    }

    async disableDomain(domain: Domain): Promise<boolean> {
        const path = this.domainPath(domain)

        const data = await readFile(path, 'utf8')
        await writeFile(path, '#' + data)

        return true
    }

    async enableDomain(domain: Domain): Promise<boolean> {
        const path = this.domainPath(domain)

        const data = await readFile(path, 'utf8')

        if(data.startsWith('#')) {
            await writeFile(path, data.slice(1))
        } else {
            return false
        }

        return true
    }

    async createCommonDomainConfig(): Promise<boolean> {

        await mkdir(this.domains_folder, { recursive: true })

        const common_config_file_path = `${this.domains_folder}/${COMMON_CONFIG}`
        const common = "proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection 'upgrade'; proxy_set_header Host $host; proxy_cache_bypass $http_upgrade;"

        await writeFile(common_config_file_path, common)

        return true
    }

    async includeRoutes(): Promise<boolean> {
        try{
            const includeLine = `include ${this.config.settings.nginx_folder_name}/*.conf;`
            const fileContent = await readFile(this.nginx_conf, 'utf-8')

            if (fileContent.includes(includeLine)) return false
            const regex = new RegExp("^http {", "gm")
            const newLine = `http {\n    ${includeLine}`

            const replacedLines = fileContent.replace(regex, newLine)

            await writeFile(this.nginx_conf, replacedLines)

            return true
        } catch(error: any) {
            console.error("An error occurred while trying to include our nginx routes:", error.message)
            throw error
        }
    }

    async removeRoutes() {
        try{
            const includeLine = `include ${this.config.settings.nginx_folder_name}/*.conf;`
            const fileContent = await readFile(this.nginx_conf, 'utf-8')

            const replacedLines = fileContent.replace(includeLine, "")

            await writeFile(this.nginx_conf, replacedLines)

        } catch(error: any) {
            console.error("An error occurred while trying to remove our nginx routes:", error.message)
        }
    }
}

export { Nginx }
