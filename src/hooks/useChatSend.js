import { useCallback, useRef, useState } from 'react';
import { searchWeb } from '../lib/web-search';
import { detectTool, executeTool } from '../lib/agent-tools';
import { generate, getServerConfig } from '../lib/llm-server';
import { ai } from '../workers/worker-bridge';
import { addMessage, updateConversationTitle } from '../db/database';
import {
  INFERENCE_HISTORY_LENGTH,
  INFERENCE_HISTORY_MAX_CHARS,
  INFERENCE_MAX_TOKENS,
  INFERENCE_SERVER_MAX_TOKENS,
  INFERENCE_SERVER_TEMPERATURE,
  INFERENCE_TEMPERATURE,
  RAG_TOP_K,
} from '../lib/constants';
import { useRAG } from './useRAG';
import { extractMemories, getMemorySummary, saveMemory } from '../db/memory';

export function useChatSend({
  conversationId,
  messages,
  useRAGMode,
  webSearchEnabled,
  agentMode,
  systemPrompt,
  setRetrievedContext,
  loadMessages,
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const { searchSimilar } = useRAG();

  // Refs to avoid stale closures in race conditions
  const isGeneratingRef = useRef(false);
  const generationIdRef = useRef(0);
  const abortRef = useRef(false);

  const stopGeneration = useCallback(() => {
    ai.cancelInference?.();
    abortRef.current = true;
    isGeneratingRef.current = false;
    setIsGenerating(false);
  }, []);

  const generateReply = useCallback(
    async (userMessage) => {
      // Increment generation ID — any previous in-flight generation is now stale
      const genId = ++generationIdRef.current;
      abortRef.current = false;
      const inferenceStartTime = Date.now();
      isGeneratingRef.current = true;
      setIsGenerating(true);
      setStreamingContent('');
      setRetrievedContext(null);

      try {
        let context = null;
        let contextSources = [];
        if (useRAGMode) {
          try {
            const c = await searchSimilar(userMessage, RAG_TOP_K);
            if (c.length > 0) {
              context = c.map((x) => x.content);
              contextSources = c.map((x) => x.documentTitle).filter(Boolean);
            }
            setRetrievedContext(c);
          } catch (e) {
            console.warn('RAG:', e);
          }
        }

        // Check if this generation was superseded
        if (genId !== generationIdRef.current || abortRef.current) return;

        let webContext = null;
        let agentResult = null;
        if (agentMode) {
          const toolCall = detectTool(userMessage);
          if (toolCall) agentResult = await executeTool(toolCall);
        }
        if (webSearchEnabled && (!context || context.length === 0)) {
          const results = await searchWeb(userMessage);
          if (results?.length) webContext = results;
        }

        // Check again before starting inference
        if (genId !== generationIdRef.current || abortRef.current) return;

        // Get memory context to inject into the prompt
        let memoryContext = '';
        try {
          memoryContext = await getMemorySummary();
        } catch {
          /* memory fetch failed */
        }

        const serverConfig = getServerConfig();
        const useServer = serverConfig.enabled;
        let fullResponse = '';
        let usedModel = 'browser';

        if (useServer) {
          usedModel = 'server';
          let prompt = '';
          if (memoryContext) prompt += `User context (remembered facts): ${memoryContext}\n\n`;
          if (systemPrompt) prompt += `System: ${systemPrompt}\n\n`;
          if (context?.length) prompt += `Context:\n${context.join('\n\n')}\n\n`;
          if (webContext) prompt += `Web search results:\n${webContext}\n\n`;
          const recent = messages.slice(-INFERENCE_HISTORY_LENGTH);
          for (const msg of recent)
            prompt += msg.role === 'user' ? `User: ${msg.content}\n` : `Assistant: ${msg.content}\n`;
          prompt += `User: ${userMessage}\nAssistant: `;
          try {
            await generate(prompt, {
              onToken: (t) => {
                if (genId !== generationIdRef.current || abortRef.current) return;
                fullResponse += t;
                setStreamingContent(fullResponse);
              },
              maxTokens: INFERENCE_SERVER_MAX_TOKENS,
              temperature: INFERENCE_SERVER_TEMPERATURE,
            });
          } catch (e) {
            fullResponse = `Server error: ${e.message}.`;
          }
        } else {
          let prompt = systemPrompt ? `Instructions: ${systemPrompt}\n\n` : '';
          let history = '';
          const recent = messages.slice(-INFERENCE_HISTORY_LENGTH);
          for (const msg of recent) history += msg.role === 'user' ? `${msg.content}\n` : `${msg.content}\n`;
          if (history.length > INFERENCE_HISTORY_MAX_CHARS)
            history = '...\n' + history.slice(-INFERENCE_HISTORY_MAX_CHARS);
          prompt += history;
          if (agentResult) prompt += `Tool result: ${agentResult}\n\n`;
          if (context?.length) prompt += `Context:\n${context.join('\n\n')}\n\n`;
          if (webContext) prompt += `Web search results:\n${webContext}\n\n`;
          prompt += `Question: ${userMessage}\nAnswer:`;
          const result = await ai.runInference(
            { modelName: 'llm', input: prompt, maxTokens: INFERENCE_MAX_TOKENS, temperature: INFERENCE_TEMPERATURE },
            {
              onToken: (t) => {
                if (genId !== generationIdRef.current || abortRef.current) return;
                fullResponse += t;
                setStreamingContent(fullResponse);
              },
            },
          );
          if (result?.result) fullResponse = result.result;
        }

        // Don't save response if this generation was superseded or aborted
        // Extract and save memories from user message
        try {
          const memories = extractMemories(userMessage);
          for (const memory of memories) {
            await saveMemory(memory);
          }
        } catch {
          /* memory save failed silently */
        }

        if (genId !== generationIdRef.current || abortRef.current) return;

        const timeMs = Date.now() - inferenceStartTime;
        await addMessage(conversationId, 'assistant', fullResponse || '(no response)', {
          model: usedModel,
          ragUsed: !!context,
          webUsed: !!webContext,
          timeMs,
          contextSources,
        });
        setStreamingContent('');
        if (messages.length === 0) {
          const fallback = userMessage.slice(0, 50) + (userMessage.length > 50 ? '...' : '');
          const title = fullResponse
            ? fullResponse
                .replace(/<[^>]*>/g, '')
                .slice(0, 50)
                .trim()
            : fallback;
          await updateConversationTitle(conversationId, title || fallback);
        }
        await loadMessages();
      } catch (error) {
        console.error(error);
      } finally {
        if (genId === generationIdRef.current) {
          isGeneratingRef.current = false;
          setIsGenerating(false);
        }
      }
    },
    [
      conversationId,
      messages,
      useRAGMode,
      webSearchEnabled,
      agentMode,
      systemPrompt,
      setRetrievedContext,
      loadMessages,
      searchSimilar,
    ],
  );

  const handleSend = useCallback(
    async (input) => {
      if (!input.trim()) return;
      // Use ref for real-time check instead of stale state closure
      if (isGeneratingRef.current) return;
      await addMessage(conversationId, 'user', input.trim());
      await loadMessages();
      await generateReply(input.trim());
    },
    [conversationId, loadMessages, generateReply],
  );

  return {
    isGenerating,
    setIsGenerating,
    streamingContent,
    setStreamingContent,
    handleSend,
    generateReply,
    stopGeneration,
  };
}
