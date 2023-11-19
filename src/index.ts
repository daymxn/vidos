import { Option, program } from "commander";

import { CreateCommand } from "@src/commands/create-command";
import { DisableCommand } from "@src/commands/disable-command";
import { DownloadCommand } from "@src/commands/download-command";
import { EnableCommand } from "@src/commands/enable-command";
import { InitCommand } from "@src/commands/init-command";
import { ListCommand } from "@src/commands/list-command";
import { RefreshCommand } from "@src/commands/refresh-command";
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
  .action(async (args) => await new ListCommand().tryAction(args));

// TODO(): come back later to do this, but this should only add to hosts/nginx if the server is NOT disabled (they didn't say stop, or haven't said start yet)
// TODO(): this doesn't clean up after itself when a failure happens. esp when nginx throws cause it's invalid (no upstream or port is wrong)
program
  .command("create")
  .description("Create a new Domain.")
  .argument("<source>", "The domain to route from.")
  .argument("<destination>", "The local IP:Port to map the source to")
  .addHelpText("after", example("create api.example.com 127.0.0.1:5001"))
  .action(
    async (source, destination) => await new CreateCommand().tryAction({ source, destination })
  );

program
  .command("delete")
  .argument("<domain>", "The domain to delete.")
  .addHelpText("after", example("delete api.example.com"))
  .action(async (domain: any) => {
    // TODO
  });

program
  .command("enable")
  .description("Enable a domain.")
  .argument("<domain>", "The domain to enable.")
  .addHelpText("after", example("enable api.example.com"))
  .action(async (domain) => await new EnableCommand().tryAction({ domain }));

program
  .command("disable")
  .description("Disable a domain.")
  .argument("<domain>", "The domain to disable.")
  .addHelpText("after", example("disable api.example.com"))
  .action(async (domain) => await new DisableCommand().tryAction({ domain }));

program
  .command("refresh")
  .description("Reload the local config, update the server files, and reload the server")
  .action(async () => await new RefreshCommand().tryAction());

program.command("start"); // add lines to nginx and to host file if not already there
program.command("stop"); // stop everything (remove line from nginx, and *maybe* lines from the host file?)
program.command("kill"); // stop nginx
program
  .command("download")
  .description("Download the server files (nginx), and use them from the local directory.")
  .action(async () => await new DownloadCommand().tryAction());

program.command("update"); // idk if we can actually do this- but update the app and nginx?
program.command("pull"); // pulls the existing domains in the (host | nginx | both {argument}) file to update a fresh config
program.command("install"); // same as init
program
  .command("init")
  .description("Create needed directories and configurations.")
  .action(async () => await new InitCommand().tryAction());

program.command("uninstall"); // delete directories and remove nginx if *we* downloaded it- else leave it, and basically remove all of our stuff from nginx and host files

program.parse();
