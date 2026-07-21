// ============================================================
// useSmartReplies — Generates contextual follow-up suggestions
// After each AI response, suggests 3 relevant follow-up questions
// ============================================================

import { useState, useCallback, useRef } from 'react';
import { getServerConfig, generate } from '../lib/llm-server';
import { ai } from '../workers/worker-bridge';

const SUGGESTION_PROMPT = `Based on this conversation, suggest 3 short follow-up questions the user might want to ask next.
Each question must be on its own line starting with "- ".
Keep each question under 60 characters. Do not include any explanation.

Examples:
- What caused this issue?
- Can you show me an example?
- How does this compare to alternatives?`;

export function useSmartReplies(messages) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const lastMessageCountRef = useRef(0);

  const generateSuggestions = useCallback(async (lastAssistantMessage) => {
    if (!lastAssistantMessage || lastAssistantMessage.length < 10) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const serverConfig = getServerConfig();
      const prompt = `Conversation:\n${messages.slice(-4).map((m) => `${m.role}: ${m.content.slice(0, 200)}`).join('\n')}\n\n${SUGGESTION_PROMPT}`;

      let raw = '';
      if (serverConfig.enabled) {
        raw = await generate(prompt, { maxTokens: 150, temperature: 0.5 });
      } else {
        const result = await ai.runInference({
          modelName: 'llm',
          input: prompt,
          maxTokens: 150,
          temperature: 0.5,
        });
        raw = result?.result || '';
      }

      // Parse lines starting with "- "
      const parsed = raw
        .split('\n')
        .filter((line) => line.trim().startsWith('- '))
        .map((line) => line.trim().replace(/^-\s*/, '').trim())
        .filter((q) => q.length > 5 && q.length < 80)
        .slice(0, 3);

      setSuggestions(parsed.length > 0 ? parsed : []);
    } catch (e) {
      console.warn('Smart replies:', e);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [messages]);

  return { suggestions, loading, generateSuggestions, lastMessageCountRef };
}