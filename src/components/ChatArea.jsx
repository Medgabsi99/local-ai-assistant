import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  getConversationMessages,
  addMessage,
  deleteMessage,
  updateConversationTitle,
  getSetting,
  setSetting,
} from "../db/database";
import { ai } from "../workers/worker-bridge";
import { useRAG } from "../hooks/useRAG";
import { getServerConfig, generate } from "../lib/llm-server";
import { searchWeb } from "../lib/web-search";
import { t } from "../lib/i18n";
import AudioRecorder from "./AudioRecorder";

function CodeBlock({ className, children }) {
  const match = /language-(\w+)/.exec(className || "");
  const lang = match ? match[1] : "";
  const code = String(children).replace(/\n$/, "");
  if (!lang) return <code className="bg-slate-700/60 px-1 py-0.5 rounded text-emerald-300 text-[13px]">{code}</code>;
  return (
    <div className="my-3 rounded-xl overflow-hidden border border-slate-700/60">
      <div className="flex items-center justify-between px-4 py-1.5 bg-slate-800 text-[11px] text-slate-500">
        <span>{lang}</span>
        <button onClick={() => navigator.clipboard.writeText(code)} className="hover:text-slate-300 transition-colors">📋</button>
      </div>
      <SyntaxHighlighter style={oneDark} language={lang} PreTag="div" customStyle={{ margin: 0, borderRadius: 0, fontSize: "13px" }}>{code}</SyntaxHighlighter>
    </div>
  );
}

export default function ChatArea({ conversationId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [useRAGMode, setUseRAGMode] = useState(true);
  const [retrievedContext, setRetrievedContext] = useState(null);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [searchIndex, setSearchIndex] = useState(0);
  const [theme, setTheme] = useState("dark");
  const [embeddingModelReady, setEmbeddingModelReady] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [webResults, setWebResults] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const messagesRef = useRef(null);
  const abortRef = useRef(null);
  const searchInputRef = useRef(null);
  const { searchSimilar } = useRAG();

  useEffect(() => { (async () => {
    const [themeS, promptS, accentS] = await Promise.all([getSetting("theme"), getSetting("systemPrompt"), getSetting("accent")]);
    if (themeS?.value) setTheme(themeS.value);
    if (promptS?.value) setSystemPrompt(promptS.value);
    if (accentS?.value) document.documentElement.setAttribute("data-accent", accentS.value);
  })(); }, []);

  useEffect(() => { let c = false; const check = async () => { try { const r = await ai.checkModel("embedding"); if (!c) setEmbeddingModelReady(r?.loaded || false); } catch {} }; check(); const i = setInterval(check, 3000); return () => { c = true; clearInterval(i); }; }, []);
  useEffect(() => { document.documentElement.classList.toggle("light", theme === "light"); }, [theme]);

  const toggleTheme = async () => { const n = theme === "dark" ? "light" : "dark"; setTheme(n); await setSetting("theme", n); };
  const handleTranscription = (t) => setInput(p => p + (p ? " " : "") + t);
  const loadMessages = useCallback(async () => { if (conversationId) { setMessages(await getConversationMessages(conversationId)); } else { setMessages([]); } }, [conversationId]);
  const saveSystemPrompt = async (v) => { setSystemPrompt(v); await setSetting("systemPrompt", v); };
  useEffect(() => { loadMessages(); }, [loadMessages]);
  useEffect(() => { if (!userScrolledUp) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, streamingContent, userScrolledUp]);
  useEffect(() => { if (!isGenerating) inputRef.current?.focus(); }, [isGenerating]);
  useEffect(() => { if (showSearch) searchInputRef.current?.focus(); }, [showSearch]);

  const handleScroll = useCallback(() => { const el = messagesRef.current; if (!el) return; setUserScrolledUp(el.scrollHeight - el.scrollTop - el.clientHeight > 80); }, []);
  const filteredMessages = useMemo(() => { if (!searchQuery.trim()) return messages; const q = searchQuery.toLowerCase(); return messages.filter(m => m.content.toLowerCase().includes(q)); }, [messages, searchQuery]);
  const searchResults = searchQuery.trim() ? filteredMessages : [];
  const activeSearchId = searchResults.length > 0 ? searchResults[searchIndex]?.id : null;
  useEffect(() => { if (activeSearchId) { const el = document.getElementById(`msg-${activeSearchId}`); el?.scrollIntoView({ behavior: "smooth", block: "center" }); } }, [activeSearchId, searchIndex]);

  const stopGeneration = () => { setIsGenerating(false); };
  const copyMessage = async (content) => { try { await navigator.clipboard.writeText(content); } catch {} };
  const startEdit = (msg) => { setEditingMessageId(msg.id); setEditContent(msg.content); };
  const cancelEdit = () => { setEditingMessageId(null); setEditContent(""); };
  const saveEdit = async (msgId) => { if (!editContent.trim()) return; await deleteMessage(msgId); await addMessage(conversationId, "user", editContent.trim()); setEditingMessageId(null); setEditContent(""); await loadMessages(); await sendMessage(editContent.trim()); };
  const deleteMsg = async (msgId) => { await deleteMessage(msgId); await loadMessages(); };
  const handleSend = () => { if (!input.trim() || isGenerating) return; const msg = input.trim(); setInput(""); sendMessage(msg); };

  const sendMessage = async (userMessage) => {
    const inferenceStartTime = Date.now();
    await addMessage(conversationId, "user", userMessage);
    await loadMessages();
    setIsGenerating(true); setStreamingContent(""); setRetrievedContext(null); setWebResults(null);
    try {
      let context = null;
      if (useRAGMode) { try { const c = await searchSimilar(userMessage, 3); if (c.length > 0) { context = c.map(x => x.content); setRetrievedContext(c); } } catch (e) { console.warn("RAG:", e); } }
      let webContext = null;
      if (webSearchEnabled && (!context || context.length === 0)) {
        const results = await searchWeb(userMessage);
        if (results?.length) { webContext = results.map(r => `[${r.title}] ${r.snippet}`).join("\n\n"); setWebResults(results); }
      }
      const serverConfig = getServerConfig();
      const useServer = serverConfig.enabled;
      let fullResponse = ""; let usedModel = "browser";
      if (useServer) {
        usedModel = "server"; let prompt = "";
        if (systemPrompt) prompt += `System: ${systemPrompt}\n\n`;
        if (context?.length) prompt += `Context:\n${context.join("\n\n")}\n\n`;
        if (webContext) prompt += `Web search results:\n${webContext}\n\n`;
        const recent = messages.slice(-6);
        for (const msg of recent) prompt += msg.role === "user" ? `User: ${msg.content}\n` : `Assistant: ${msg.content}\n`;
        prompt += `User: ${userMessage}\nAssistant: `;
        try { await generate(prompt, { onToken: (t) => { fullResponse += t; setStreamingContent(fullResponse); }, maxTokens: 2048, temperature: 0.3 }); } catch (e) { fullResponse = `Server error: ${e.message}.`; }
      } else {
        let prompt = systemPrompt ? `Instructions: ${systemPrompt}\n\n` : "";
        let history = ""; const recent = messages.slice(-6);
        for (const msg of recent) history += msg.role === "user" ? `${msg.content}\n` : `${msg.content}\n`;
        if (history.length > 500) history = "...\n" + history.slice(-500);
        prompt += history;
        if (context?.length) prompt += `Context:\n${context.join("\n\n")}\n\n`;
        if (webContext) prompt += `Web results:\n${webContext}\n\n`;
        prompt += `Question: ${userMessage}\nAnswer:`;
        const result = await ai.runInference({ modelName: "llm", input: prompt, maxTokens: 512, temperature: 0.3 }, { onToken: (t) => { fullResponse += t; setStreamingContent(fullResponse); } });
        if (result?.result) fullResponse = result.result;
      }
      const timeMs = Date.now() - inferenceStartTime;
      await addMessage(conversationId, "assistant", fullResponse || "(no response)", { model: usedModel, ragUsed: !!context, webUsed: !!webContext, timeMs, contextSources: context ? retrievedContext?.map((c) => c.documentTitle) || [] : [] });
      setStreamingContent("");
      if (messages.length === 0) {
        const fallback = userMessage.slice(0, 50) + (userMessage.length > 50 ? "..." : "");
        const title = fullResponse ? fullResponse.replace(/<[^>]*>/g, "").slice(0, 50).trim() : fallback;
        await updateConversationTitle(conversationId, title || fallback);
      }
      await loadMessages();
    } catch (error) { console.error(error); } finally { setIsGenerating(false); }
  };

  const handleKeyDown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } };
  const regenerate = async () => { if (messages.length < 2) return; const lastAi = [...messages].reverse().find(m => m.role === "assistant"); const lastUser = [...messages].reverse().find(m => m.role === "user"); if (!lastAi || !lastUser) return; await deleteMessage(lastAi.id); await loadMessages(); sendMessage(lastUser.content); };

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") { e.preventDefault(); setShowSearch(s => !s); if (!showSearch) setTimeout(() => searchInputRef.current?.focus(), 100); }
      if (e.key === "Escape") { setShowSearch(false); setSearchQuery(""); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showSearch]);

  if (!conversationId) {
    return (
      <div className="h-full flex items-center justify-center p-8 overflow-y-auto">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-3xl">🔒</div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>{t('app_name')}</h1>
          <p style={{ color: "var(--text-muted)" }} className="text-sm mb-8 leading-relaxed">{t('all_data_device')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b flex items-center justify-between flex-shrink-0 gap-2" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
        <label className="flex items-center gap-2 cursor-pointer select-none flex-shrink-0">
          <input type="checkbox" checked={useRAGMode} onChange={(e) => setUseRAGMode(e.target.checked)} className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500/30 focus:ring-offset-0 cursor-pointer" />
          <span className={`text-xs font-medium ${useRAGMode ? "text-emerald-400" : ""}`} style={{ color: useRAGMode ? "#34d399" : "var(--text-muted)" }}>{t('rag_mode')}</span>
          {useRAGMode && !embeddingModelReady && <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full whitespace-nowrap">{t('no_embedding')}</span>}
        </label>
        <button onClick={() => setShowSystemPrompt(!showSystemPrompt)} className={`text-xs px-2 py-1 rounded-md transition-colors ${systemPrompt ? "text-emerald-400 bg-emerald-500/10" : ""}`} style={{ color: systemPrompt ? undefined : "var(--text-secondary)" }}>🧠 {t('system')}</button>
        <div className="flex items-center gap-1 ml-auto">
          <button onClick={() => { setWebSearchEnabled(!webSearchEnabled); setWebResults(null); }} className={`text-xs px-2 py-1 rounded-md hover:bg-white/5 transition-colors ${webSearchEnabled ? "bg-emerald-500/20 text-emerald-400" : ""}`} style={{ color: webSearchEnabled ? undefined : "var(--text-muted)" }} title={t('web_search')}>🌐</button>
          <button onClick={() => setShowSearch(!showSearch)} className="text-xs px-2 py-1 rounded-md hover:bg-white/5" style={{ color: "var(--text-muted)" }} title={t('search')}>🔍</button>
          <button onClick={toggleTheme} className="text-xs px-2 py-1 rounded-md hover:bg-white/5" style={{ color: "var(--text-muted)" }}>{theme === "dark" ? "☀️" : "🌙"}</button>
          <button onClick={() => setShowTemplates(!showTemplates)} className="text-xs px-2 py-1 rounded-md hover:bg-white/5" style={{ color: "var(--text-muted)" }} title={t('prompt_templates')}>📋</button>
          {messages.length > 0 && <button onClick={() => setShowShareModal(true)} className="text-xs px-2 py-1 rounded-md hover:bg-white/5" style={{ color: "var(--text-muted)" }}>{t('share')}</button>}
          {messages.length > 1 && <button onClick={regenerate} disabled={isGenerating} className="text-xs disabled:opacity-40 px-2 py-1 rounded-md hover:bg-white/5" style={{ color: "var(--text-muted)" }}>{t('regenerate')}</button>}
        </div>
      </div>

      {showSearch && (
        <div className="px-4 py-2 border-b flex-shrink-0" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <input ref={searchInputRef} value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setSearchIndex(0); }} placeholder={t('search_messages')} className="flex-1 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-emerald-500/50" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            <span className="text-xs w-12" style={{ color: "var(--text-muted)" }}>{searchResults.length > 0 ? `${searchIndex + 1}/${searchResults.length}` : "0/0"}</span>
            <button onClick={() => setSearchIndex(i => Math.max(0, i - 1))} disabled={searchResults.length === 0} className="text-xs disabled:opacity-30 px-2" style={{ color: "var(--text-muted)" }}>▲</button>
            <button onClick={() => setSearchIndex(i => Math.min(searchResults.length - 1, i + 1))} disabled={searchResults.length === 0} className="text-xs disabled:opacity-30 px-2" style={{ color: "var(--text-muted)" }}>▼</button>
            <button onClick={() => { setShowSearch(false); setSearchQuery(""); }} className="text-xs px-2" style={{ color: "var(--text-muted)" }}>✕</button>
          </div>
        </div>
      )}

      {showSystemPrompt && (
        <div className="px-4 py-2 border-b flex-shrink-0" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--bg-primary) 95%, transparent)" }}>
          <p className="text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>{t('system_prompt_short')}</p>
          <div className="flex gap-2 mb-2">
            <textarea value={systemPrompt} onChange={(e) => saveSystemPrompt(e.target.value)} placeholder={t('type_placeholder')} rows={2} className="w-full rounded-lg px-3 py-1.5 text-xs outline-none focus:border-emerald-500/50 resize-none" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            <button onClick={() => { saveSystemPrompt(""); setShowSystemPrompt(false); }} className="text-xs px-2 py-1 rounded-md hover:bg-white/5 flex-shrink-0" style={{ color: "var(--text-muted)" }}>{t('clear')}</button>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {[{ label: t('presets_concise'), value: t('concise') }, { label: t('presets_expert'), value: t('expert') }, { label: t('presets_translate'), value: t('translate_fr') }, { label: t('presets_step'), value: t('step_by_step') }].map((preset) => (
              <button key={preset.label} onClick={() => saveSystemPrompt(preset.value)} className={`text-[10px] px-2 py-1 rounded-md transition-colors ${systemPrompt === preset.value ? "bg-emerald-500/20 text-emerald-300" : ""}`} style={{ background: systemPrompt === preset.value ? undefined : "var(--bg-hover)", color: systemPrompt === preset.value ? undefined : "var(--text-muted)" }}>{preset.label}</button>
            ))}
          </div>
        </div>
      )}

      {showShareModal && (
        <div className="px-4 py-2 border-b flex-shrink-0" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--bg-primary) 95%, transparent)" }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>{t('share')} ({t('messages_count', { n: messages.filter(m => m.role === "user" || m.role === "assistant").length })})</p>
            <button onClick={() => setShowShareModal(false)} className="text-xs px-2 py-0.5 rounded hover:bg-white/5" style={{ color: "var(--text-muted)" }}>✕</button>
          </div>
          <div className="flex gap-2">
            <button onClick={async () => { await navigator.clipboard.writeText(messages.map(m => `${m.role === "user" ? t('copy') : "AI"}:\n${m.content}`).join("\n\n")); setShowShareModal(false); }} className="text-[11px] px-3 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-400 text-white">{t('share_copy')}</button>
            <button onClick={async () => { const md = messages.map(m => `### ${m.role === "user" ? t('copy') : "AI"}\n${m.content}`).join("\n\n---\n\n"); const b = new Blob([md], { type: "text/markdown" }); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = `chat-${new Date().toISOString().slice(0, 10)}.md`; a.click(); URL.revokeObjectURL(u); setShowShareModal(false); }} className="text-[11px] px-3 py-1.5 rounded-md hover:bg-white/5" style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}>{t('share_download')}</button>
          </div>
        </div>
      )}

      <div ref={messagesRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        {messages.length === 0 && !isGenerating && <div className="flex items-center justify-center h-full"><p className="text-sm" style={{ color: "var(--text-muted)" }}>{t('no_messages')}</p></div>}
        {messages.map((msg) => (
          <div key={msg.id} id={`msg-${msg.id}`} className={`group flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in ${activeSearchId === msg.id ? "ring-2 ring-emerald-500/40 ring-offset-2 rounded-xl" : ""}`} style={{ ringOffsetColor: "var(--bg-primary)" }}>
            <div className="max-w-[80%]">
              {editingMessageId === msg.id ? (
                <div className="border border-emerald-500/30 rounded-xl p-3" style={{ background: "var(--bg-secondary)" }}>
                  <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="w-full bg-transparent text-sm outline-none resize-none mb-2" rows={3} style={{ color: "var(--text-primary)" }} />
                  <div className="flex gap-2 justify-end">
                    <button onClick={cancelEdit} className="text-xs px-2 py-1 rounded hover:bg-white/5" style={{ color: "var(--text-secondary)" }}>{t('cancel_label')}</button>
                    <button onClick={() => saveEdit(msg.id)} className="text-xs bg-emerald-500 hover:bg-emerald-400 text-white px-3 py-1 rounded-md">{t('save_send')}</button>
                  </div>
                </div>
              ) : (
                <div className={msg.role === "user" ? "msg-user" : "msg-ai"}>
                  <div className="prose prose-invert prose-sm max-w-none prose-code:before:content-none prose-code:after:content-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code({ node, inline, className, children, ...props }) { if (inline) return <code className="bg-slate-700/60 px-1 py-0.5 rounded text-emerald-300 text-[13px]" {...props}>{children}</code>; return <CodeBlock className={className}>{children}</CodeBlock>; } }}>{msg.content}</ReactMarkdown>
                  </div>
                  {msg.metadata?.contextSources?.length > 0 && <p className="mt-2 pt-2 border-t border-slate-600/30 text-xs text-slate-400">{t('sources')} {msg.metadata.contextSources.join(", ")}</p>}
                </div>
              )}
              {editingMessageId !== msg.id && (
                <div className={`flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <button onClick={() => { if ("speechSynthesis" in window) { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(msg.content.replace(/<[^>]*>/g, "")); const voices = window.speechSynthesis.getVoices(); const v = voices.find(x => x.name.includes("Google UK Female") || x.name.includes("Microsoft Zira") || x.name.includes("Samantha")) || voices.find(x => x.lang.startsWith("en") && x.name.includes("Female")) || voices.find(x => x.lang.startsWith("en")); if (v) u.voice = v; u.rate = 1.05; u.pitch = 1.05; window.speechSynthesis.speak(u); } }} className="text-[10px] px-1.5 py-0.5 rounded hover:bg-white/5" style={{ color: "var(--text-muted)" }} title={t('read_aloud')}>🔊</button>
                  )}
                  <button onClick={() => copyMessage(msg.content)} className="text-[10px] px-1.5 py-0.5 rounded hover:bg-white/5" style={{ color: "var(--text-muted)" }} title={t('copy')}>📋</button>
                  {msg.role === "user" && <button onClick={() => startEdit(msg)} className="text-[10px] px-1.5 py-0.5 rounded hover:bg-white/5" style={{ color: "var(--text-muted)" }} title={t('edit')}>✏️</button>}
                  <button onClick={() => deleteMsg(msg.id)} className="text-[10px] px-1.5 py-0.5 rounded hover:bg-white/5" style={{ color: "var(--text-muted)" }} title={t('del')}>🗑️</button>
                  <span className="text-[10px] ml-1" style={{ color: "var(--text-muted)" }}>
                    {msg.metadata?.timeMs ? `${(msg.metadata.timeMs / 1000).toFixed(1)}s · ` : ""}
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}

        {isGenerating && (
          <div className="flex justify-start animate-fade-in">
            <div className="max-w-[80%]">
              <div className="msg-ai">
                {streamingContent ? (
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code({ node, inline, className, children, ...props }) { if (inline) return <code className="bg-slate-700/60 px-1 py-0.5 rounded text-emerald-300 text-[13px]" {...props}>{children}</code>; return <CodeBlock className={className}>{children}</CodeBlock>; } }}>{streamingContent}</ReactMarkdown>
                    <span className="inline-block w-1.5 h-4 bg-emerald-400 ml-0.5 animate-pulse rounded-sm align-middle" />
                  </div>
                ) : (
                  <div className="flex gap-1.5 py-2">
                    <span className="typing-dot" style={{ animationDelay: "0ms" }} />
                    <span className="typing-dot" style={{ animationDelay: "150ms" }} />
                    <span className="typing-dot" style={{ animationDelay: "300ms" }} />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="px-4 py-3 border-t flex-shrink-0" style={{ borderColor: "var(--border)", background: "var(--bg-primary)" }}>
        <div className="flex gap-2 max-w-4xl mx-auto">
          <AudioRecorder onTranscriptionComplete={handleTranscription} />
          <div className="flex-1 flex gap-2">
            <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder={useRAGMode ? t('ask_documents') : t('type_message')} rows={1} className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all duration-200 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10 min-h-[42px] max-h-32 resize-none" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }} disabled={isGenerating} />
            {isGenerating ? (
              <button onClick={stopGeneration} className="inline-flex items-center justify-center rounded-xl font-medium text-sm transition-all h-[42px] w-[42px] p-0 bg-red-500 hover:bg-red-400 text-white"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg></button>
            ) : (
              <button onClick={handleSend} disabled={!input.trim()} className="inline-flex items-center justify-center rounded-xl font-medium text-sm transition-all duration-200 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none h-[42px] w-[42px] p-0 bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}