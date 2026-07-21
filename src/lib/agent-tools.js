// ============================================================
// AI Agent Tools — Tool Calling for Browser-Based AI
// The AI can detect when to use tools and the agent handles them
// ============================================================

import { isValidUrl, webSearchRateLimiter } from './security';

// Safe math expression evaluator — recursive descent parser, no Function() constructor
function safeEval(expr) {
  try {
    // Convert ^ to ** (exponentiation)
    const sanitized = expr.replace(/\^/g, '**');
    // Tokenize: numbers, operators, parens, exponentiation
    const tokens = sanitized.match(/\d+\.?\d*|\*\*|[+\-*/()%]/g);
    if (!tokens) return null;

    let pos = 0;

    function peek() {
      return tokens[pos] || null;
    }
    function consume() {
      return tokens[pos++];
    }

    function parseExpression() {
      let result = parseTerm();
      while (peek() === '+' || peek() === '-') {
        const op = consume();
        const right = parseTerm();
        if (op === '+') result += right;
        else result -= right;
      }
      return result;
    }

    function parseTerm() {
      let result = parseFactor();
      while (peek() === '*' || peek() === '/' || peek() === '%') {
        const op = consume();
        const right = parseFactor();
        if (op === '*') result *= right;
        else if (op === '/') result /= right;
        else result %= right;
      }
      return result;
    }

    function parseFactor() {
      const token = peek();
      if (token === '(') {
        consume();
        const result = parseExpression();
        if (peek() !== ')') return null;
        consume();
        return result;
      }
      let base = parsePrimary();
      if (peek() === '**') {
        consume();
        const exp = parseFactor();
        base = Math.pow(base, exp);
      }
      return base;
    }

    function parsePrimary() {
      const token = peek();
      if (token === '-') {
        consume();
        return -parsePrimary();
      }
      if (token === '+') {
        consume();
        return parsePrimary();
      }
      if (token && /^\d+\.?\d*$/.test(token)) {
        consume();
        return parseFloat(token);
      }
      return null;
    }

    const result = parseExpression();
    if (pos !== tokens.length || result === null) return null;
    return Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

// Current date/time
function getDateTime(format = 'full') {
  const now = new Date();
  if (format === 'date') return now.toLocaleDateString();
  if (format === 'time') return now.toLocaleTimeString();
  if (format === 'iso') return now.toISOString();
  return now.toLocaleString();
}

// Unit converter
function convertUnits(value, from, to) {
  const conversions = {
    'km-m': (v) => v * 1000,
    'm-km': (v) => v / 1000,
    'm-cm': (v) => v * 100,
    'cm-m': (v) => v / 100,
    'in-cm': (v) => v * 2.54,
    'cm-in': (v) => v / 2.54,
    'ft-m': (v) => v * 0.3048,
    'm-ft': (v) => v / 0.3048,
    'kg-g': (v) => v * 1000,
    'g-kg': (v) => v / 1000,
    'kg-lb': (v) => v * 2.20462,
    'lb-kg': (v) => v / 2.20462,
    'c-f': (v) => (v * 9) / 5 + 32,
    'f-c': (v) => ((v - 32) * 5) / 9,
    'c-k': (v) => v + 273.15,
    'k-c': (v) => v - 273.15,
    'l-ml': (v) => v * 1000,
    'ml-l': (v) => v / 1000,
    'gal-l': (v) => v * 3.78541,
    'l-gal': (v) => v / 3.78541,
  };
  const key = `${from}-${to}`;
  const converter = conversions[key];
  if (!converter) return null;
  return Math.round(converter(parseFloat(value)) * 100) / 100;
}

// Fetch and extract text from a URL with SSRF & rate limit protection
async function fetchURL(url) {
  if (!isValidUrl(url)) return `Blocked: URL is not allowed (${url})`;
  if (!webSearchRateLimiter.canCall('fetch')) return 'Rate limited: too many URL fetch requests. Please wait.';
  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return `Failed to fetch: HTTP ${res.status}`;
    const data = await res.json();
    const html = data.contents || '';
    const text = html
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 2000);
    return text || 'No content extracted';
  } catch (e) {
    return `Fetch error: ${e.message}`;
  }
}

// Detect if the query needs a tool, and which one
function detectTool(query) {
  const q = query.toLowerCase();
  if (/^[\d+\-*/.()^%\s]+$/.test(query.trim()) && /[+\-*/^%]/.test(query)) {
    const result = safeEval(query);
    if (result !== null) return { tool: 'calculator', args: { expression: query, result } };
  }
  if (/\b(calculate|calc|what is|solve|compute|evaluate)\b/i.test(q)) {
    const match = query.match(/[\d+\-*/.()^%\s]+/);
    if (match) {
      const result = safeEval(match[0]);
      if (result !== null) return { tool: 'calculator', args: { expression: match[0].trim(), result } };
    }
  }
  const unitMatch = query.match(
    /(\d+\.?\d*)\s*(km|m|cm|mm|kg|g|lb|l|ml|gal|c|f|k|inch|ft)\s*(?:to|in|as)\s*(km|m|cm|mm|kg|g|lb|l|ml|gal|c|f|k|inch|ft)/i,
  );
  if (unitMatch) {
    const result = convertUnits(unitMatch[1], unitMatch[2].toLowerCase(), unitMatch[3].toLowerCase());
    if (result !== null)
      return {
        tool: 'converter',
        args: { value: parseFloat(unitMatch[1]), from: unitMatch[2], to: unitMatch[3], result },
      };
  }
  if (/\b(current time|current date|today|what time|what date|now)\b/i.test(q)) {
    const format = q.includes('time') ? 'time' : q.includes('date') ? 'date' : 'full';
    return { tool: 'datetime', args: { format, result: getDateTime(format) } };
  }
  const urlMatch = query.match(/https?:\/\/[^\s]+/);
  if (urlMatch) return { tool: 'fetch', args: { url: urlMatch[0] } };
  return null;
}

// Execute a tool and return the result
export async function executeTool(toolCall) {
  if (!toolCall) return null;
  const { tool, args } = toolCall;
  switch (tool) {
    case 'calculator':
      return `Calculation: ${args.expression} = ${args.result}`;
    case 'converter':
      return `Conversion: ${args.value} ${args.from} = ${args.result} ${args.to}`;
    case 'datetime':
      return `Current: ${args.result}`;
    case 'fetch': {
      const content = await fetchURL(args.url);
      return `Content from ${args.url}: ${content}`;
    }
    default:
      return null;
  }
}

export { detectTool, fetchURL, safeEval, convertUnits, getDateTime };
