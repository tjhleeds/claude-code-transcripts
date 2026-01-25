/**
 * Tests for renderer functions
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

import {
  formatJson,
  renderMarkdownText,
  isJsonLike,
  makeMsgId,
  isToolResultMessage,
  analyzeConversation,
  formatToolStats,
  generateHtml,
  generateBatchHtml,
} from '../src/renderer.js'

describe('formatJson', () => {
  it('formats objects as JSON', () => {
    const result = formatJson({ hello: 'world' })
    expect(result).toContain('pre')
    expect(result).toContain('json')
    expect(result).toContain('hello')
    expect(result).toContain('world')
  })

  it('parses JSON strings', () => {
    const result = formatJson('{"hello":"world"}')
    expect(result).toContain('hello')
    expect(result).toContain('world')
  })

  it('handles invalid JSON gracefully', () => {
    const result = formatJson('not json')
    expect(result).toContain('not json')
  })
})

describe('renderMarkdownText', () => {
  it('renders markdown to HTML', () => {
    const result = renderMarkdownText('**bold**')
    expect(result).toContain('<strong>')
    expect(result).toContain('bold')
  })

  it('renders code blocks', () => {
    const result = renderMarkdownText('```js\nconst x = 1;\n```')
    expect(result).toContain('<code')
  })

  it('returns empty string for empty input', () => {
    expect(renderMarkdownText('')).toBe('')
    expect(renderMarkdownText(undefined)).toBe('')
  })
})

describe('isJsonLike', () => {
  it('detects JSON objects', () => {
    expect(isJsonLike('{"key": "value"}')).toBe(true)
    expect(isJsonLike('  {"key": "value"}  ')).toBe(true)
  })

  it('detects JSON arrays', () => {
    expect(isJsonLike('[1, 2, 3]')).toBe(true)
    expect(isJsonLike('  [1, 2, 3]  ')).toBe(true)
  })

  it('returns false for non-JSON', () => {
    expect(isJsonLike('hello world')).toBe(false)
    expect(isJsonLike('')).toBe(false)
    expect(isJsonLike(null)).toBe(false)
    expect(isJsonLike(123)).toBe(false)
  })
})

describe('makeMsgId', () => {
  it('creates valid HTML IDs from timestamps', () => {
    const id = makeMsgId('2025-01-01T10:30:45.123Z')
    expect(id).toBe('msg-2025-01-01T10-30-45-123Z')
    expect(id).not.toContain(':')
    expect(id).not.toContain('.')
  })
})

describe('isToolResultMessage', () => {
  it('returns true for tool_result only messages', () => {
    const message = {
      content: [
        { type: 'tool_result', content: 'result 1' },
        { type: 'tool_result', content: 'result 2' },
      ],
    }
    expect(isToolResultMessage(message)).toBe(true)
  })

  it('returns false for mixed messages', () => {
    const message = {
      content: [
        { type: 'tool_result', content: 'result' },
        { type: 'text', text: 'some text' },
      ],
    }
    expect(isToolResultMessage(message)).toBe(false)
  })

  it('returns false for empty content', () => {
    expect(isToolResultMessage({ content: [] })).toBe(false)
    expect(isToolResultMessage({})).toBe(false)
  })
})

describe('analyzeConversation', () => {
  it('counts tool usage', () => {
    const messages: Array<[string, string, string]> = [
      ['assistant', JSON.stringify({
        content: [
          { type: 'tool_use', name: 'Bash' },
          { type: 'tool_use', name: 'Read' },
          { type: 'tool_use', name: 'Bash' },
        ],
      }), '2025-01-01T10:00:00Z'],
    ]

    const stats = analyzeConversation(messages)
    expect(stats.tool_counts['Bash']).toBe(2)
    expect(stats.tool_counts['Read']).toBe(1)
  })

  it('extracts long texts', () => {
    const longText = 'A'.repeat(400)
    const messages: Array<[string, string, string]> = [
      ['assistant', JSON.stringify({
        content: [
          { type: 'text', text: longText },
          { type: 'text', text: 'short' },
        ],
      }), '2025-01-01T10:00:00Z'],
    ]

    const stats = analyzeConversation(messages)
    expect(stats.long_texts).toHaveLength(1)
    expect(stats.long_texts[0]).toBe(longText)
  })

  it('detects git commits', () => {
    const messages: Array<[string, string, string]> = [
      ['user', JSON.stringify({
        content: [
          { type: 'tool_result', content: '[main abc1234] Fix the bug\n 1 file changed' },
        ],
      }), '2025-01-01T10:00:00Z'],
    ]

    const stats = analyzeConversation(messages)
    expect(stats.commits).toHaveLength(1)
    expect(stats.commits[0][0]).toBe('abc1234')
    expect(stats.commits[0][1]).toBe('Fix the bug')
  })
})

describe('formatToolStats', () => {
  it('formats tool counts as string', () => {
    const result = formatToolStats({ Bash: 5, Read: 3, Write: 1 })
    expect(result).toContain('5 bash')
    expect(result).toContain('3 read')
    expect(result).toContain('1 write')
  })

  it('sorts by count descending', () => {
    const result = formatToolStats({ A: 1, B: 10, C: 5 })
    const parts = result.split(' · ')
    expect(parts[0]).toContain('10')
  })

  it('returns empty string for empty counts', () => {
    expect(formatToolStats({})).toBe('')
  })
})

describe('generateHtml', () => {
  let tempDir: string
  let sessionFile: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-generate-'))
    sessionFile = path.join(tempDir, 'session.jsonl')
    fs.writeFileSync(
      sessionFile,
      '{"type": "user", "timestamp": "2025-01-01T10:00:00.000Z", "message": {"role": "user", "content": "Hello world"}}\n' +
      '{"type": "assistant", "timestamp": "2025-01-01T10:00:05.000Z", "message": {"role": "assistant", "content": [{"type": "text", "text": "Hi there!"}]}}\n'
    )
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('generates index.html', () => {
    const outputDir = path.join(tempDir, 'output')
    generateHtml(sessionFile, outputDir)

    expect(fs.existsSync(path.join(outputDir, 'index.html'))).toBe(true)
  })

  it('generates page files', () => {
    const outputDir = path.join(tempDir, 'output')
    generateHtml(sessionFile, outputDir)

    expect(fs.existsSync(path.join(outputDir, 'page-001.html'))).toBe(true)
  })

  it('creates output directory if needed', () => {
    const outputDir = path.join(tempDir, 'nested', 'output')
    generateHtml(sessionFile, outputDir)

    expect(fs.existsSync(outputDir)).toBe(true)
  })

  it('includes CSS and JS in output', () => {
    const outputDir = path.join(tempDir, 'output')
    generateHtml(sessionFile, outputDir)

    const indexHtml = fs.readFileSync(path.join(outputDir, 'index.html'), 'utf-8')
    expect(indexHtml).toContain('<style>')
    expect(indexHtml).toContain('<script>')
  })
})

describe('generateBatchHtml', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-batch-'))

    // Create project-a with 2 sessions
    const projectA = path.join(tempDir, 'source', '-home-user-projects-project-a')
    fs.mkdirSync(projectA, { recursive: true })

    fs.writeFileSync(
      path.join(projectA, 'abc123.jsonl'),
      '{"type": "user", "timestamp": "2025-01-01T10:00:00.000Z", "message": {"role": "user", "content": "Hello from project A"}}\n'
    )
    fs.writeFileSync(
      path.join(projectA, 'def456.jsonl'),
      '{"type": "user", "timestamp": "2025-01-02T10:00:00.000Z", "message": {"role": "user", "content": "Second session"}}\n'
    )

    // Create project-b with 1 session
    const projectB = path.join(tempDir, 'source', '-home-user-projects-project-b')
    fs.mkdirSync(projectB, { recursive: true })

    fs.writeFileSync(
      path.join(projectB, 'ghi789.jsonl'),
      '{"type": "user", "timestamp": "2025-01-03T10:00:00.000Z", "message": {"role": "user", "content": "Hello from project B"}}\n'
    )
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('creates master index', () => {
    const sourceDir = path.join(tempDir, 'source')
    const outputDir = path.join(tempDir, 'output')

    generateBatchHtml(sourceDir, outputDir)

    expect(fs.existsSync(path.join(outputDir, 'index.html'))).toBe(true)
  })

  it('creates project directories', () => {
    const sourceDir = path.join(tempDir, 'source')
    const outputDir = path.join(tempDir, 'output')

    generateBatchHtml(sourceDir, outputDir)

    expect(fs.existsSync(path.join(outputDir, 'project-a'))).toBe(true)
    expect(fs.existsSync(path.join(outputDir, 'project-b'))).toBe(true)
  })

  it('creates project indexes', () => {
    const sourceDir = path.join(tempDir, 'source')
    const outputDir = path.join(tempDir, 'output')

    generateBatchHtml(sourceDir, outputDir)

    expect(fs.existsSync(path.join(outputDir, 'project-a', 'index.html'))).toBe(true)
    expect(fs.existsSync(path.join(outputDir, 'project-b', 'index.html'))).toBe(true)
  })

  it('creates session directories', () => {
    const sourceDir = path.join(tempDir, 'source')
    const outputDir = path.join(tempDir, 'output')

    generateBatchHtml(sourceDir, outputDir)

    const projectADir = path.join(outputDir, 'project-a')
    const sessionDirs = fs.readdirSync(projectADir).filter((f) => {
      return fs.statSync(path.join(projectADir, f)).isDirectory()
    })
    expect(sessionDirs.length).toBe(2)
  })

  it('returns statistics', () => {
    const sourceDir = path.join(tempDir, 'source')
    const outputDir = path.join(tempDir, 'output')

    const stats = generateBatchHtml(sourceDir, outputDir)

    expect(stats.total_projects).toBe(2)
    expect(stats.total_sessions).toBe(3)
    expect(stats.failed_sessions).toEqual([])
  })

  it('calls progress callback', () => {
    const sourceDir = path.join(tempDir, 'source')
    const outputDir = path.join(tempDir, 'output')
    const progressCalls: Array<[string, string, number, number]> = []

    generateBatchHtml(sourceDir, outputDir, false, (project, session, current, total) => {
      progressCalls.push([project, session, current, total])
    })

    expect(progressCalls.length).toBe(3)
    expect(progressCalls[progressCalls.length - 1][2]).toBe(progressCalls[progressCalls.length - 1][3])
  })

  it('master index lists all projects', () => {
    const sourceDir = path.join(tempDir, 'source')
    const outputDir = path.join(tempDir, 'output')

    generateBatchHtml(sourceDir, outputDir)

    const indexHtml = fs.readFileSync(path.join(outputDir, 'index.html'), 'utf-8')
    expect(indexHtml).toContain('project-a')
    expect(indexHtml).toContain('project-b')
  })
})
