import { describe, it, expect } from 'vitest';
import { detectTool, executeTool, safeEval, convertUnits, getDateTime } from '../lib/agent-tools';

describe('safeEval', () => {
  it('evaluates simple math', () => {
    expect(safeEval('2 + 2')).toBe(4);
  });

  it('evaluates complex expressions', () => {
    expect(safeEval('(5 * 3) + 2')).toBe(17);
  });

  it('returns null for invalid expressions', () => {
    expect(safeEval('not math')).toBeNull();
  });
});

describe('convertUnits', () => {
  it('converts km to m', () => {
    expect(convertUnits(1, 'km', 'm')).toBe(1000);
  });

  it('converts celsius to fahrenheit', () => {
    expect(convertUnits(0, 'c', 'f')).toBe(32);
    expect(convertUnits(100, 'c', 'f')).toBe(212);
  });

  it('converts kg to lb', () => {
    expect(convertUnits(1, 'kg', 'lb')).toBeCloseTo(2.2, 0);
  });

  it('returns null for unsupported conversions', () => {
    expect(convertUnits(1, 'km', 'c')).toBeNull();
  });
});

describe('detectTool', () => {
  it('detects calculator for math expressions', () => {
    const result = detectTool('25 * 4 + 10');
    expect(result).not.toBeNull();
    expect(result.tool).toBe('calculator');
    expect(result.args.result).toBe(110);
  });

  it('detects calculator with "calculate" keyword', () => {
    const result = detectTool('calculate 15 percent of 200');
    expect(result).not.toBeNull();
    expect(result.tool).toBe('calculator');
  });

  it('detects unit conversion', () => {
    const result = detectTool('100 km to miles');
    expect(result).not.toBeNull();
    expect(result.tool).toBe('converter');
  });

  it('detects datetime for time queries', () => {
    const result = detectTool('what time is it');
    expect(result).not.toBeNull();
    expect(result.tool).toBe('datetime');
  });

  it('detects datetime for date queries', () => {
    const result = detectTool('current date');
    expect(result).not.toBeNull();
    expect(result.tool).toBe('datetime');
  });

  it('returns null for normal questions', () => {
    const result = detectTool('what is artificial intelligence');
    expect(result).toBeNull();
  });
});

describe('executeTool', () => {
  it('executes calculator tool', async () => {
    const result = await executeTool({ tool: 'calculator', args: { expression: '5 * 3', result: 15 } });
    expect(result).toContain('15');
  });

  it('executes converter tool', async () => {
    const result = await executeTool({ tool: 'converter', args: { value: 100, from: 'km', to: 'm', result: 100000 } });
    expect(result).toContain('100000');
  });

  it('executes datetime tool', async () => {
    const result = await executeTool({ tool: 'datetime', args: { format: 'full', result: 'test' } });
    expect(result).toContain('test');
  });

  it('returns null for unknown tool', async () => {
    const result = await executeTool({ tool: 'unknown', args: {} });
    expect(result).toBeNull();
  });

  it('returns null for null input', async () => {
    const result = await executeTool(null);
    expect(result).toBeNull();
  });
});

describe('getDateTime', () => {
  it('returns a date string for date format', () => {
    const result = getDateTime('date');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns a time string for time format', () => {
    const result = getDateTime('time');
    expect(typeof result).toBe('string');
  });

  it('returns full format by default', () => {
    const result = getDateTime();
    expect(typeof result).toBe('string');
  });
});
