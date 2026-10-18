/**
 * Browser plumbing for report.pdf. Everything here takes a PDF Blob that has
 * already been built, so Download and Print hand over the identical file.
 */

/** Save the file as `name` through the browser's normal download. */
export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Can this browser print a PDF from a hidden frame? That needs a built-in PDF
 * viewer and a desktop-style pointer. Phones don't show PDFs in frames, and we
 * don't rely on frame printing in Safari, so those open the PDF in a tab, where
 * the viewer's own Print and Share buttons print the same file.
 */
export function canPrintInline(): boolean {
  const ua = navigator.userAgent;
  const safari = /safari/i.test(ua) && !/chrome|chromium|crios|fxios|edg|android/i.test(ua);
  return navigator.pdfViewerEnabled === true && window.matchMedia("(hover: hover) and (pointer: fine)").matches && !safari;
}

let frame: HTMLIFrameElement | null = null;
let frameUrl: string | null = null;

/** Print a PDF Blob through a hidden frame. Resolves once the print dialog has been requested. */
export function printBlob(blob: Blob): Promise<void> {
  // One frame at a time; the last one stays until the next print so an open dialog is never pulled away.
  frame?.remove();
  if (frameUrl) URL.revokeObjectURL(frameUrl);
  const url = (frameUrl = URL.createObjectURL(blob));
  const f = (frame = document.createElement("iframe"));
  f.setAttribute("aria-hidden", "true");
  f.tabIndex = -1;
  // Not display:none, which some browsers skip when printing.
  f.style.cssText = "position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none;";
  return new Promise((resolve, reject) => {
    f.onload = () => {
      try {
        f.contentWindow?.focus();
        f.contentWindow?.print();
        resolve();
      } catch (err) {
        reject(err);
      }
    };
    f.src = url;
    document.body.appendChild(f);
  });
}

/**
 * Show a PDF Blob in a tab. `tab` must have been opened inside the click that
 * started the work, or the browser will block it as a pop-up; without one the
 * file is downloaded instead.
 */
export function openBlob(blob: Blob, tab: Window | null, name: string) {
  if (!tab) return saveBlob(blob, name);
  // Not revoked: the viewer needs the address for reload and save. The page frees it on close.
  tab.location.href = URL.createObjectURL(blob);
}
