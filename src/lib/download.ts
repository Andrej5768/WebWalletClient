/** Makes the browser save the blob as a file. */
export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

/** Saves a downloaded file under the name the server gave it, or the fallback. */
export async function saveDownload(
  call: Promise<{ data?: Blob; error?: unknown; response: Response }>,
  fallbackName: string,
) {
  const { data, error, response } = await call;
  if (error !== undefined || data === undefined || !response.ok) {
    throw error ?? { status: response.status, code: 'EMPTY_RESPONSE' };
  }
  const name = /filename="?([^";]+)"?/.exec(response.headers.get('Content-Disposition') ?? '')?.[1];
  saveBlob(data, name ?? fallbackName);
}
