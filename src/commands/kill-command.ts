import { Command } from "@src/commands/command";

import { Nginx } from "@src/controllers";

export class KillCommand extends Command {
  constructor() {
    super();
  }

  async action() {
    this.intro("Killing active servers");

    if (await Nginx.kill()) {
      this.success("Active servers killed!");
    } else {
      this.fail("No active servers found");
    }
  }
}
