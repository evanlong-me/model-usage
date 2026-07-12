import https from 'https';
import path from 'path';
import os from 'os';

/** Extract project name from a working directory path */
export function cwdToProjectName(cwd: string | null | undefined): string | null {
  if (!cwd) return null;
  const normalized = path.resolve(cwd);
  if (normalized === path.resolve(os.homedir())) return '~';
  return path.basename(normalized);
}

/** Format a timestamp as YYYY-MM-DD string */
export function getDateStr(timestamp: string | null): string {
  if (!timestamp) return 'unknown';
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Simple HTTPS JSON fetch with timeout */
export function fetchJson<T = unknown>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      let data = '';
      response.on('data', (chunk: string) => { data += chunk; });
      response.on('end', () => {
        try {
          resolve(JSON.parse(data) as T);
        } catch (error) {
          reject(new Error(`Failed to parse JSON: ${(error as Error).message}`));
        }
      });
    });
    request.on('error', (error) => {
      reject(new Error(`Network request failed: ${error.message}`));
    });
    request.setTimeout(10000, () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
  });
}
