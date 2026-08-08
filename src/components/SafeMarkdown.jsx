import { lazy, Suspense } from 'react';
import { isSafeLinkHref } from '../lib/security';
import MarkdownImage from './MarkdownImage';

const MarkdownRenderer = lazy(() =>
  Promise.all([import('react-markdown'), import('remark-gfm')]).then(([reactMarkdownModule, remarkGfmModule]) => {
    const ReactMarkdown = reactMarkdownModule.default;
    const remarkGfm = remarkGfmModule.default;

    function MarkdownRendererImpl({ children, CodeBlock }) {
      return (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a({ href, children: linkChildren, ...props }) {
              if (!isSafeLinkHref(href)) {
                return <span {...props}>{linkChildren}</span>;
              }

              return (
                <a href={href} {...props}>
                  {linkChildren}
                </a>
              );
            },
            img({ src, alt }) {
              return <MarkdownImage src={src} alt={alt} />;
            },
            code({ inline, className, children: codeChildren, ...props }) {
              if (inline)
                return (
                  <code className="bg-slate-700/60 px-1 py-0.5 rounded text-emerald-300 text-[13px]" {...props}>
                    {codeChildren}
                  </code>
                );

              if (CodeBlock) {
                return <CodeBlock className={className}>{codeChildren}</CodeBlock>;
              }

              return <code {...props}>{codeChildren}</code>;
            },
          }}
        >
          {children}
        </ReactMarkdown>
      );
    }

    return { default: MarkdownRendererImpl };
  }),
);

export default function SafeMarkdown({ children, CodeBlock }) {
  return (
    <Suspense fallback={<span className="whitespace-pre-wrap">{children}</span>}>
      <MarkdownRenderer CodeBlock={CodeBlock}>{children}</MarkdownRenderer>
    </Suspense>
  );
}
