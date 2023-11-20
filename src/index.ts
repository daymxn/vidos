import { Option, program } from "commander";

import { CreateCommand } from "@src/commands/create-command";
import { DeleteCommand } from "@src/commands/delete-command";
import { DisableCommand } from "@src/commands/disable-command";
import { DownloadCommand } from "@src/commands/download-command";
import { EnableCommand } from "@src/commands/enable-command";
import { InitCommand } from "@src/commands/init-command";
import { KillCommand } from "@src/commands/kill-command";
import { ListCommand } from "@src/commands/list-command";
import { RefreshCommand } from "@src/commands/refresh-command";
import { StartCommand } from "@src/commands/start-command";
import { StopCommand } from "@src/commands/stop-command";
import { UninstallCommand } from "@src/commands/uninstall-command";
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

program
  .command("create")
  .aliases(["add", "new"])
  .description("Create a new Domain.")
  .argument("<source>", "The domain to route from.")
  .argument("<destination>", "The local IP:Port to map the source to")
  .addHelpText("after", example("create api.example.com 127.0.0.1:5001"))
  .action(
    async (source, destination) => await new CreateCommand().tryAction({ source, destination })
  );

program
  .command("delete")
  .aliases(["del", "remove"])
  .description("Delete a Domain.")
  .argument("<domain>", "The domain to delete.")
  .addHelpText("after", example("delete api.example.com"))
  .action(async (domain) => await new DeleteCommand().tryAction({ source: domain }));

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

program
  .command("start")
  .description("Start the server and link with configuration files.")
  .action(async () => await new StartCommand().tryAction());

program
  .command("stop")
  .description("Stop the server and unlink with configuration files.")
  .action(async () => await new StopCommand().tryAction());

program
  .command("kill")
  .description(
    "Destroy any lingering instances of the server. Useful if something happens and a service leaks."
  )
  .action(async () => await new KillCommand().tryAction());
program
  .command("download")
  .description("Download the server files (nginx), and use them from the local directory.")
  .action(async () => await new DownloadCommand().tryAction());

// program.command("update"); // idk if we can actually do this- but update the app and nginx?
program
  .command("init")
  .alias("install")
  .description("Create needed directories and configurations.")
  .action(async () => await new InitCommand().tryAction());

program
  .command("uninstall")
  .description("Remove all files added and modified by local-domains.")
  .action(async () => await new UninstallCommand().tryAction());

program.parse();
