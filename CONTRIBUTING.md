# Contributing to oss-mcp-outlook

Thanks for your interest in contributing!

## How to Contribute

### Reporting Bugs
1. Open an [issue](https://github.com/omnitrex-oss/oss-mcp-outlook/issues)
2. Include: steps to reproduce, expected vs actual behavior, Node.js version, OS

### Suggesting Features
1. Open an issue with the `enhancement` label
2. Describe the use case and proposed solution

### Submitting Code
1. Fork this repository
2. Create a feature branch from `master`
3. Make your changes
4. Run tests: `npm test`
5. Run linting: `npm run lint`
6. Submit a Pull Request to `master`

### PR Requirements
- All tests must pass
- Code must pass linting
- One approval required from a maintainer
- Keep PRs focused — one feature/fix per PR

## Development Setup

```bash
git clone https://github.com/omnitrex-oss/oss-mcp-outlook.git
cd oss-mcp-outlook
npm install
npm run build
npm test
```

## Architecture

```
config.ts → auth/msal.ts → graph/client.ts → safety/ → tools/ → server.ts → index.ts
```

- Each tool lives in its own file under `src/tools/`
- All tools use Zod schemas for input validation
- Write operations are audited via `safety/audit.ts`

## Code Style
- TypeScript ESM (no CommonJS)
- Zod for all input validation
- Vitest for tests

## License
By contributing, you agree that your contributions will be licensed under the MIT license.
