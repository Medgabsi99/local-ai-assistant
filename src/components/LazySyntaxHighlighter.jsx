// ============================================================
// Lazy-loaded Syntax Highlighter
// Reduces initial bundle size by ~200KB by loading
// react-syntax-highlighter only when a code block is rendered
// ============================================================

import { lazy, Suspense } from 'react';

const SyntaxHighlighter = lazy(() =>
  import('react-syntax-highlighter').then((mod) => ({
    default: mod.Prism,
  })),
);

const oneDark = lazy(() =>
  import('react-syntax-highlighter/dist/esm/styles/prism').then((mod) => ({
    default: mod.oneDark,
  })),
);

export default function LazyCodeBlock({ className, children }) {
  const match = /language-(\w+)/.exec(className || '');
  const lang = match ? match[1] : '';
  const code = String(children).replace(/\n$/, '');

  if (!lang) {
    return (
      <code className="bg-slate-700/60 px-1 py-0.5 rounded text-emerald-300 text-[13px]">
        {code}
      </code>
    );
  }

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-slate-700/60">
      <div className="flex items-center justify-between px-4 py-1.5 bg-slate-800 text-[11px] text-slate-500">
        <span>{lang}</span>
        <button
          onClick={() => navigator.clipboard.writeText(code)}
          className="hover:text-slate-300 transition-colors"
          aria-label="Copy code"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </button>
      </div>
      <Suspense
        fallback={
          <pre className="p-4 text-sm bg-slate-900 overflow-x-auto">
            <code className="text-slate-300">{code}</code>
          </pre>
        }
      >
        <SyntaxHighlighter
          style={oneDark}
          language={lang}
          PreTag="div"
          customStyle={{ margin: 0, borderRadius: 0, fontSize: '13px' }}
        >
          {code}
        </SyntaxHighlighter>
      </Suspense>
    </div>
  );
}