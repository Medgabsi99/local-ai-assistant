import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SafeMarkdown from '../components/SafeMarkdown';

describe('SafeMarkdown', () => {
  it('renders same-origin absolute links as clickable', () => {
    render(<SafeMarkdown>{`[absolute](${window.location.origin}/docs)`}</SafeMarkdown>);

    expect(screen.getByRole('link', { name: 'absolute' })).toHaveAttribute('href', `${window.location.origin}/docs`);
  });

  it('renders same-origin links and blocks external links', () => {
    render(<SafeMarkdown>{'[internal](/docs) [external](https://example.com)'}</SafeMarkdown>);

    expect(screen.getByRole('link', { name: 'internal' })).toHaveAttribute('href', '/docs');
    expect(screen.queryByRole('link', { name: 'external' })).toBeNull();
    expect(screen.getByText('external')).toBeDefined();
  });

  it('blocks non-http protocols and protocol-relative links', () => {
    render(<SafeMarkdown>{'[mail](mailto:test@example.com) [proto](//example.com)'}</SafeMarkdown>);

    expect(screen.queryByRole('link', { name: 'mail' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'proto' })).toBeNull();
    expect(screen.getByText('mail')).toBeDefined();
    expect(screen.getByText('proto')).toBeDefined();
  });

  it('renders inline code without a custom code block renderer', () => {
    render(<SafeMarkdown>{'Use `safe` code'}</SafeMarkdown>);

    expect(screen.getByText('safe')).toBeDefined();
  });

  it('renders fenced code through the provided code block component', () => {
    const CodeBlock = ({ children }) => <pre data-testid="code-block">{children}</pre>;

    render(<SafeMarkdown CodeBlock={CodeBlock}>{'```js\nconsole.log("ok")\n```'}</SafeMarkdown>);

    expect(screen.getByTestId('code-block')).toHaveTextContent('console.log("ok")');
  });

  it('blocks remote markdown images', () => {
    render(<SafeMarkdown>{'![remote](https://example.com/image.png)'}</SafeMarkdown>);

    expect(screen.queryByRole('img', { name: 'remote' })).toBeNull();
  });

  it('blocks malformed img references', () => {
    render(<SafeMarkdown>{'![broken](img:not-a-number)'}</SafeMarkdown>);

    expect(screen.queryByRole('img', { name: 'broken' })).toBeNull();
  });
});
