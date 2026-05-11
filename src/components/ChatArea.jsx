import { useState, useEffect, useRef } from 'react';
import {
  getConversationMessages,
  addMessage,
} from '../db/database';
import { sendToWorker } from '../workers/worker-bridge';

export default function ChatArea({ conversationId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (conversationId) {
      loadMessages();
    } else {
      setMessages([]);
    }
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const loadMessages = async () => {
    const msgs = await getConversationMessages(conversationId);
    setMessages(msgs);
  };

  const handleSend = async () => {
    if (!input.trim() || isGenerating) return;

    const userMessage = input.trim();
    setInput('');

    // Add user message
    await addMessage(conversationId, 'user', userMessage);
    await loadMessages();

    // Generate AI response
    setIsGenerating(true);
    setStreamingContent('');

    let fullResponse = '';

    try {
      await sendToWorker(
        'RUN_INFERENCE',
        {
          modelName: 'llm',
          input: userMessage,
        },
        {
          onToken: (token) => {
            fullResponse += token;
            setStreamingContent(fullResponse);
          },
        }
      );

      // Save complete response
      await addMessage(conversationId, 'assistant', fullResponse, {
        model: 'local-llm',
      });
      setStreamingContent('');
      await loadMessages();
    } catch (error) {
      await addMessage(
        conversationId,
        'assistant',
        `Error: ${error.message}. Make sure the model is loaded in the sidebar.`,
        { error: true }
      );
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

  // Welcome screen when no conversation is selected
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
            No data ever leaves your browser.
          </p>
          <div className="grid grid-cols-2 gap-4 text-left">
            <Feature icon="📄" title="Document Q&A" desc="Ask questions about your files" />
            <Feature icon="🎤" title="Transcribe Audio" desc="Convert speech to text locally" />
            <Feature icon="💬" title="Chat" desc="Conversations stored privately" />
            <Feature icon="📡" title="Works Offline" desc="No internet required" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}>
              <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
              <p className="text-xs opacity-60 mt-1">
                {new Date(msg.timestamp).toLocaleTimeString()}
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
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
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
