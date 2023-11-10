import {Option, program} from "commander";
import {HostEntry, WindowsHostsFile} from "./src/windows-host-file.js";
import {Config, Domain, DomainStatus, loadConfig, saveConfig} from "./src/config.js";
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import {Nginx} from "./src/nginx.js";
import {removePortFromIp} from "./src/util.js";
import chalk from "chalk";
import ora from "ora";
import CliTable3 from "cli-table3";
// note to self: nginx server blocks ~= virtual hosts (it's an apache term, but people use it)

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const configPath = join(__dirname, "config.json")

const config = await loadConfig(configPath)

const hosts = new WindowsHostsFile(config)
const nginx = new Nginx(config)

function example(text: string): string {
    return `
Example:
  $ local-domains ${text}`
}

program
    .name("local-domains")
    .description("Create pseudo domains for easier local development")
    .version("1.0.0")

// TODO(): Implement all these

function printTwoColumns(list1: string[], list2: string[], columnWidth = 60) {
    const maxLength = Math.max(list1.length, list2.length);

    for (let i = 0; i < maxLength; i++) {
        const col1 = list1[i] || '';
        const col2 = list2[i] || '';

        // Pad the first column to the desired width
        const paddedCol1 = col1.padEnd(columnWidth, ' ');

        console.log(paddedCol1 + col2);
    }
}

program.command("list")
    .description("List all registered domains")
    .addOption(
        new Option(
            '-s, --status <status>',
            'Only with the given status'
        ).choices(["all", "active", "inactive"])
        .default("All")
    )
    .action((options) => {
        const status = options.status
        const domains = config.domains

        const active_domains = domains.filter(domain => domain.status == DomainStatus.ACTIVE)
        const inactive_domains = domains.filter(domain => domain.status == DomainStatus.INACTIVE)

        const pretty_active = active_domains.map(domain => domain.prettyString()).join("\n")
        const pretty_inactive = inactive_domains.map(domain => domain.prettyString()).join("\n")

        switch (status) {
            case "active": {
                console.log(pretty_active)
                break;
            }
            case "inactive": {
                console.log(pretty_inactive)
                break;
            }
            default: {
                const table = new CliTable3({
                    head: [chalk.green('Active'), 'Inactive']
                })

                table.push([pretty_active, pretty_inactive])

                console.log(table.toString())
                break;
            }
        }
    })

// TODO(): come back later to do this, but this should only add to hosts/nginx if the server is NOT disabled (they didn't say stop, or haven't said start yet)
program.command("create")
    .description("Create a new Domain.")
    .argument('<source>', "The domain to route from.")
    .argument("<destination>", "The local IP:Port to map the source to")
    .addHelpText('after', example("create api.example.com 127.0.0.1:5001"))
    .action(async (source, destination) => {
        console.log(chalk.cyan("Creating a new domain"))

        let s = ora('Checking if the domain already exists').start();

        const newDomain = new Domain(source, destination, DomainStatus.ACTIVE)
        if(config.domains.some(domain => domain.source == source)) {
            s.fail("Domain already exists")
            return
        }

        s.succeed("Domain can be created")

        s = ora("Adding to hosts file and server").start()

        const ip = removePortFromIp(destination)
        const addToHosts = hosts.addHostMapping(new HostEntry(ip, [source]))
        const addToNginx = nginx.addDomain(newDomain)

        await Promise.all([addToHosts, addToNginx]).catch(err => {
            s.fail("Failed to add the domain to the hosts file and server")
            throw err
        })
        s.succeed("Added to hosts file and server")

        s = ora("Saving to config").start()

        const newDomains = [...config.domains, newDomain]
        const newConfig = new Config(newDomains, config.settings)
        await saveConfig(configPath, newConfig).catch(err => {
            s.fail("Failed to save the config")
            throw err
        })

        s.succeed("Saved to config")

        if(config.settings.auto_refresh) {
            s = ora("Refreshing server").start()
            await nginx.reload().catch(err => {
                s.fail("Failed to refresh the server")
                throw err
            })
            s.succeed("Server refreshed")
        }

        console.log(chalk.cyan("Domain created!"))
    })

program.command("delete") // delete a domain
program.command("enable") // enable a domain
program.command("disable") // disable a domain
program.command("refresh") // reload host file and nginx (reload config + rectify)
program.command("start") // add lines to nginx and to host file if not already there
program.command("stop") // stop everything (remove line from nginx, and *maybe* lines from the host file?)
program.command("kill") // stop nginx
program.command("download") // manually download nginx
program.command("update") // idk if we can actually do this- but update the app and nginx?

program.command("install") // same as init
program.command("init") // create initial directories, and download nginx if not in config already
program.command("uninstall") // delete directories and remove nginx if *we* downloaded it- else leave it, and basically remove all of our stuff from nginx and host files

program.parse()
// const __filename = fileURLToPath(import.meta.url)
// const __dirname = dirname(__filename)
// const configPath = join(__dirname, "config.json")
// const config = await loadConfig(configPath)
// const hosts = new WindowsHostsFile(config)
//
//
// // await addLineToNginxConf(`${config.settings.nginx}/conf/nginx.conf`, "include server/*.conf;")
// //await hosts.addHostMapping(new HostEntry("127.0.0.1", ["medias.example.com"]))
// // await hosts.removeHostMapping(new HostEntry("127.0.0.1", ["medias.example.com"]))
// //const mappings = await hosts.readHostsFile()
// //console.log(mappings)
//
// await Nginx.download(join(__dirname, "nginx")) // works:)
//
// // const nginx = new Nginx(config)
// //
// // //await nginx.includeRoutes()
// // await nginx.rectifyDomains()
// // await hosts.rectifyHosts()
// // await nginx.reload()
