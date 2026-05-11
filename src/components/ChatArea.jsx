import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getConversationMessages,
  addMessage,
  updateConversationTitle,
} from '../db/database';
import { ai } from '../workers/worker-bridge';
import { useRAG } from '../hooks/useRAG';
import AudioRecorder from './AudioRecorder';

export default function ChatArea({ conversationId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [useRAGMode, setUseRAGMode] = useState(true);
  const [retrievedContext, setRetrievedContext] = useState(null);
  const messagesEndRef = useRef(null);
  const { searchSimilar } = useRAG();
  const [transcribedText, setTranscribedText] = useState('');

  const handleTranscription = (text) => {
    setInput((prev) => prev + (prev ? ' ' : '') + text);
  };

  const loadMessages = useCallback(async () => {
    if (conversationId) {
      const msgs = await getConversationMessages(conversationId);
      setMessages(msgs);
    } else {
      setMessages([]);
    }
  }, [conversationId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const handleSend = async () => {
    if (!input.trim() || isGenerating) return;

    const userMessage = input.trim();
    setInput('');
    setIsGenerating(true);
    setStreamingContent('');
    setRetrievedContext(null);

    // Add user message
    await addMessage(conversationId, 'user', userMessage);
    await loadMessages();

    try {
      let context = null;

      // RAG: Search for relevant document chunks
      if (useRAGMode) {
        try {
          const contexts = await searchSimilar(userMessage, 3);
          if (contexts.length > 0) {
            context = contexts.map((c) => c.content);
            setRetrievedContext(contexts);
          }
        } catch (error) {
          console.warn('RAG search failed, continuing without context:', error);
        }
      }

      // Run inference
      let fullResponse = '';

      await ai.runInference(
        {
          modelName: 'llm',
          input: userMessage,
          context: context,
          maxTokens: 512,
        },
        {
          onToken: (token, fullText) => {
            fullResponse = fullText || token;
            setStreamingContent(fullResponse);
          },
          onProgress: (data) => {
            console.log('Generation progress:', data);
          },
        }
      );

      // Save AI response
      await addMessage(conversationId, 'assistant', fullResponse, {
        model: 'local-llm',
        ragUsed: !!context,
        contextSources: context
          ? retrievedContext?.map((c) => c.documentTitle) || []
          : [],
      });

      setStreamingContent('');

      // Update conversation title if it's the first message
      if (messages.length === 0) {
        const title = userMessage.slice(0, 50) + (userMessage.length > 50 ? '...' : '');
        await updateConversationTitle(conversationId, title);
      }

      await loadMessages();
    } catch (error) {
      console.error('Inference error:', error);
      await addMessage(conversationId, 'assistant', `Error: ${error.message}. Make sure the model is loaded in the sidebar.`, {
        error: true,
      });
      await loadMessages();
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Welcome screen
  if (!conversationId) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">🔒</div>
          <h2 className="text-2xl font-bold text-white mb-3">
            Local AI Assistant
          </h2>
          <p className="text-slate-400 mb-8">
            Your privacy-first AI that runs entirely on your device.
            Upload documents and chat with them using RAG.
          </p>
          <div className="grid grid-cols-2 gap-4 text-left">
            <Feature icon="📄" title="Document Q&A" desc="Ask questions about your files" />
            <Feature icon="🧠" title="Local RAG" desc="Vector search in your browser" />
            <Feature icon="💬" title="Chat" desc="Conversations stored privately" />
            <Feature icon="📡" title="Works Offline" desc="No internet required" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* RAG Toggle & Context Indicator */}
      <div className="px-4 py-2 border-b border-slate-700 flex items-center justify-between bg-slate-800/30">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useRAGMode}
              onChange={(e) => setUseRAGMode(e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 bg-slate-700 
                       text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
            />
            <span className="text-xs text-slate-400">
              🔍 RAG Mode (search documents)
            </span>
          </label>
        </div>

        {retrievedContext && retrievedContext.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-emerald-400">
            <span>📎</span>
            <span>
              Using {retrievedContext.length} document chunk
              {retrievedContext.length > 1 ? 's' : ''}
            </span>
            <button
              onClick={() => setRetrievedContext(null)}
              className="text-slate-500 hover:text-slate-300"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}>
              <p className="whitespace-pre-wrap text-sm">{msg.content}</p>

              {/* Show RAG sources */}
              {msg.metadata?.contextSources?.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-600/50">
                  <p className="text-xs text-slate-400 mb-1">Sources:</p>
                  {msg.metadata.contextSources.map((source, i) => (
                    <span
                      key={i}
                      className="inline-block text-xs bg-slate-600 text-slate-300 
                               px-2 py-0.5 rounded mr-1 mb-1"
                    >
                      📄 {source}
                    </span>
                  ))}
                </div>
              )}

              <p className="text-xs opacity-60 mt-1">
                {new Date(msg.timestamp).toLocaleTimeString()}
                {msg.metadata?.ragUsed && ' · RAG'}
              </p>
            </div>
          </div>
        ))}

        {/* Streaming response */}
        {isGenerating && streamingContent && (
          <div className="flex justify-start">
            <div className="chat-bubble-ai">
              <p className="whitespace-pre-wrap text-sm">
                {streamingContent}
                <span className="animate-pulse ml-1">▊</span>
              </p>
            </div>
          </div>
        )}

        {isGenerating && !streamingContent && (
          <div className="flex justify-start">
            <div className="chat-bubble-ai">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-slate-700">
        <div className="flex gap-3 max-w-3xl mx-auto">
          <div className="flex flex-col gap-2 flex-1">
            <div className="flex items-center gap-2">
              <AudioRecorder onTranscriptionComplete={handleTranscription} />
            </div>
            <div className="flex gap-3"></div>
             <textarea
               value={input}
               onChange={(e) => setInput(e.target.value)}
               onKeyDown={handleKeyDown}
               placeholder={
                useRAGMode
                    ? 'Ask about your documents... (Enter to send)'
                    : 'Type your message... (Enter to send)'
                }
            rows={1}
            className="flex-1 bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-sm
                     text-slate-100 placeholder-slate-500 resize-none
                     focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            disabled={isGenerating}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isGenerating}
            className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 
                     disabled:text-slate-500 text-white rounded-xl transition-colors
                     font-medium text-sm flex items-center gap-2"
          >
            {isGenerating ? (
              <>
                <span className="animate-spin">⏳</span> Thinking
              </>
            ) : (
              <>
                Send <span>→</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
    </div>
  );
}

function Feature({ icon, title, desc }) {
  return (
    <div className="flex gap-3 p-3 rounded-lg bg-slate-800/50">
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-sm font-medium text-slate-200">{title}</p>
        <p className="text-xs text-slate-500">{desc}</p>
      </div>
    </div>
  );
}
