/**
 * Links that hand the plan to the person's own Messages or Mail app. Pure and
 * dependency-free so they are testable; nothing here sends data anywhere.
 */

/**
 * Longest mailto: link (in characters, after percent-encoding) we hand to a
 * Windows mail client. Outlook and the Windows protocol launcher are known to
 * drop or refuse links near 2,000 characters; phones and Mac do not share that
 * limit, so only Windows is capped.
 */
export const WINDOWS_MAILTO_LIMIT = 1900;

/** "?&body=" is the form both iOS and Android read; "?body=" alone is ignored on iOS. */
export function smsLink(text: string): string {
  return `sms:?&body=${encodeURIComponent(text)}`;
}

export interface MailtoOptions {
  /** Cap on the whole link. The body is cut at a line break to fit. */
  maxLength?: number;
  /** Last line of a body that had to be cut, so a trimmed plan never looks complete. */
  truncatedNote?: string;
}

export function mailtoLink(subject: string, text: string, { maxLength, truncatedNote }: MailtoOptions = {}): string {
  // RFC 6068: line breaks in a mailto body are CRLF.
  const build = (body: string) => `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.replace(/\r?\n/g, "\r\n"))}`;
  const full = build(text);
  if (!maxLength || full.length <= maxLength) return full;

  const lines = text.split("\n");
  const withNote = (kept: string[]) => [...kept, ...(truncatedNote ? ["", truncatedNote] : [])].join("\n");
  while (lines.length > 1 && build(withNote(lines)).length > maxLength) lines.pop();
  while (lines.length > 1 && lines[lines.length - 1].trim() === "") lines.pop();
  return build(withNote(lines));
}
