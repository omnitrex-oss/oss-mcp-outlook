/**
 * Format a Graph API message for clean MCP output.
 */
export interface FormattedMessage {
  id: string;
  subject: string;
  from: string;
  to: string[];
  cc: string[];
  receivedDateTime: string;
  isRead: boolean;
  isDraft: boolean;
  hasAttachments: boolean;
  importance: string;
  bodyPreview?: string;
  body?: string;
  bodyType?: string;
}

interface GraphRecipient {
  emailAddress?: { address?: string; name?: string };
}

interface GraphMessageRaw {
  id: string;
  subject?: string;
  from?: GraphRecipient;
  toRecipients?: GraphRecipient[];
  ccRecipients?: GraphRecipient[];
  receivedDateTime?: string;
  isRead?: boolean;
  isDraft?: boolean;
  hasAttachments?: boolean;
  importance?: string;
  bodyPreview?: string;
  body?: { content?: string; contentType?: string };
}

function formatRecipient(r: GraphRecipient): string {
  const name = r.emailAddress?.name;
  const addr = r.emailAddress?.address ?? "unknown";
  return name ? `${name} <${addr}>` : addr;
}

export function formatMessage(
  msg: GraphMessageRaw,
  includeBody = false,
): FormattedMessage {
  const result: FormattedMessage = {
    id: msg.id,
    subject: msg.subject ?? "(no subject)",
    from: msg.from ? formatRecipient(msg.from) : "unknown",
    to: (msg.toRecipients ?? []).map(formatRecipient),
    cc: (msg.ccRecipients ?? []).map(formatRecipient),
    receivedDateTime: msg.receivedDateTime ?? "",
    isRead: msg.isRead ?? false,
    isDraft: msg.isDraft ?? false,
    hasAttachments: msg.hasAttachments ?? false,
    importance: msg.importance ?? "normal",
  };

  if (msg.bodyPreview) {
    result.bodyPreview = msg.bodyPreview;
  }

  if (includeBody && msg.body?.content) {
    result.body =
      msg.body.contentType === "html"
        ? stripHtml(msg.body.content)
        : msg.body.content;
    result.bodyType = msg.body.contentType;
  }

  return result;
}

export function formatMessageList(
  messages: GraphMessageRaw[],
): FormattedMessage[] {
  return messages.map((m) => formatMessage(m, false));
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
