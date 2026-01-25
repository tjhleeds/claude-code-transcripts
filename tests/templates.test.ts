/**
 * Tests for template functions
 */

import { describe, it, expect } from 'vitest'

import {
  escapeHtml,
  pagination,
  indexPagination,
  todoList,
  writeTool,
  editTool,
  bashTool,
  toolUse,
  toolResult,
  thinking,
  assistantText,
  userContent,
  imageBlock,
  commitCard,
  message,
  indexItem,
  indexCommit,
  indexStats,
  baseTemplate,
  pageTemplate,
  indexTemplate,
  projectIndexTemplate,
  masterIndexTemplate,
  injectGistPreviewJs,
} from '../src/templates.js'

describe('escapeHtml', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;')
    expect(escapeHtml('"quotes"')).toBe('&quot;quotes&quot;')
    expect(escapeHtml("'single'")).toBe('&#039;single&#039;')
    expect(escapeHtml('&amp')).toBe('&amp;amp')
  })

  it('handles empty strings', () => {
    expect(escapeHtml('')).toBe('')
  })
})

describe('pagination', () => {
  it('shows only index link for single page', () => {
    const result = pagination(1, 1)
    expect(result).toContain('Index')
    expect(result).not.toContain('Prev')
    expect(result).not.toContain('Next')
  })

  it('shows navigation for multiple pages', () => {
    const result = pagination(2, 3)
    expect(result).toContain('Index')
    expect(result).toContain('Prev')
    expect(result).toContain('Next')
    expect(result).toContain('page-001.html')
    expect(result).toContain('page-003.html')
  })

  it('disables prev on first page', () => {
    const result = pagination(1, 3)
    expect(result).toContain('class="disabled"')
    expect(result).toContain('Prev')
    expect(result).toContain('page-002.html')
  })

  it('disables next on last page', () => {
    const result = pagination(3, 3)
    expect(result).toContain('page-002.html')
    expect(result).toContain('class="disabled"')
  })
})

describe('indexPagination', () => {
  it('shows index as current', () => {
    const result = indexPagination(3)
    expect(result).toContain('class="current">Index')
  })

  it('links to page files', () => {
    const result = indexPagination(3)
    expect(result).toContain('page-001.html')
    expect(result).toContain('page-002.html')
    expect(result).toContain('page-003.html')
  })
})

describe('todoList', () => {
  it('renders todo items', () => {
    const todos = [
      { status: 'completed' as const, content: 'Done task' },
      { status: 'in_progress' as const, content: 'Working' },
      { status: 'pending' as const, content: 'Todo' },
    ]
    const result = todoList(todos, 'tool-123')

    expect(result).toContain('Done task')
    expect(result).toContain('Working')
    expect(result).toContain('Todo')
    expect(result).toContain('todo-completed')
    expect(result).toContain('todo-in-progress')
    expect(result).toContain('todo-pending')
  })

  it('includes tool ID', () => {
    const result = todoList([{ content: 'Test' }], 'my-tool-id')
    expect(result).toContain('data-tool-id="my-tool-id"')
  })
})

describe('writeTool', () => {
  it('shows filename and content', () => {
    const result = writeTool('/path/to/file.txt', 'file contents', 'tool-1')

    expect(result).toContain('file.txt')
    expect(result).toContain('/path/to/file.txt')
    expect(result).toContain('file contents')
    expect(result).toContain('write-tool')
  })

  it('escapes HTML in content', () => {
    const result = writeTool('/path/file.js', '<script>alert(1)</script>', 'tool-1')
    expect(result).toContain('&lt;script&gt;')
  })
})

describe('editTool', () => {
  it('shows old and new strings', () => {
    const result = editTool('/path/file.txt', 'old text', 'new text', false, 'tool-1')

    expect(result).toContain('old text')
    expect(result).toContain('new text')
    expect(result).toContain('edit-old')
    expect(result).toContain('edit-new')
  })

  it('shows replace all indicator', () => {
    const result = editTool('/path/file.txt', 'old', 'new', true, 'tool-1')
    expect(result).toContain('(replace all)')
  })
})

describe('bashTool', () => {
  it('renders command', () => {
    const result = bashTool('ls -la', '', 'tool-1')
    expect(result).toContain('ls -la')
    expect(result).toContain('Bash')
  })

  it('includes description when provided', () => {
    const result = bashTool('npm install', 'Install dependencies', 'tool-1')
    expect(result).toContain('Install dependencies')
    expect(result).toContain('tool-description')
  })
})

describe('toolUse', () => {
  it('renders generic tool', () => {
    const result = toolUse('MyTool', 'Does something', '{"key": "value"}', 'tool-1')

    expect(result).toContain('MyTool')
    expect(result).toContain('Does something')
    // JSON is HTML-escaped in the output
    expect(result).toContain('&quot;key&quot;')
    expect(result).toContain('&quot;value&quot;')
  })
})

describe('toolResult', () => {
  it('renders normal result', () => {
    const result = toolResult('<pre>output</pre>', false)
    expect(result).toContain('tool-result')
    expect(result).toContain('output')
    expect(result).not.toContain('tool-error')
  })

  it('adds error class for errors', () => {
    const result = toolResult('<pre>error</pre>', true)
    expect(result).toContain('tool-error')
  })

  it('disables truncation for images', () => {
    const result = toolResult('<img src="data:...">', false, true)
    expect(result).not.toContain('truncatable')
  })
})

describe('thinking', () => {
  it('wraps content in thinking block', () => {
    const result = thinking('<p>thinking...</p>')
    expect(result).toContain('thinking')
    expect(result).toContain('Thinking')
    expect(result).toContain('<p>thinking...</p>')
  })
})

describe('commitCard', () => {
  it('renders commit without link', () => {
    const result = commitCard('abc1234567', 'Fix bug', null)
    expect(result).toContain('abc1234')
    expect(result).toContain('Fix bug')
    expect(result).not.toContain('href=')
  })

  it('renders commit with GitHub link', () => {
    const result = commitCard('abc1234567', 'Fix bug', 'owner/repo')
    expect(result).toContain('abc1234')
    expect(result).toContain('Fix bug')
    expect(result).toContain('https://github.com/owner/repo/commit/abc1234567')
  })
})

describe('message', () => {
  it('renders message with role and timestamp', () => {
    const result = message('user', 'User', 'msg-1', '2025-01-01T10:00:00Z', '<p>Hello</p>')

    expect(result).toContain('class="message user"')
    expect(result).toContain('id="msg-1"')
    expect(result).toContain('User')
    expect(result).toContain('2025-01-01T10:00:00Z')
    expect(result).toContain('<p>Hello</p>')
  })
})

describe('baseTemplate', () => {
  it('includes CSS and JS', () => {
    const result = baseTemplate('Test', '<p>Content</p>')
    expect(result).toContain('<!DOCTYPE html>')
    expect(result).toContain('<style>')
    expect(result).toContain('<script>')
    expect(result).toContain('<title>Test</title>')
    expect(result).toContain('<p>Content</p>')
  })
})

describe('pageTemplate', () => {
  it('includes page info and pagination', () => {
    const result = pageTemplate(2, 5, '<nav>pagination</nav>', '<div>messages</div>')

    expect(result).toContain('page 2/5')
    expect(result).toContain('<nav>pagination</nav>')
    expect(result).toContain('<div>messages</div>')
  })
})

describe('indexTemplate', () => {
  it('includes stats and items', () => {
    const result = indexTemplate(
      '<nav>pagination</nav>',
      10,
      50,
      25,
      5,
      3,
      '<div>items</div>'
    )

    expect(result).toContain('10 prompts')
    expect(result).toContain('50 messages')
    expect(result).toContain('25 tool calls')
    expect(result).toContain('5 commits')
    expect(result).toContain('<div>items</div>')
    expect(result).toContain('search-modal')
  })
})

describe('projectIndexTemplate', () => {
  it('lists sessions', () => {
    const sessions = [
      { name: 'session1', summary: 'First session', date: '2025-01-01', size_kb: 50 },
      { name: 'session2', summary: 'Second session', date: '2025-01-02', size_kb: 100 },
    ]
    const result = projectIndexTemplate('MyProject', sessions, 2)

    expect(result).toContain('MyProject')
    expect(result).toContain('2 sessions')
    expect(result).toContain('session1')
    expect(result).toContain('session2')
    expect(result).toContain('First session')
  })
})

describe('masterIndexTemplate', () => {
  it('lists projects', () => {
    const projects = [
      { name: 'project-a', session_count: 5, recent_date: '2025-01-01' },
      { name: 'project-b', session_count: 3, recent_date: '2025-01-02' },
    ]
    const result = masterIndexTemplate(projects, 2, 8)

    expect(result).toContain('2 projects')
    expect(result).toContain('8 sessions')
    expect(result).toContain('project-a')
    expect(result).toContain('project-b')
    expect(result).toContain('5 sessions')
    expect(result).toContain('3 sessions')
  })
})

describe('injectGistPreviewJs', () => {
  it('injects script before closing body', () => {
    const html = '<html><body><p>content</p></body></html>'
    const result = injectGistPreviewJs(html)

    expect(result).toContain('<script>')
    expect(result).toContain('gisthost.github.io')
    expect(result).toContain('</body>')
  })

  it('returns unchanged if no body tag', () => {
    const html = '<p>no body tag</p>'
    const result = injectGistPreviewJs(html)
    expect(result).toBe(html)
  })
})
