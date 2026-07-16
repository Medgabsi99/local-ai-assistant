import { useState, useCallback } from 'react';
import { searchWeb } from '../lib/web-search';
import { detectTool, executeTool } from '../lib/agent-tools';
import { getServerConfig, generate } from '../lib/llm-server';
import { ai } from '../workers/worker-bridge';
import { addMessage, updateConversationTitle } from '../db/database';
import { useRAG } from './useRAG';
import { t } from '../lib/i18n';

export function useChatSend({
  conversationId,
  messages,
  useRAGMode,
  webSearchEnabled,
  agentMode,
  systemPrompt,
  setRetrievedContext,
  loadMessages,
  toast,
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const { searchSimilar } = useRAG();

  const stopGeneration = useCallback(() => {
    ai.cancelInference?.();
    setIsGenerating(false);
  }, []);

  const generateReply = useCallback(
    async (userMessage) => {
      const inferenceStartTime = Date.now();
      setIsGenerating(true);
      setStreamingContent('');
      setRetrievedContext(null);

      try {
        let context = null;
        if (useRAGMode) {
          try {
            const c = await searchSimilar(userMessage, 3);
            if (c.length > 0) context = c.map((x) => x.content);
            setRetrievedContext(c);
          } catch (e) {
            console.warn('RAG:', e);
          }
        }

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

        const serverConfig = getServerConfig();
        const useServer = serverConfig.enabled;
        let fullResponse = '';
        let usedModel = 'browser';

        if (useServer) {
          usedModel = 'server';
          let prompt = '';
          if (systemPrompt) prompt += `System: ${systemPrompt}\n\n`;
          if (context?.length) prompt += `Context:\n${context.join('\n\n')}\n\n`;
          if (webContext) prompt += `Web search results:\n${webContext}\n\n`;
          const recent = messages.slice(-6);
          for (const msg of recent)
            prompt += msg.role === 'user' ? `User: ${msg.content}\n` : `Assistant: ${msg.content}\n`;
          prompt += `User: ${userMessage}\nAssistant: `;
          try {
            await generate(prompt, {
              onToken: (t) => {
                fullResponse += t;
                setStreamingContent(fullResponse);
              },
              maxTokens: 2048,
              temperature: 0.3,
            });
          } catch (e) {
            fullResponse = `Server error: ${e.message}.`;
          }
        } else {
          let prompt = systemPrompt ? `Instructions: ${systemPrompt}\n\n` : '';
          let history = '';
          const recent = messages.slice(-6);
          for (const msg of recent) history += msg.role === 'user' ? `${msg.content}\n` : `${msg.content}\n`;
          if (history.length > 500) history = '...\n' + history.slice(-500);
          prompt += history;
          if (agentResult) prompt += `Tool result: ${agentResult}\n\n`;
          if (context?.length) prompt += `Context:\n${context.join('\n\n')}\n\n`;
          if (webContext) prompt += `Web search results:\n${webContext}\n\n`;
          prompt += `Question: ${userMessage}\nAnswer:`;
          const result = await ai.runInference(
            { modelName: 'llm', input: prompt, maxTokens: 512, temperature: 0.3 },
            {
              onToken: (t) => {
                fullResponse += t;
                setStreamingContent(fullResponse);
              },
            },
          );
          if (result?.result) fullResponse = result.result;
        }

        const timeMs = Date.now() - inferenceStartTime;
        await addMessage(conversationId, 'assistant', fullResponse || '(no response)', {
          model: usedModel,
          ragUsed: !!context,
          webUsed: !!webContext,
          timeMs,
          contextSources: context ? [] : [],
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
        setIsGenerating(false);
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
      if (!input.trim() || isGenerating) return;
      await addMessage(conversationId, 'user', input.trim());
      await loadMessages();
      await generateReply(input.trim());
    },
    [conversationId, isGenerating, loadMessages, generateReply],
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
