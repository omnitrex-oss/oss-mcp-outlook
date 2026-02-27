# @omnitrex/mcp-ms365-mail

MCP server for Microsoft 365 Mail — draft, send, and manage Outlook email directly from Claude Code.

## Features

- **10 mail tools**: list, read, search, draft, update, send, reply, forward, attach, list attachments
- **Draft-before-send**: every send creates a draft first, requires explicit confirmation
- **External recipient warnings**: alerts when sending outside configured internal domains
- **Audit log**: structured JSON lines at `~/.mcp-outlook/audit/` (never logs email body content)
- **Token security**: OS keychain (keytar) with encrypted file fallback
- **Large attachment support**: auto-switches to upload session for files 3-150MB

## Prerequisites

- **Node.js** 20 or later
- **Microsoft 365 account** with a mailbox (web-only access is fine — no desktop apps needed)
- **Azure AD app registration** (free, one-time setup — see below)

## Azure App Registration (step-by-step)

You need to register an app in Azure so the MCP server can access your mailbox via the Graph API. This is a one-time setup that takes ~5 minutes.

### Step 1: Create the app

1. Go to [entra.microsoft.com](https://entra.microsoft.com)
2. In the left sidebar, expand **Applications** → click **App registrations**
3. Click **+ New registration** at the top
4. Fill in:
   - **Name**: `MCP Outlook` (or whatever you like — this is just a label)
   - **Supported account types**: select **Accounts in any organizational directory (Any Microsoft Entra ID tenant - Multitenant) and personal Microsoft accounts**
   - **Redirect URI**: leave completely blank — device code flow doesn't use a redirect
5. Click **Register**

### Step 2: Note your IDs

On the app's **Overview** page (shown immediately after registration), copy these two values — you'll need them later:

- **Application (client) ID** — a UUID like `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- **Directory (tenant) ID** — another UUID on the same page

### Step 3: Add API permissions

1. In the left sidebar of your app, click **API permissions**
2. You should see `User.Read` already listed. If not, add it:
   - Click **+ Add a permission**
   - Click **Microsoft Graph**
   - Click **Delegated permissions** (not Application permissions — this server acts as you, not as a background service)
   - Search for `User.Read`, check it, click **Add permissions**
3. Add mail permissions the same way:
   - Click **+ Add a permission** → **Microsoft Graph** → **Delegated permissions**
   - Search for `Mail.ReadWrite`, check it, click **Add permissions**
   - Click **+ Add a permission** → **Microsoft Graph** → **Delegated permissions**
   - Search for `Mail.Send`, check it, click **Add permissions**
4. You should now see 3 permissions listed:
   - `Mail.ReadWrite` — Delegated
   - `Mail.Send` — Delegated
   - `User.Read` — Delegated
5. **Admin consent** (if applicable): if your tenant requires admin consent and you're the admin, click **Grant admin consent for [your org]**. If you're using a personal account or are the sole admin, this is usually automatic.

### Step 4: Enable public client flows

This is the step most people miss — without it, device code auth will fail.

1. In the left sidebar of your app, click **Authentication**
2. Scroll down to **Advanced settings**
3. Find **Allow public client flows** and set the toggle to **Yes**
4. Click **Save** at the top

### Step 5: Verify

Your app should now have:
- 3 delegated permissions (Mail.ReadWrite, Mail.Send, User.Read)
- Public client flows enabled
- No redirect URIs (none needed)
- No client secret (none needed — we use device code flow, not client credentials)

## Setup

### 1. Build from source

```bash
git clone <repo-url> && cd mcp-outlook
npm install
npm run build
```

### 2. Add to Claude Code

Replace `<your-client-id>` and `<your-tenant-id>` with the values from Step 2 above.

```bash
claude mcp add --transport stdio \
  --env MS365_CLIENT_ID=<your-client-id> \
  --env MS365_TENANT_ID=<your-tenant-id> \
  mcp-ms365-mail -- node /path/to/mcp-outlook/dist/index.js
```

Optionally configure internal domain warnings (e.g., to flag emails leaving your org):

```bash
claude mcp add --transport stdio \
  --env MS365_CLIENT_ID=<your-client-id> \
  --env MS365_TENANT_ID=<your-tenant-id> \
  --env MS365_INTERNAL_DOMAINS=omnitrex.eu \
  mcp-ms365-mail -- node /path/to/mcp-outlook/dist/index.js
```

### 3. First use — device code authentication

The first time you use any mail tool, the server triggers device code auth:

1. Claude will show a message like: *"To sign in, use a web browser to open https://microsoft.com/devicelogin and enter the code XXXXXXXX"*
2. Open that URL in any browser
3. Paste the code
4. Sign in with your M365 account (e.g., `maxim@omnitrex.eu`)
5. Click **Accept** when prompted for permissions
6. Return to Claude Code — the tool will complete automatically

After first auth, tokens are cached in your OS keychain (or `~/.mcp-outlook/token-cache.json` as fallback) and refreshed silently. You won't need to authenticate again unless you revoke access or tokens expire after extended inactivity.

## Configuration

All via environment variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MS365_CLIENT_ID` | Yes | — | Azure app client ID |
| `MS365_TENANT_ID` | Yes | — | Azure directory tenant ID |
| `MS365_INTERNAL_DOMAINS` | No | — | Comma-separated internal domains (e.g., `omnitrex.eu,company.com`) |
| `MS365_MAX_RECIPIENTS` | No | `100` | Max recipients per email (blocks above this) |
| `MS365_TOKEN_CACHE_PATH` | No | `~/.mcp-outlook/token-cache.json` | Token cache file location |
| `MS365_AUDIT_PATH` | No | `~/.mcp-outlook/audit` | Audit log directory |

## Tools

| Tool | Type | Description |
|------|------|-------------|
| `mail_list` | Read | List messages in inbox or folder with filtering/pagination |
| `mail_read` | Read | Read full message content and metadata |
| `mail_search` | Read | Full-text search with KQL syntax |
| `mail_draft_create` | Write | Create a draft (does NOT send) |
| `mail_draft_update` | Write | Update an existing draft |
| `mail_draft_send` | Write | Send a draft (preview first with `confirm: false`) |
| `mail_reply` | Write | Reply/reply-all (draft-first pattern) |
| `mail_forward` | Write | Forward message (draft-first pattern) |
| `mail_attach` | Write | Attach local file to draft (<3MB direct, 3-150MB chunked) |
| `mail_attachment_list` | Read | List attachments on a message |

## Safety

- **Draft-before-send**: `mail_draft_send` with `confirm: false` returns a preview without sending. Set `confirm: true` to send.
- **External recipient warnings**: when `MS365_INTERNAL_DOMAINS` is set, warns on external recipients.
- **Max recipient limit**: warns >20, blocks above `MS365_MAX_RECIPIENTS`.
- **Audit trail**: every action logged to `~/.mcp-outlook/audit/YYYY-MM.jsonl`. Never logs email body content.
- **No plaintext tokens**: stored in OS keychain or file with restricted permissions.

## Development

```bash
npm run dev       # Watch mode build
npm test          # Run tests
npm run lint      # Type check
```

## License

MIT
