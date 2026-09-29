/**
 * Session file parsing functions
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { homedir } from 'node:os'

// Types for session data
export interface ContentBlock {
  type: string
  text?: string
  thinking?: string
  name?: string
  input?: Record<string, unknown>
  id?: string
  content?: string | ContentBlock[]
  is_error?: boolean
  source?: {
    media_type?: string
    data?: string
  }
}

export interface MessageData {
  role?: string
  content?: string | ContentBlock[]
}

export interface LogEntry {
  type: string
  timestamp?: string
  message?: MessageData
  isCompactSummary?: boolean
  isMeta?: boolean
  summary?: string
}

export interface SessionData {
  loglines: LogEntry[]
}

// Regex patterns
export const COMMIT_PATTERN = /\[[\w\-/]+ ([a-f0-9]{7,})\] (.+?)(?:\n|$)/g
export const GITHUB_REPO_PATTERN = /github\.com\/([a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+)\/pull\/new\//

/**
 * Extract plain text from message content.
 * Handles both string content (older format) and array content (newer format).
 */
export function extractTextFromContent(content: string | ContentBlock[] | undefined): string {
  if (typeof content === 'string') {
    return content.trim()
  }

  if (Array.isArray(content)) {
    const texts: string[] = []
    for (const block of content) {
      if (typeof block === 'object' && block.type === 'text' && block.text) {
        texts.push(block.text)
      }
    }
    return texts.join(' ').trim()
  }

  return ''
}

/**
 * Get session summary from a JSONL file.
 */
function getJsonlSummary(filepath: string, maxLength: number): string {
  try {
    const content = fs.readFileSync(filepath, 'utf-8')
    const lines = content.split('\n')

    // First pass: look for summary type entries
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      try {
        const obj = JSON.parse(trimmed) as LogEntry
        if (obj.type === 'summary' && obj.summary) {
          const summary = obj.summary
          if (summary.length > maxLength) {
            return summary.slice(0, maxLength - 3) + '...'
          }
          return summary
        }
      } catch {
        continue
      }
    }

    // Second pass: find first non-meta user message
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      try {
        const obj = JSON.parse(trimmed) as LogEntry
        if (obj.type === 'user' && !obj.isMeta && obj.message?.content) {
          const text = extractTextFromContent(obj.message.content)
          if (text && !text.startsWith('<')) {
            if (text.length > maxLength) {
              return text.slice(0, maxLength - 3) + '...'
            }
            return text
          }
        }
      } catch {
        continue
      }
    }
  } catch {
    // File read error
  }

  return '(no summary)'
}

/**
 * Extract a human-readable summary from a session file.
 * Supports both JSON and JSONL formats.
 */
export function getSessionSummary(filepath: string, maxLength = 200): string {
  try {
    const ext = path.extname(filepath)

    if (ext === '.jsonl') {
      return getJsonlSummary(filepath, maxLength)
    }

    // JSON file format
    const content = fs.readFileSync(filepath, 'utf-8')
    const data = JSON.parse(content) as SessionData
    const loglines = data.loglines || []

    for (const entry of loglines) {
      if (entry.type === 'user') {
        const text = extractTextFromContent(entry.message?.content)
        if (text) {
          if (text.length > maxLength) {
            return text.slice(0, maxLength - 3) + '...'
          }
          return text
        }
      }
    }

    return '(no summary)'
  } catch {
    return '(no summary)'
  }
}

/**
 * Parse a JSONL file and convert to standard format.
 */
function parseJsonlFile(filepath: string): SessionData {
  const loglines: LogEntry[] = []
  const content = fs.readFileSync(filepath, 'utf-8')
  const lines = content.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    try {
      const obj = JSON.parse(trimmed) as LogEntry
      const entryType = obj.type

      // Skip non-message entries
      if (entryType !== 'user' && entryType !== 'assistant') {
        continue
      }

      const entry: LogEntry = {
        type: entryType,
        timestamp: obj.timestamp || '',
        message: obj.message || {},
      }

      // Preserve isCompactSummary if present
      if (obj.isCompactSummary) {
        entry.isCompactSummary = true
      }

      loglines.push(entry)
    } catch {
      continue
    }
  }

  return { loglines }
}

/**
 * Parse a session file and return normalized data.
 * Supports both JSON and JSONL formats.
 */
export function parseSessionFile(filepath: string): SessionData {
  const ext = path.extname(filepath)

  if (ext === '.jsonl') {
    return parseJsonlFile(filepath)
  }

  // Standard JSON format
  const content = fs.readFileSync(filepath, 'utf-8')
  return JSON.parse(content) as SessionData
}

/**
 * Convert encoded folder name to readable project name.
 */
export function getProjectDisplayName(folderName: string): string {
  // Common path prefixes to strip
  const prefixesToStrip = ['-home-', '-mnt-c-Users-', '-mnt-c-users-', '-Users-']

  let name = folderName
  for (const prefix of prefixesToStrip) {
    if (name.toLowerCase().startsWith(prefix.toLowerCase())) {
      name = name.slice(prefix.length)
      break
    }
  }

  // Split on dashes and find meaningful parts
  const parts = name.split('-')

  // Common intermediate directories to skip
  const skipDirs = new Set(['projects', 'code', 'repos', 'src', 'dev', 'work', 'documents'])

  // Find the first meaningful part (after skipping username and common dirs)
  const meaningfulParts: string[] = []
  let foundProject = false

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (!part) continue

    // Skip the first part if it looks like a username (before common dirs)
    if (i === 0 && !foundProject) {
      // Check if next parts contain common dirs
      const remaining = parts.slice(i + 1).map((p) => p.toLowerCase())
      if (remaining.some((d) => skipDirs.has(d))) {
        continue
      }
    }

    if (skipDirs.has(part.toLowerCase())) {
      foundProject = true
      continue
    }

    meaningfulParts.push(part)
    foundProject = true
  }

  if (meaningfulParts.length > 0) {
    return meaningfulParts.join('-')
  }

  // Fallback: return last non-empty part or original
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i]) {
      return parts[i]
    }
  }

  return folderName
}

/**
 * Session info for listing
 */
export interface SessionInfo {
  path: string
  summary: string
  mtime: number
  size: number
}

/**
 * Project info with sessions
 */
export interface ProjectInfo {
  name: string
  path: string
  sessions: SessionInfo[]
}

/**
 * Find recent JSONL session files in the given folder.
 */
export function findLocalSessions(folder: string, limit = 10): Array<{ path: string; summary: string }> {
  if (!fs.existsSync(folder)) {
    return []
  }

  const results: Array<{ path: string; summary: string; mtime: number }> = []

  // Recursively find .jsonl files
  function walkDir(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        walkDir(fullPath)
      } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        // Skip agent files
        if (entry.name.startsWith('agent-')) {
          continue
        }

        const summary = getSessionSummary(fullPath)

        // Skip boring/empty sessions
        if (summary.toLowerCase() === 'warmup' || summary === '(no summary)') {
          continue
        }

        const stat = fs.statSync(fullPath)
        results.push({ path: fullPath, summary, mtime: stat.mtimeMs })
      }
    }
  }

  walkDir(folder)

  // Sort by modification time, most recent first
  results.sort((a, b) => b.mtime - a.mtime)

  return results.slice(0, limit).map(({ path: p, summary }) => ({ path: p, summary }))
}

/**
 * Find a session file by its ID (the JSONL filename without extension) anywhere in the given folder.
 */
export function findSessionById(folder: string, sessionId: string): string | null {
  if (!fs.existsSync(folder)) {
    return null
  }

  const targetName = `${sessionId.replace(/\.jsonl$/, '')}.jsonl`

  // Recursively search for the matching .jsonl file
  function walkDir(dir: string): string | null {
    const entries = fs.readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        const found = walkDir(fullPath)
        if (found) {
          return found
        }
      } else if (entry.isFile() && entry.name === targetName) {
        return fullPath
      }
    }

    return null
  }

  return walkDir(folder)
}

/**
 * Find all sessions in a Claude projects folder, grouped by project.
 */
export function findAllSessions(folder: string, includeAgents = false): ProjectInfo[] {
  if (!fs.existsSync(folder)) {
    return []
  }

  const projects: Map<string, ProjectInfo> = new Map()

  // Recursively find .jsonl files
  function walkDir(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        walkDir(fullPath)
      } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        // Skip agent files unless requested
        if (!includeAgents && entry.name.startsWith('agent-')) {
          continue
        }

        const summary = getSessionSummary(fullPath)

        // Skip boring sessions
        if (summary.toLowerCase() === 'warmup' || summary === '(no summary)') {
          continue
        }

        // Get project folder
        const projectFolder = path.dirname(fullPath)
        const projectKey = path.basename(projectFolder)

        if (!projects.has(projectKey)) {
          projects.set(projectKey, {
            name: getProjectDisplayName(projectKey),
            path: projectFolder,
            sessions: [],
          })
        }

        const stat = fs.statSync(fullPath)
        projects.get(projectKey)!.sessions.push({
          path: fullPath,
          summary,
          mtime: stat.mtimeMs,
          size: stat.size,
        })
      }
    }
  }

  walkDir(folder)

  // Sort sessions within each project by mtime (most recent first)
  for (const project of projects.values()) {
    project.sessions.sort((a, b) => b.mtime - a.mtime)
  }

  // Convert to list and sort projects by most recent session
  const result = Array.from(projects.values())
  result.sort((a, b) => {
    const aTime = a.sessions.length > 0 ? a.sessions[0].mtime : 0
    const bTime = b.sessions.length > 0 ? b.sessions[0].mtime : 0
    return bTime - aTime
  })

  return result
}

/**
 * Detect GitHub repo from git push output in tool results.
 */
export function detectGithubRepo(loglines: LogEntry[]): string | null {
  for (const entry of loglines) {
    const content = entry.message?.content
    if (!Array.isArray(content)) continue

    for (const block of content) {
      if (typeof block !== 'object' || block.type !== 'tool_result') continue

      const resultContent = block.content
      if (typeof resultContent === 'string') {
        const match = GITHUB_REPO_PATTERN.exec(resultContent)
        if (match) {
          return match[1]
        }
      }
    }
  }

  return null
}

/**
 * Get the default Claude projects folder path.
 */
export function getDefaultProjectsFolder(): string {
  return path.join(homedir(), '.claude', 'projects')
}
