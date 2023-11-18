import { Option, program } from "commander";

import { CreateCommand } from "@src/commands/create-command";
import { DownloadCommand } from "@src/commands/download-command";
import { InitCommand } from "@src/commands/init-command";
import { ListCommand } from "@src/commands/list-command";
// note to self: nginx server blocks ~= virtual hosts (it's an apache term, but people use it)

function example(text: string): string {
  return `
Example:
  $ local-domains ${text}`;
}

program
  .name("local-domains")
  .description("Create pseudo domains for easier local development")
  .version("1.0.0");

// TODO(): Implement all these

program
  .command("list")
  .description("List all registered domains")
  .addOption(
    new Option("-s, --status <status>", "Only with the given status")
      .choices(["all", "active", "inactive"])
      .default("All")
  )
  .action(async (args: any) => {
    const list = new ListCommand();
    await list.action(args);
  });

// TODO(): come back later to do this, but this should only add to hosts/nginx if the server is NOT disabled (they didn't say stop, or haven't said start yet)
// TODO(): this doesn't clean up after itself when a failure happens. esp when nginx throws cause it's invalid (no upstream or port is wrong)
program
  .command("create")
  .description("Create a new Domain.")
  .argument("<source>", "The domain to route from.")
  .argument("<destination>", "The local IP:Port to map the source to")
  .addHelpText("after", example("create api.example.com 127.0.0.1:5001"))
  .action(async (source, destination) => {
    const create = new CreateCommand();
    await create.action({ source, destination });
  });

program
  .command("delete")
  .argument("<domain>", "The domain to delete.")
  .addHelpText("after", example("delete api.example.com"))
  .action(async (domain: any) => {
    // TODO
  });
//
// program
//   .command("enable")
//   .description("Enable a domain, without reloading the server")
//   .argument("<domain>", "The domain to enable.")
//   .addHelpText("after", example("enable api.example.com"))
//   .action(async (domain: any) => {
//     console.log(chalk.cyan("Enabling a domain"));
//
//     let s = ora(" Checking if the domain exists").start();
//     const domainEntry = await config.domainByName(domain);
//     if (!domainEntry) {
//       s.fail(" Domain not found");
//       return;
//     }
//     s.succeed(" Domain found");
//
//     s = ora(" Adding to hosts file");
//     const hostEntry = HostEntry.fromDomain(domainEntry);
//     const result = await hosts.add(hostEntry).catch((err) => {
//       s.fail(" Failed to add to hosts file");
//       throw err;
//     });
//
//     if (result) {
//       s.succeed(" Added to hosts file");
//     } else {
//       s.info(" Domain already added to hosts file");
//     }
//
//     s = ora(" Enabling in server files");
//     if (await nginx.exists(domainEntry)) {
//       const result = await nginx.enableDomain(domainEntry).catch((err) => {
//         s.fail(" Failed to enable in server files");
//         throw err;
//       });
//
//       if (result) {
//         s.succeed(" Enabled in server files");
//       } else {
//         s.info(" Domain already enabled in server files");
//       }
//     } else {
//       s.fail(" Domain not found in server files");
//       return;
//     }
//
//     s = ora(" Saving enabled state to config");
//
//     if (domainEntry.status === DomainStatus.INACTIVE) {
//       const otherDomains = without(config.domains, domainEntry);
//       const newDomain = new Domain(
//         domainEntry.source,
//         domainEntry.destination,
//         DomainStatus.ACTIVE
//       );
//       const newDomains = [...otherDomains, newDomain];
//       const newConfig = new Config(newDomains, config.files, config.settings);
//
//       await newConfig.save().catch((err) => {
//         s.fail(" Failed to save the enabled state to the local config");
//         throw err;
//       });
//
//       s.succeed(" Saved state to config");
//     } else {
//       s.info(" Domain already enabled in config");
//     }
//
//     console.log(chalk.cyan("Domain enabled!"));
//   });
//
// program
//   .command("disable")
//   .description("Disable a domain, without reloading the server")
//   .argument("<domain>", "The domain to disable.")
//   .addHelpText("after", example("disable api.example.com"))
//   .action(async (domain: any) => {
//     console.log(chalk.cyan("Disabling a domain"));
//
//     let s = ora(" Checking if the domain exists").start();
//     const domainEntry = await config.domainByName(domain);
//     if (!domainEntry) {
//       s.fail(" Domain not found");
//       return;
//     }
//     s.succeed(" Domain found");
//
//     s = ora(" Removing from hosts file");
//     const hostEntry = HostEntry.fromDomain(domainEntry);
//     if (await hosts.exists(hostEntry)) {
//       await hosts.remove(hostEntry).catch((err) => {
//         s.fail(" Failed to remove from hosts file");
//         throw err;
//       });
//
//       s.succeed(" Removed from hosts file");
//     } else {
//       s.info(" Domain already removed from hosts file");
//     }
//
//     s = ora(" Disabling in server files");
//     if (await nginx.exists(domainEntry)) {
//       const result = await nginx.disableDomain(domainEntry).catch((err) => {
//         s.fail(" Failed to disable in server files");
//         throw err;
//       });
//
//       if (result) {
//         s.succeed(" Disabled in server files");
//       } else {
//         s.info(" Domain already disabled in server files");
//       }
//     } else {
//       s.warn(" Domain not found in server files");
//     }
//
//     s = ora(" Saving disabled state to config");
//
//     if (domainEntry.status === DomainStatus.ACTIVE) {
//       const otherDomains = without(config.domains, domainEntry);
//       const newDomain = new Domain(
//         domainEntry.source,
//         domainEntry.destination,
//         DomainStatus.INACTIVE
//       );
//       const newDomains = [...otherDomains, newDomain];
//       const newConfig = new Config(newDomains, config.files, config.settings);
//
//       await newConfig.save().catch((err) => {
//         s.fail(" Failed to save the disabled state to the local config");
//         throw err;
//       });
//
//       s.succeed(" Saved state to config");
//     } else {
//       s.info(" Domain already disabled in config");
//     }
//
//     console.log(chalk.cyan("Domain disabled!"));
//   });
//
// program
//   .command("refresh")
//   .description("Reload the local config, update the server files, and reload the server")
//   .action(async () => {
//     console.log(chalk.cyan("Refreshing configurations"));
//
//     let s = ora(" Updating the hosts file").start();
//     const hostsResult = await hosts.update().catch((err) => {
//       s.fail("Failed to rectify the hosts file");
//       throw err;
//     });
//
//     if (!hostsResult.added.length && !hostsResult.removed.length)
//       s.info(" Hosts file already up to date");
//     else s.succeed(" Hosts file updated");
//
//     if (hostsResult.added.length) {
//       const added = hostsResult.added.map(
//         (entry) => `${chalk.green("added")} ${chalk.dim(entry.prettyString())}`
//       );
//       console.log(added.join("\n"));
//     }
//
//     if (hostsResult.removed.length) {
//       const removed = hostsResult.removed.map(
//         (entry) => `${chalk.red("removed")} ${chalk.dim(entry.prettyString())}`
//       );
//       console.log(removed.join("\n"));
//     }
//
//     s = ora(" Updating the server files").start();
//     const serverResult = await nginx.update().catch((err) => {
//       s.fail(" Failed to update the server files");
//       throw err;
//     });
//
//     if (!serverResult.added.length && !serverResult.removed.length)
//       s.info(" Server files already up to date");
//     else s.succeed(" Server files updated");
//
//     if (serverResult.added.length) {
//       const added = serverResult.added.map(
//         (entry) => `${chalk.green("added")} ${chalk.dim(entry)}`
//       );
//       console.log(added.join("\n"));
//     }
//
//     if (serverResult.removed.length) {
//       const removed = serverResult.removed.map(
//         (entry) => `${chalk.red("removed")} ${chalk.dim(entry)}`
//       );
//       console.log(removed.join("\n"));
//     }
//
//     s = ora(" Reloading the server").start();
//     await nginx.reload().catch((err) => {
//       s.fail(" Failed to reload the server");
//       throw err;
//     });
//     s.succeed(" Server reloaded");
//
//     console.log(chalk.cyan("Configurations refreshed!"));
//   });

program.command("start"); // add lines to nginx and to host file if not already there
program.command("stop"); // stop everything (remove line from nginx, and *maybe* lines from the host file?)
program.command("kill"); // stop nginx
program
  .command("download")
  .description("Download the server files (nginx), and use them from the local directory.")
  .action(async (args) => {
    const download = new DownloadCommand();
    await download.action(args);
  });

program.command("update"); // idk if we can actually do this- but update the app and nginx?
program.command("pull"); // pulls the existing domains in the (host | nginx | both {argument}) file to update a fresh config
program.command("install"); // same as init
program
  .command("init")
  .description("Create needed directories and configurations.")
  .action(async (args) => {
    const init = new InitCommand();
    await init.action(args);
  });

program.command("uninstall"); // delete directories and remove nginx if *we* downloaded it- else leave it, and basically remove all of our stuff from nginx and host files

program.parse();
