import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export interface AuditEntry {
  timestamp: string;
  action: string;
  tool: string;
  success: boolean;
  recipients?: string[];
  subject?: string;
  attachmentNames?: string[];
  draftId?: string;
  messageId?: string;
  error?: string;
}

/**
 * Append-only structured JSON lines audit logger.
 * Never logs email body content — only metadata for compliance.
 * Files rotated monthly: YYYY-MM.jsonl
 */
export class AuditLogger {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  async log(entry: Omit<AuditEntry, "timestamp">): Promise<void> {
    const now = new Date();
    const fullEntry: AuditEntry = {
      timestamp: now.toISOString(),
      ...entry,
    };

    const fileName = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}.jsonl`;
    const filePath = join(this.basePath, fileName);

    await mkdir(this.basePath, { recursive: true });
    await appendFile(filePath, JSON.stringify(fullEntry) + "\n", "utf-8");
  }
}
