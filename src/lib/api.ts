/**
 * Safe API Client for RecoverAI
 * Includes automatic retry with backoff for server cold-start and robust JSON validation.
 */

export async function fetchJson<T = any>(url: string, options?: RequestInit, retries = 3, backoffMs = 500): Promise<T> {
  let attempt = 0;
  while (attempt < retries) {
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          'Accept': 'application/json',
          ...(options?.headers || {}),
        },
      });

      const contentType = res.headers.get('content-type') || '';
      
      // If we got an HTML response instead of JSON (e.g. during server startup/vite fallback), retry
      if (!contentType.includes('application/json')) {
        if (attempt < retries - 1) {
          attempt++;
          await new Promise((resolve) => setTimeout(resolve, backoffMs * attempt));
          continue;
        }
        throw new Error(`Server returned non-JSON response (${res.status} ${res.statusText})`);
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP error ${res.status}`);
      }
      return data as T;
    } catch (err: any) {
      if (attempt < retries - 1 && (err.name === 'TypeError' || err.message?.includes('Failed to fetch') || err.message?.includes('non-JSON'))) {
        attempt++;
        await new Promise((resolve) => setTimeout(resolve, backoffMs * attempt));
        continue;
      }
      throw err;
    }
  }
  throw new Error(`Failed to fetch from ${url} after ${retries} attempts`);
}
