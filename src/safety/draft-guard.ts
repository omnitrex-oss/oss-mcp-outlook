import type { GraphClient } from "../graph/client.js";
import type { AuditLogger } from "./audit.js";
import {
  checkRecipients,
  extractAddresses,
  type RecipientCheckConfig,
} from "./recipient-check.js";

export interface DraftPreview {
  draftId: string;
  subject: string;
  to: string[];
  cc: string[];
  bcc: string[];
  bodySnippet: string;
  attachments: string[];
  warnings: string[];
  readyToSend: boolean;
}

interface GraphMessage {
  id: string;
  subject?: string;
  body?: { content?: string; contentType?: string };
  toRecipients?: { emailAddress?: { address?: string; name?: string } }[];
  ccRecipients?: { emailAddress?: { address?: string; name?: string } }[];
  bccRecipients?: { emailAddress?: { address?: string; name?: string } }[];
  hasAttachments?: boolean;
  isDraft?: boolean;
}

interface GraphAttachment {
  name?: string;
  size?: number;
}

/**
 * Draft-before-send guard.
 * Creates a preview of a draft message with safety checks,
 * and only allows sending with explicit confirmation.
 */
export async function previewDraft(
  graph: GraphClient,
  draftId: string,
  recipientConfig: Partial<RecipientCheckConfig>,
): Promise<DraftPreview> {
  // Fetch the draft
  const draft = await graph.get<GraphMessage>(`/me/messages/${draftId}`);

  if (!draft.isDraft) {
    throw new Error(`Message ${draftId} is not a draft — cannot send.`);
  }

  const to = extractAddresses(draft.toRecipients);
  const cc = extractAddresses(draft.ccRecipients);
  const bcc = extractAddresses(draft.bccRecipients);
  const allRecipients = [...to, ...cc, ...bcc];

  // Recipient safety check
  const recipientCheck = checkRecipients(allRecipients, recipientConfig);

  // Fetch attachment names if present
  const attachments: string[] = [];
  if (draft.hasAttachments) {
    const attResult = await graph.get<{ value: GraphAttachment[] }>(
      `/me/messages/${draftId}/attachments?$select=name,size`,
    );
    for (const att of attResult.value) {
      attachments.push(att.name ?? "unnamed");
    }
  }

  // Build body snippet (first 200 chars, no sensitive data in logs)
  const bodyContent = draft.body?.content ?? "";
  const bodySnippet =
    draft.body?.contentType === "html"
      ? bodyContent.replace(/<[^>]*>/g, "").slice(0, 200)
      : bodyContent.slice(0, 200);

  return {
    draftId,
    subject: draft.subject ?? "(no subject)",
    to,
    cc,
    bcc,
    bodySnippet: bodySnippet + (bodyContent.length > 200 ? "..." : ""),
    attachments,
    warnings: [...recipientCheck.warnings, ...recipientCheck.errors],
    readyToSend: recipientCheck.allowed,
  };
}

/**
 * Send a draft after confirmation. Returns audit-ready metadata.
 */
export async function sendDraft(
  graph: GraphClient,
  audit: AuditLogger,
  draftId: string,
  recipientConfig: Partial<RecipientCheckConfig>,
): Promise<{ sent: true; preview: DraftPreview }> {
  const preview = await previewDraft(graph, draftId, recipientConfig);

  if (!preview.readyToSend) {
    throw new Error(
      `Cannot send: ${preview.warnings.join("; ")}`,
    );
  }

  // Actually send
  await graph.postEmpty(`/me/messages/${draftId}/send`);

  // Audit log (no body content)
  await audit.log({
    action: "send",
    tool: "mail_draft_send",
    success: true,
    draftId,
    recipients: [...preview.to, ...preview.cc, ...preview.bcc],
    subject: preview.subject,
    attachmentNames: preview.attachments,
  });

  return { sent: true, preview };
}
