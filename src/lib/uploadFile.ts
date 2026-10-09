// fetch has no upload progress events, so uploads go through XMLHttpRequest.
export function uploadFile(
  url: string,
  file: File,
  contentType: string,
  onProgress: (loaded: number) => void,
): Promise<{ storageId: string }> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", url);
    request.setRequestHeader("Content-Type", contentType || "application/octet-stream");
    request.upload.onprogress = (event) => onProgress(event.loaded);
    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(`Upload of ${file.name} failed (${request.status})`));
        return;
      }
      try {
        const json = JSON.parse(request.responseText) as { storageId?: string };
        if (!json.storageId) throw new Error("missing storageId");
        resolve({ storageId: json.storageId });
      } catch {
        reject(new Error(`Upload of ${file.name} returned an unexpected response`));
      }
    };
    request.onerror = () => reject(new Error(`Upload of ${file.name} failed (network error)`));
    request.onabort = () => reject(new Error(`Upload of ${file.name} was cancelled`));
    request.send(file);
  });
}
