# Contributing to mcp-ms365-mail

Thanks for your interest in contributing! This MCP server is maintained by [@dieudonne84](https://github.com/dieudonne84) as part of Omnitrex Labs.

## How to Contribute

### Reporting Bugs

1. Open an [issue](https://github.com/omnitrex-labs/mcp-ms365-mail/issues)
2. Include: steps to reproduce, expected behavior, actual behavior
3. Include your Node.js version and OS

### Suggesting Features

1. Open an issue with the `enhancement` label
2. Describe the use case and proposed solution

### Submitting Code

1. **Fork** this repository
2. Create a feature branch from `main`
3. Make your changes
4. Run tests: `npm test`
5. Run linting: `npm run lint`
6. Submit a **Pull Request** to `main`

### PR Requirements

- All tests must pass (CI runs automatically)
- Code must pass linting
- One approval required from a maintainer
- PRs should be focused — one feature/fix per PR
- Include a clear description of what changed and why

## Development Setup

```bash
git clone https://github.com/omnitrex-labs/mcp-ms365-mail.git
cd mcp-ms365-mail
npm install
npm run build
npm test
```

## Architecture

```
config.ts → client/api.ts → safety/ → tools/ → server.ts → index.ts
```

- Each tool is in its own file under `src/tools/`
- Write operations must use the WriteGuard (rate limit + audit)
- All tools must have Zod schemas for input validation

## Code Style

- TypeScript ESM (no CommonJS)
- Zod for all input validation
- Vitest for tests
- No permanent delete operations

## License

By contributing, you agree that your contributions will be licensed under the BSL-1.1 license.
