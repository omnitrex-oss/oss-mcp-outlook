/**
 * Microsoft Graph API permission scopes for mail operations.
 * These are delegated permissions (user-consented, not app-level).
 */

export const GRAPH_SCOPES = {
  /** Read and write access to user's mail */
  MAIL_READ_WRITE: "Mail.ReadWrite",
  /** Permission to send mail as the user */
  MAIL_SEND: "Mail.Send",
  /** Read basic user profile (needed for /me endpoint) */
  USER_READ: "User.Read",
} as const;

/** All scopes required for this MCP server */
export const ALL_SCOPES = [
  GRAPH_SCOPES.MAIL_READ_WRITE,
  GRAPH_SCOPES.MAIL_SEND,
  GRAPH_SCOPES.USER_READ,
];
