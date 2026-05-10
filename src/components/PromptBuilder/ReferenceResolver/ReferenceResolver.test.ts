
import { describe, it, expect } from 'vitest';
import { extractFileMentions } from './extractor';
import { resolveAllDependencies } from './ReferenceResolver';

describe('extractor', () => {
  it('should extract single mention', () => {
    const content = 'Check out @src/main.ts for more info.';
    const mentions = extractFileMentions(content);
    expect(mentions).toEqual(['src/main.ts']);
  });

  it('should extract multiple mentions', () => {
    const content = 'See @README.md and @src/utils.ts.';
    const mentions = extractFileMentions(content);
    expect(mentions).toEqual(['README.md', 'src/utils.ts']);
  });

  it('should return empty array if no mentions', () => {
    const content = 'No mentions here.';
    const mentions = extractFileMentions(content);
    expect(mentions).toEqual([]);
  });
});

describe('ReferenceResolver', () => {
  it('should resolve dependencies without cycles', async () => {
    const mockFs: Record<string, string> = {
      'fileA': 'Refers to @fileB',
      'fileB': 'Refers to @fileC',
      'fileC': 'No references',
    };
    
    const readFileProvider = async (path: string) => {
      if (mockFs[path]) return mockFs[path];
      throw new Error('Not found');
    };

    const result = await resolveAllDependencies(['fileA'], readFileProvider);
    expect(result).toEqual(['fileA', 'fileB', 'fileC']);
  });

  it('should handle cyclic dependencies without infinite loops', async () => {
    const mockFs: Record<string, string> = {
      'fileA': 'Refers to @fileB',
      'fileB': 'Refers to @fileA',
    };
    
    const readFileProvider = async (path: string) => {
      if (mockFs[path]) return mockFs[path];
      throw new Error('Not found');
    };

    const result = await resolveAllDependencies(['fileA'], readFileProvider);
    expect(result).toEqual(['fileA', 'fileB']);
  });

  it('should ignore missing files gracefully', async () => {
    const mockFs: Record<string, string> = {
      'fileA': 'Refers to @fileMissing',
    };
    
    const readFileProvider = async (path: string) => {
      if (mockFs[path]) return mockFs[path];
      throw new Error('Not found');
    };

    const result = await resolveAllDependencies(['fileA'], readFileProvider);
    expect(result).toEqual(['fileA', 'fileMissing']); 
  });
});
