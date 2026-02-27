import { describe, it, expect } from "vitest";
import { detectMimeType } from "../../src/utils/mime.js";

describe("detectMimeType", () => {
  it("detects PDF files", () => {
    expect(detectMimeType("report.pdf")).toBe("application/pdf");
  });

  it("detects Word documents", () => {
    expect(detectMimeType("doc.docx")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
  });

  it("detects Excel spreadsheets", () => {
    expect(detectMimeType("data.xlsx")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  });

  it("detects images", () => {
    expect(detectMimeType("photo.png")).toBe("image/png");
    expect(detectMimeType("photo.jpg")).toBe("image/jpeg");
    expect(detectMimeType("photo.jpeg")).toBe("image/jpeg");
    expect(detectMimeType("logo.svg")).toBe("image/svg+xml");
  });

  it("detects text files", () => {
    expect(detectMimeType("notes.txt")).toBe("text/plain");
    expect(detectMimeType("data.csv")).toBe("text/csv");
    expect(detectMimeType("page.html")).toBe("text/html");
  });

  it("detects email/calendar files", () => {
    expect(detectMimeType("message.eml")).toBe("message/rfc822");
    expect(detectMimeType("meeting.ics")).toBe("text/calendar");
  });

  it("returns octet-stream for unknown types", () => {
    expect(detectMimeType("file.xyz")).toBe("application/octet-stream");
    expect(detectMimeType("noextension")).toBe("application/octet-stream");
  });

  it("is case-insensitive for extensions", () => {
    expect(detectMimeType("REPORT.PDF")).toBe("application/pdf");
    expect(detectMimeType("photo.PNG")).toBe("image/png");
  });
});
