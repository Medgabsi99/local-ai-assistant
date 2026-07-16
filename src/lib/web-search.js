// ============================================================
// Web Search - DuckDuckGo Instant Answer API
// Free, no API key needed. Returns short summaries (not full pages).
// For detailed web results, use Ollama + a local search tool.
// ============================================================

export async function searchWeb(query) {
  try {
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1&pretty=1`,
      { signal: AbortSignal.timeout(5000) },
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
