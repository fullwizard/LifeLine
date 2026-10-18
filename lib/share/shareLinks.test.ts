import { describe, expect, it } from "vitest";
import { mailtoLink, smsLink, WINDOWS_MAILTO_LIMIT } from "./shareLinks";

const plan = ["My LifeLine plan", "", "Steps:", ...Array.from({ length: 40 }, (_, i) => `${i + 1}. [Today] Call program number ${i + 1} (408) 555-01${String(i).padStart(2, "0")}`), "", "Made with LifeLine."].join("\n");
const bodyOf = (link: string) => decodeURIComponent(link.slice(link.indexOf("&body=") + "&body=".length));

describe("smsLink", () => {
  it("uses the ?&body= form and keeps the text intact", () => {
    const text = "My plan\n☐ Photo ID — 申请 & more";
    const link = smsLink(text);
    expect(link.startsWith("sms:?&body=")).toBe(true);
    expect(decodeURIComponent(link.slice("sms:?&body=".length))).toBe(text);
  });

  it("is not cut, however long the plan is", () => {
    expect(decodeURIComponent(smsLink(plan).slice("sms:?&body=".length))).toBe(plan);
  });
});

describe("mailtoLink", () => {
  it("encodes the subject and uses CRLF line breaks in the body", () => {
    const link = mailtoLink("My LifeLine plan", "a\nb");
    expect(link).toBe("mailto:?subject=My%20LifeLine%20plan&body=a%0D%0Ab");
  });

  it("leaves a plan that fits untouched", () => {
    const text = "short\nplan";
    expect(mailtoLink("s", text, { maxLength: WINDOWS_MAILTO_LIMIT, truncatedNote: "NOTE" })).toBe(mailtoLink("s", text));
  });

  it("does not cut a plan when there is no limit", () => {
    expect(bodyOf(mailtoLink("s", plan)).replace(/\r\n/g, "\n")).toBe(plan);
  });

  it("cuts at a line break, stays under the limit, and says it was cut", () => {
    expect(mailtoLink("My LifeLine plan", plan).length).toBeGreaterThan(WINDOWS_MAILTO_LIMIT);
    const link = mailtoLink("My LifeLine plan", plan, { maxLength: WINDOWS_MAILTO_LIMIT, truncatedNote: "(Shortened.)" });
    expect(link.length).toBeLessThanOrEqual(WINDOWS_MAILTO_LIMIT);

    const lines = bodyOf(link).replace(/\r\n/g, "\n").split("\n");
    expect(lines.at(-1)).toBe("(Shortened.)");
    expect(lines.at(-2)).toBe("");
    const kept = lines.slice(0, -2);
    expect(kept[0]).toBe("My LifeLine plan");
    // Every kept line is a whole line of the original, in order: nothing is cut mid-step.
    expect(kept).toEqual(plan.split("\n").slice(0, kept.length));
    expect(kept.length).toBeLessThan(plan.split("\n").length);
  });

  it("keeps as many lines as fit", () => {
    const link = mailtoLink("s", plan, { maxLength: 800, truncatedNote: "N" });
    const kept = bodyOf(link).replace(/\r\n/g, "\n").split("\n").slice(0, -2);
    const oneMore = [...plan.split("\n").slice(0, kept.length + 1), "", "N"].join("\n");
    expect(mailtoLink("s", oneMore).length).toBeGreaterThan(800);
  });

  it("does not leave a blank line before the note", () => {
    // The limit lets "Title", a blank line, then the note fit, but not the long line after the blank.
    const text = ["Title", "", "x".repeat(60)].join("\n");
    const limit = mailtoLink("s", "Title\n\n\nN").length;
    const body = bodyOf(mailtoLink("s", text, { maxLength: limit, truncatedNote: "N" })).replace(/\r\n/g, "\n");
    expect(body).toBe("Title\n\nN");
  });

  it("terminates and still returns the title when nothing fits", () => {
    const body = bodyOf(mailtoLink("s", plan, { maxLength: 10, truncatedNote: "N" })).replace(/\r\n/g, "\n");
    expect(body.startsWith("My LifeLine plan")).toBe(true);
  });

  it("counts percent-encoded length, which is longer for non-English text", () => {
    const zh = ["我的计划", ...Array.from({ length: 30 }, (_, i) => `${i + 1}. 今天致电项目 ${i + 1}`)].join("\n");
    const link = mailtoLink("计划", zh, { maxLength: WINDOWS_MAILTO_LIMIT, truncatedNote: "（已缩短）" });
    expect(link.length).toBeLessThanOrEqual(WINDOWS_MAILTO_LIMIT);
    expect(bodyOf(link)).toContain("（已缩短）");
  });
});
