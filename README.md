# local-domains

Create and manage virtual domains for easier local development

`local-domains` is taken on NPM. So I might name this `virtual-domains` instead. We'll see. Could always do
like domain-cli or some variant of cli.

# Note
Linux/MacOS support is a WIP. If you have an existing instance running of nginx, and it's not a local copy,
the behavior is undefined in how `local-domains` navigates the restarting, starting, and stopping the
server.

Furthermore, testing needs to be done on linux/macos to ensure basic functionality works (although it should).

# TODOS:
- Actually implement backup support

# Future Improvements

- CI Testing
- Complete Linux/MacOS Support

# Environment Variables

List the ENV variables provided; for debugging or otherwise.
