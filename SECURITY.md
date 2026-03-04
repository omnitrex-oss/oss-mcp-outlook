# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT** open a public GitHub issue
2. Use [GitHub's private vulnerability reporting](https://github.com/omnitrex-oss/oss-mcp-outlook/security/advisories/new)
3. Include: description, steps to reproduce, potential impact

We will acknowledge receipt within 48 hours and provide a fix timeline.

## Security Practices

- Tokens stored in OS keychain (keytar) with file fallback (0o600 permissions)
- No secrets hardcoded in source code
- All credentials via environment variables
- Audit logging on write operations (no body content logged)
- Draft-before-send pattern for email (requires explicit confirmation)
