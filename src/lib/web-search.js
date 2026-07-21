// ============================================================
// Web Search - DuckDuckGo Instant Answer API
// Free, no API key needed. Returns short summaries (not full pages).
// ============================================================

import { webSearchRateLimiter } from './security';

let abortController = null;

export function cancelWebSearch() {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
}

export async function searchWeb(query) {
  // Rate limiting — max 5 web searches per minute
  if (!webSearchRateLimiter.canCall('web')) return null;

  try {
    // Cancel any previous in-flight search
    cancelWebSearch();
    abortController = new AbortController();

    const res = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1&pretty=1`,
      { signal: AbortSignal.any([abortController.signal, AbortSignal.timeout(5000)]) },
    );

    if (!res.ok) return null;
    const data = await res.json();

    let results = [];

    // Abstract text (best source)
    if (data.AbstractText) {
      results.push(data.AbstractText);
    }

    // Related topics (secondary)
    if (data.RelatedTopics?.length) {
      for (const topic of data.RelatedTopics) {
        if (topic.Text && !topic.Topics && topic.Text.length > 30) {
          results.push(topic.Text);
        }
        if (topic.Topics) {
          for (const sub of topic.Topics) {
            if (sub.Text && sub.Text.length > 30) results.push(sub.Text);
          }
        }
        if (results.length >= 8) break;
      }
    }

    return results.length > 0 ? results.join('\n') : null;
  } catch {
    return null;
  }
}
