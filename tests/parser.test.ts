/**
 * Tests for parser functions
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

import {
  extractTextFromContent,
  getSessionSummary,
  parseSessionFile,
  getProjectDisplayName,
  findLocalSessions,
  findAllSessions,
  detectGithubRepo,
} from '../src/parser.js'

describe('extractTextFromContent', () => {
  it('handles string content', () => {
    expect(extractTextFromContent('Hello world')).toBe('Hello world')
    expect(extractTextFromContent('  trimmed  ')).toBe('trimmed')
  })

  it('handles array content with text blocks', () => {
    const content = [
      { type: 'text', text: 'Hello' },
      { type: 'text', text: 'World' },
    ]
    expect(extractTextFromContent(content)).toBe('Hello World')
  })

  it('ignores non-text blocks', () => {
    const content = [
      { type: 'text', text: 'Hello' },
      { type: 'image', source: { data: 'base64' } },
      { type: 'text', text: 'World' },
    ]
    expect(extractTextFromContent(content)).toBe('Hello World')
  })

  it('returns empty string for undefined', () => {
    expect(extractTextFromContent(undefined)).toBe('')
  })
})

describe('getProjectDisplayName', () => {
  it('extracts project name from encoded path', () => {
    expect(getProjectDisplayName('-home-user-projects-myproject')).toBe('myproject')
  })

  it('handles nested paths', () => {
    expect(getProjectDisplayName('-home-user-code-apps-webapp')).toBe('apps-webapp')
  })

  it('handles Windows-style encoded paths', () => {
    expect(getProjectDisplayName('-mnt-c-Users-name-Projects-app')).toBe('app')
  })

  it('handles simple names', () => {
    expect(getProjectDisplayName('simple-project')).toBe('simple-project')
  })
})

describe('parseSessionFile', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-parser-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('parses JSONL files', () => {
    const jsonlPath = path.join(tempDir, 'test.jsonl')
    fs.writeFileSync(
      jsonlPath,
      '{"type": "user", "timestamp": "2025-01-01T10:00:00.000Z", "message": {"role": "user", "content": "Hello"}}\n' +
      '{"type": "assistant", "timestamp": "2025-01-01T10:00:05.000Z", "message": {"role": "assistant", "content": [{"type": "text", "text": "Hi!"}]}}\n'
    )

    const result = parseSessionFile(jsonlPath)
    expect(result.loglines).toHaveLength(2)
    expect(result.loglines[0].type).toBe('user')
    expect(result.loglines[1].type).toBe('assistant')
  })

  it('parses JSON files', () => {
    const jsonPath = path.join(tempDir, 'test.json')
    fs.writeFileSync(
      jsonPath,
      JSON.stringify({
        loglines: [
          { type: 'user', timestamp: '2025-01-01T10:00:00.000Z', message: { role: 'user', content: 'Hello' } },
        ],
      })
    )

    const result = parseSessionFile(jsonPath)
    expect(result.loglines).toHaveLength(1)
    expect(result.loglines[0].type).toBe('user')
  })
})

describe('getSessionSummary', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-summary-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('extracts summary from JSONL', () => {
    const jsonlPath = path.join(tempDir, 'test.jsonl')
    fs.writeFileSync(
      jsonlPath,
      '{"type": "user", "timestamp": "2025-01-01T10:00:00.000Z", "message": {"role": "user", "content": "Hello from session"}}\n'
    )

    const summary = getSessionSummary(jsonlPath)
    expect(summary).toBe('Hello from session')
  })

  it('truncates long summaries', () => {
    const jsonlPath = path.join(tempDir, 'test.jsonl')
    const longText = 'A'.repeat(300)
    fs.writeFileSync(
      jsonlPath,
      `{"type": "user", "timestamp": "2025-01-01T10:00:00.000Z", "message": {"role": "user", "content": "${longText}"}}\n`
    )

    const summary = getSessionSummary(jsonlPath, 200)
    expect(summary.length).toBe(200)
    expect(summary.endsWith('...')).toBe(true)
  })

  it('returns "(no summary)" for empty sessions', () => {
    const jsonlPath = path.join(tempDir, 'test.jsonl')
    fs.writeFileSync(jsonlPath, '')

    const summary = getSessionSummary(jsonlPath)
    expect(summary).toBe('(no summary)')
  })
})

describe('findAllSessions', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-sessions-'))

    // Create project-a with 2 sessions
    const projectA = path.join(tempDir, '-home-user-projects-project-a')
    fs.mkdirSync(projectA, { recursive: true })

    fs.writeFileSync(
      path.join(projectA, 'abc123.jsonl'),
      '{"type": "user", "timestamp": "2025-01-01T10:00:00.000Z", "message": {"role": "user", "content": "Hello from project A"}}\n'
    )
    fs.writeFileSync(
      path.join(projectA, 'def456.jsonl'),
      '{"type": "user", "timestamp": "2025-01-02T10:00:00.000Z", "message": {"role": "user", "content": "Second session in project A"}}\n'
    )

    // Create an agent file
    fs.writeFileSync(
      path.join(projectA, 'agent-xyz789.jsonl'),
      '{"type": "user", "timestamp": "2025-01-03T10:00:00.000Z", "message": {"role": "user", "content": "Agent session"}}\n'
    )

    // Create project-b with 1 session
    const projectB = path.join(tempDir, '-home-user-projects-project-b')
    fs.mkdirSync(projectB, { recursive: true })

    fs.writeFileSync(
      path.join(projectB, 'ghi789.jsonl'),
      '{"type": "user", "timestamp": "2025-01-04T10:00:00.000Z", "message": {"role": "user", "content": "Hello from project B"}}\n'
    )

    // Create warmup session (should be skipped)
    fs.writeFileSync(
      path.join(projectB, 'warmup123.jsonl'),
      '{"type": "user", "timestamp": "2025-01-05T10:00:00.000Z", "message": {"role": "user", "content": "warmup"}}\n'
    )
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('finds sessions grouped by project', () => {
    const result = findAllSessions(tempDir)
    expect(result.length).toBe(2)

    const projectNames = result.map((p) => p.name)
    expect(projectNames).toContain('project-a')
    expect(projectNames).toContain('project-b')
  })

  it('excludes agent files by default', () => {
    const result = findAllSessions(tempDir)
    const projectA = result.find((p) => p.name === 'project-a')!

    // Should have 2 sessions (not 3, agent excluded)
    expect(projectA.sessions.length).toBe(2)

    for (const session of projectA.sessions) {
      expect(path.basename(session.path).startsWith('agent-')).toBe(false)
    }
  })

  it('includes agent files when requested', () => {
    const result = findAllSessions(tempDir, true)
    const projectA = result.find((p) => p.name === 'project-a')!

    // Should have 3 sessions (including agent)
    expect(projectA.sessions.length).toBe(3)
  })

  it('excludes warmup sessions', () => {
    const result = findAllSessions(tempDir)
    const projectB = result.find((p) => p.name === 'project-b')!

    // Should have 1 session (warmup excluded)
    expect(projectB.sessions.length).toBe(1)
  })

  it('returns empty for nonexistent folder', () => {
    const result = findAllSessions('/nonexistent/path')
    expect(result).toEqual([])
  })

  it('sessions include summary', () => {
    const result = findAllSessions(tempDir)
    const projectA = result.find((p) => p.name === 'project-a')!

    for (const session of projectA.sessions) {
      expect(session.summary).toBeDefined()
      expect(session.summary).not.toBe('(no summary)')
    }
  })
})

describe('detectGithubRepo', () => {
  it('detects repo from git push output', () => {
    const loglines = [
      {
        type: 'user',
        message: {
          content: [
            {
              type: 'tool_result',
              content: 'remote: Create a pull request for \'feature\' on GitHub by visiting:\nremote:      https://github.com/owner/repo/pull/new/feature\n',
            },
          ],
        },
      },
    ]

    const repo = detectGithubRepo(loglines)
    expect(repo).toBe('owner/repo')
  })

  it('returns null when no repo found', () => {
    const loglines = [
      {
        type: 'user',
        message: { content: 'No git output here' },
      },
    ]

    const repo = detectGithubRepo(loglines)
    expect(repo).toBeNull()
  })
})
