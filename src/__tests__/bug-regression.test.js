import { describe, it, expect } from 'vitest';
import { detectTool, executeTool, safeEval } from '../lib/agent-tools';

// Regression tests for bugs found and fixed in Section 4
describe('BUG REGRESSION: Calculator (^ operator)', () => {
  it('2^10 should return 1024 (not 8 — XOR vs exponentiation)', () => {
    const result = detectTool('2^10');
    expect(result).not.toBeNull();
    expect(result.tool).toBe('calculator');
    expect(result.args.result).toBe(1024);
  });

  it('10^2 should return 100', () => {
    const result = detectTool('10^2');
    expect(result).not.toBeNull();
    expect(result.args.result).toBe(100);
  });

  it('2^3 should return 8', () => {
    const result = detectTool('2^3');
    expect(result).not.toBeNull();
    expect(result.args.result).toBe(8);
  });
});

describe('BUG REGRESSION: Plain number hijacking', () => {
  it('"2024" should NOT trigger calculator tool', () => {
    const result = detectTool('2024');
    expect(result).toBeNull();
  });

  it('"123456" should NOT trigger calculator tool', () => {
    const result = detectTool('123456');
    expect(result).toBeNull();
  });

  it('"42" should NOT trigger calculator tool', () => {
    const result = detectTool('42');
    expect(result).toBeNull();
  });
});

describe('BUG REGRESSION: sfeEval edge cases', () => {
  it('handles division by zero gracefully', () => {
    const result = safeEval('1/0');
    expect(result).toBeNull(); // Infinity is not finite
  });

  it('handles empty string', () => {
    const result = safeEval('');
    expect(result).toBeNull();
  });

  it('handles just a decimal point', () => {
    const result = safeEval('.');
    expect(result).toBeNull();
  });

  it('handles invalid characters', () => {
    const result = safeEval('2+2; alert("x")');
    expect(result).toBeNull(); // semicolon stripped, alert removed
  });

  it('handles very long expressions', () => {
    const long = '1+'.repeat(100) + '1';
    const result = safeEval(long);
    expect(result).toBe(101);
  });
});

describe('BUG REGRESSION: executeTool outputs', () => {
  it('calculator output contains result', async () => {
    const result = await executeTool({
      tool: 'calculator',
      args: { expression: '2^10', result: 1024 },
    });
    expect(result).toContain('1024');
    expect(result).toContain('2^10');
  });

  it('converter output contains value and unit', async () => {
    const result = await executeTool({
      tool: 'converter',
      args: { value: 100, from: 'km', to: 'm', result: 100000 },
    });
    expect(result).toContain('100');
    expect(result).toContain('km');
    expect(result).toContain('m');
  });

  it('datetime output is never empty', async () => {
    const result = await executeTool({
      tool: 'datetime',
      args: { format: 'full', result: 'test output' },
    });
    expect(result.length).toBeGreaterThan(0);
  });
});