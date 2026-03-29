const getFilenameFromUrl = (url: string, fallback = "download") => {
  try {
    const pathname = new URL(url).pathname;
    const last = pathname.split("/").pop() || "";
    const decoded = decodeURIComponent(last);
    return decoded || fallback;
  } catch {
    return fallback;
  }
};

const triggerBlobDownload = (blob: Blob, filename: string) => {
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
};

export async function downloadMediaWithFallback(url: string, preferredName?: string): Promise<boolean> {
  const fileName = preferredName || getFilenameFromUrl(url);

  try {
    const response = await fetch(url, { mode: "cors", cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    if (!blob.size) throw new Error("Empty response");
    triggerBlobDownload(blob, fileName);
    return true;
  } catch {
    // ignore and continue with fallback
  }

  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  } catch {
    // ignore and continue with final fallback
  }

  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}
