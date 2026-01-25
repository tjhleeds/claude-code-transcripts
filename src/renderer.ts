/**
 * HTML rendering functions for Claude Code transcripts
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { marked } from 'marked'

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
  indexLongText,
  pageTemplate,
  indexTemplate,
  projectIndexTemplate,
  masterIndexTemplate,
  injectGistPreviewJs,
  type TodoItem,
  type SessionData as TemplateSessionData,
  type ProjectData,
} from './templates.js'

import {
  parseSessionFile,
  extractTextFromContent,
  detectGithubRepo,
  findAllSessions,
  COMMIT_PATTERN,
  type ContentBlock,
  type SessionData,
  type ProjectInfo,
} from './parser.js'

// Constants
export const PROMPTS_PER_PAGE = 5
export const LONG_TEXT_THRESHOLD = 300

// Module-level variable for GitHub repo (used by render functions)
let _githubRepo: string | null = null

/**
 * Format JSON for display with syntax highlighting classes
 */
export function formatJson(obj: unknown): string {
  try {
    let data = obj
    if (typeof obj === 'string') {
      data = JSON.parse(obj)
    }
    const formatted = JSON.stringify(data, null, 2)
    return `<pre class="json">${escapeHtml(formatted)}</pre>`
  } catch {
    return `<pre>${escapeHtml(String(obj))}</pre>`
  }
}

/**
 * Render markdown text to HTML
 */
export function renderMarkdownText(text: string | undefined): string {
  if (!text) return ''
  return marked.parse(text, { async: false }) as string
}

/**
 * Check if text looks like JSON
 */
export function isJsonLike(text: unknown): boolean {
  if (!text || typeof text !== 'string') return false
  const trimmed = text.trim()
  return (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
         (trimmed.startsWith('[') && trimmed.endsWith(']'))
}

/**
 * Render TodoWrite tool
 */
export function renderTodoWrite(
  toolInput: Record<string, unknown>,
  toolId: string
): string {
  const todos = (toolInput.todos || []) as TodoItem[]
  if (todos.length === 0) return ''
  return todoList(todos, toolId)
}

/**
 * Render Write tool calls
 */
export function renderWriteTool(
  toolInput: Record<string, unknown>,
  toolId: string
): string {
  const filePath = (toolInput.file_path as string) || 'Unknown file'
  const content = (toolInput.content as string) || ''
  return writeTool(filePath, content, toolId)
}

/**
 * Render Edit tool calls
 */
export function renderEditTool(
  toolInput: Record<string, unknown>,
  toolId: string
): string {
  const filePath = (toolInput.file_path as string) || 'Unknown file'
  const oldString = (toolInput.old_string as string) || ''
  const newString = (toolInput.new_string as string) || ''
  const replaceAll = Boolean(toolInput.replace_all)
  return editTool(filePath, oldString, newString, replaceAll, toolId)
}

/**
 * Render Bash tool calls
 */
export function renderBashTool(
  toolInput: Record<string, unknown>,
  toolId: string
): string {
  const command = (toolInput.command as string) || ''
  const description = (toolInput.description as string) || ''
  return bashTool(command, description, toolId)
}

/**
 * Render a content block
 */
export function renderContentBlock(block: ContentBlock | string): string {
  if (typeof block !== 'object') {
    return `<p>${escapeHtml(String(block))}</p>`
  }

  const blockType = block.type || ''

  if (blockType === 'image') {
    const source = block.source || {}
    const mediaType = source.media_type || 'image/png'
    const data = source.data || ''
    return imageBlock(mediaType, data)
  }

  if (blockType === 'thinking') {
    const contentHtml = renderMarkdownText(block.thinking || '')
    return thinking(contentHtml)
  }

  if (blockType === 'text') {
    const contentHtml = renderMarkdownText(block.text || '')
    return assistantText(contentHtml)
  }

  if (blockType === 'tool_use') {
    const toolName = block.name || 'Unknown tool'
    const toolInput = (block.input || {}) as Record<string, unknown>
    const toolId = block.id || ''

    if (toolName === 'TodoWrite') {
      return renderTodoWrite(toolInput, toolId)
    }
    if (toolName === 'Write') {
      return renderWriteTool(toolInput, toolId)
    }
    if (toolName === 'Edit') {
      return renderEditTool(toolInput, toolId)
    }
    if (toolName === 'Bash') {
      return renderBashTool(toolInput, toolId)
    }

    const description = (toolInput.description as string) || ''
    const displayInput = { ...toolInput }
    delete displayInput.description
    const inputJson = JSON.stringify(displayInput, null, 2)
    return toolUse(toolName, description, inputJson, toolId)
  }

  if (blockType === 'tool_result') {
    const content = block.content
    const isError = Boolean(block.is_error)
    let hasImages = false
    let contentHtml: string

    if (typeof content === 'string') {
      // Check for git commits
      const commits: Array<{ hash: string; msg: string; start: number; end: number }> = []
      const pattern = new RegExp(COMMIT_PATTERN.source, 'g')
      let match
      while ((match = pattern.exec(content)) !== null) {
        commits.push({
          hash: match[1],
          msg: match[2],
          start: match.index,
          end: match.index + match[0].length,
        })
      }

      if (commits.length > 0) {
        // Build commit cards + remaining content
        const parts: string[] = []
        let lastEnd = 0

        for (const commit of commits) {
          // Add any content before this commit
          const before = content.slice(lastEnd, commit.start).trim()
          if (before) {
            parts.push(`<pre>${escapeHtml(before)}</pre>`)
          }
          parts.push(commitCard(commit.hash, commit.msg, _githubRepo))
          lastEnd = commit.end
        }

        // Add remaining content after last commit
        const after = content.slice(lastEnd).trim()
        if (after) {
          parts.push(`<pre>${escapeHtml(after)}</pre>`)
        }

        contentHtml = parts.join('')
      } else {
        contentHtml = `<pre>${escapeHtml(content)}</pre>`
      }
    } else if (Array.isArray(content)) {
      // Handle tool result content with multiple blocks
      const parts: string[] = []

      for (const item of content) {
        if (typeof item === 'object' && item !== null) {
          const itemType = (item as ContentBlock).type || ''

          if (itemType === 'text') {
            const text = (item as ContentBlock).text || ''
            if (text) {
              parts.push(`<pre>${escapeHtml(text)}</pre>`)
            }
          } else if (itemType === 'image') {
            const source = (item as ContentBlock).source || {}
            const mediaType = source.media_type || 'image/png'
            const data = source.data || ''
            if (data) {
              parts.push(imageBlock(mediaType, data))
              hasImages = true
            }
          } else {
            parts.push(formatJson(item))
          }
        } else {
          parts.push(`<pre>${escapeHtml(String(item))}</pre>`)
        }
      }

      contentHtml = parts.length > 0 ? parts.join('') : formatJson(content)
    } else if (isJsonLike(content)) {
      contentHtml = formatJson(content)
    } else {
      contentHtml = formatJson(content)
    }

    return toolResult(contentHtml, isError, hasImages)
  }

  // Unknown block type
  return formatJson(block)
}

/**
 * Render user message content
 */
export function renderUserMessageContent(messageData: { content?: string | ContentBlock[] }): string {
  const content = messageData.content

  if (typeof content === 'string') {
    if (isJsonLike(content)) {
      return userContent(formatJson(content))
    }
    return userContent(renderMarkdownText(content))
  }

  if (Array.isArray(content)) {
    return content.map(renderContentBlock).join('')
  }

  return `<p>${escapeHtml(String(content))}</p>`
}

/**
 * Render assistant message
 */
export function renderAssistantMessage(messageData: { content?: unknown[] }): string {
  const content = messageData.content
  if (!Array.isArray(content)) {
    return `<p>${escapeHtml(String(content))}</p>`
  }
  return content.map((block) => renderContentBlock(block as ContentBlock)).join('')
}

/**
 * Create message ID from timestamp
 */
export function makeMsgId(timestamp: string): string {
  return `msg-${timestamp.replace(/:/g, '-').replace(/\./g, '-')}`
}

/**
 * Check if a message contains only tool_result blocks
 */
export function isToolResultMessage(messageData: { content?: unknown[] }): boolean {
  const content = messageData.content
  if (!Array.isArray(content) || content.length === 0) {
    return false
  }
  return content.every(
    (block) => typeof block === 'object' && block !== null && (block as ContentBlock).type === 'tool_result'
  )
}

/**
 * Render a single message
 */
export function renderMessage(
  logType: string,
  messageJson: string,
  timestamp: string
): string {
  if (!messageJson) return ''

  let messageData: { content?: string | ContentBlock[] }
  try {
    messageData = JSON.parse(messageJson)
  } catch {
    return ''
  }

  let contentHtml: string
  let roleClass: string
  let roleLabel: string

  if (logType === 'user') {
    contentHtml = renderUserMessageContent(messageData)
    // Check if this is a tool result message
    if (isToolResultMessage(messageData as { content?: unknown[] })) {
      roleClass = 'tool-reply'
      roleLabel = 'Tool reply'
    } else {
      roleClass = 'user'
      roleLabel = 'User'
    }
  } else if (logType === 'assistant') {
    contentHtml = renderAssistantMessage(messageData as { content?: unknown[] })
    roleClass = 'assistant'
    roleLabel = 'Assistant'
  } else {
    return ''
  }

  if (!contentHtml.trim()) {
    return ''
  }

  const msgId = makeMsgId(timestamp)
  return message(roleClass, roleLabel, msgId, timestamp, contentHtml)
}

/**
 * Tool count statistics
 */
export interface ConversationStats {
  tool_counts: Record<string, number>
  long_texts: string[]
  commits: Array<[string, string, string]> // [hash, message, timestamp]
}

/**
 * Analyze messages in a conversation to extract stats and long texts
 */
export function analyzeConversation(
  messages: Array<[string, string, string]> // [logType, messageJson, timestamp]
): ConversationStats {
  const toolCounts: Record<string, number> = {}
  const longTexts: string[] = []
  const commits: Array<[string, string, string]> = []

  for (const [_logType, messageJson, timestamp] of messages) {
    if (!messageJson) continue

    let messageData: { content?: unknown[] }
    try {
      messageData = JSON.parse(messageJson)
    } catch {
      continue
    }

    const content = messageData.content
    if (!Array.isArray(content)) continue

    for (const block of content) {
      if (typeof block !== 'object' || block === null) continue

      const blockType = (block as ContentBlock).type || ''

      if (blockType === 'tool_use') {
        const toolName = (block as ContentBlock).name || 'Unknown'
        toolCounts[toolName] = (toolCounts[toolName] || 0) + 1
      } else if (blockType === 'tool_result') {
        // Check for git commit output
        const resultContent = (block as ContentBlock).content
        if (typeof resultContent === 'string') {
          const pattern = new RegExp(COMMIT_PATTERN.source, 'g')
          let match
          while ((match = pattern.exec(resultContent)) !== null) {
            commits.push([match[1], match[2], timestamp])
          }
        }
      } else if (blockType === 'text') {
        const text = (block as ContentBlock).text || ''
        if (text.length >= LONG_TEXT_THRESHOLD) {
          longTexts.push(text)
        }
      }
    }
  }

  return { tool_counts: toolCounts, long_texts: longTexts, commits }
}

/**
 * Format tool counts into a concise summary string
 */
export function formatToolStats(toolCounts: Record<string, number>): string {
  if (Object.keys(toolCounts).length === 0) {
    return ''
  }

  const abbrev: Record<string, string> = {
    Bash: 'bash',
    Read: 'read',
    Write: 'write',
    Edit: 'edit',
    Glob: 'glob',
    Grep: 'grep',
    Task: 'task',
    TodoWrite: 'todo',
    WebFetch: 'fetch',
    WebSearch: 'search',
  }

  const parts: string[] = []
  const sorted = Object.entries(toolCounts).sort((a, b) => b[1] - a[1])

  for (const [name, count] of sorted) {
    const shortName = abbrev[name] || name.toLowerCase()
    parts.push(`${count} ${shortName}`)
  }

  return parts.join(' · ')
}

/**
 * Conversation data for rendering
 */
interface Conversation {
  user_text: string
  timestamp: string
  messages: Array<[string, string, string]> // [logType, messageJson, timestamp]
  is_continuation: boolean
}

/**
 * Generate HTML for a session file
 */
export function generateHtml(
  jsonPath: string,
  outputDir: string,
  githubRepo: string | null = null
): void {
  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true })

  // Load session file
  const data = parseSessionFile(jsonPath)
  const loglines = data.loglines || []

  // Auto-detect GitHub repo if not provided
  if (githubRepo === null) {
    githubRepo = detectGithubRepo(loglines)
    if (githubRepo) {
      console.log(`Auto-detected GitHub repo: ${githubRepo}`)
    } else {
      console.log('Warning: Could not auto-detect GitHub repo. Commit links will be disabled.')
    }
  }

  // Set module-level variable for render functions
  _githubRepo = githubRepo

  // Group messages into conversations (one per user prompt)
  const conversations: Conversation[] = []
  let currentConv: Conversation | null = null

  for (const entry of loglines) {
    const logType = entry.type
    const timestamp = entry.timestamp || ''
    const isCompactSummary = entry.isCompactSummary || false
    const messageData = entry.message || {}

    if (!messageData || Object.keys(messageData).length === 0) {
      continue
    }

    // Convert message dict to JSON string for compatibility
    const messageJson = JSON.stringify(messageData)

    let isUserPrompt = false
    let userText = ''

    if (logType === 'user') {
      const text = extractTextFromContent(messageData.content)
      if (text) {
        isUserPrompt = true
        userText = text
      }
    }

    if (isUserPrompt) {
      if (currentConv) {
        conversations.push(currentConv)
      }
      currentConv = {
        user_text: userText,
        timestamp,
        messages: [[logType, messageJson, timestamp]],
        is_continuation: Boolean(isCompactSummary),
      }
    } else if (currentConv) {
      currentConv.messages.push([logType, messageJson, timestamp])
    }
  }

  if (currentConv) {
    conversations.push(currentConv)
  }

  const totalConvs = conversations.length
  const totalPages = Math.ceil(totalConvs / PROMPTS_PER_PAGE)

  // Generate page files
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const startIdx = (pageNum - 1) * PROMPTS_PER_PAGE
    const endIdx = Math.min(startIdx + PROMPTS_PER_PAGE, totalConvs)
    const pageConvs = conversations.slice(startIdx, endIdx)

    const messagesHtml: string[] = []
    for (const conv of pageConvs) {
      let isFirst = true
      for (const [logType, messageJson, timestamp] of conv.messages) {
        let msgHtml = renderMessage(logType, messageJson, timestamp)
        if (msgHtml) {
          // Wrap continuation summaries in collapsed details
          if (isFirst && conv.is_continuation) {
            msgHtml = `<details class="continuation"><summary>Session continuation summary</summary>${msgHtml}</details>`
          }
          messagesHtml.push(msgHtml)
        }
        isFirst = false
      }
    }

    const paginationHtml = pagination(pageNum, totalPages)
    const pageContent = pageTemplate(pageNum, totalPages, paginationHtml, messagesHtml.join(''))

    const pagePath = path.join(outputDir, `page-${String(pageNum).padStart(3, '0')}.html`)
    fs.writeFileSync(pagePath, pageContent, 'utf-8')
    console.log(`Generated page-${String(pageNum).padStart(3, '0')}.html`)
  }

  // Calculate overall stats and collect all commits for timeline
  const totalToolCounts: Record<string, number> = {}
  let totalMessages = 0
  const allCommits: Array<[string, string, string, number, number]> = [] // [timestamp, hash, msg, pageNum, convIdx]

  for (let i = 0; i < conversations.length; i++) {
    const conv = conversations[i]
    totalMessages += conv.messages.length
    const stats = analyzeConversation(conv.messages)

    for (const [tool, count] of Object.entries(stats.tool_counts)) {
      totalToolCounts[tool] = (totalToolCounts[tool] || 0) + count
    }

    const pageNum = Math.floor(i / PROMPTS_PER_PAGE) + 1
    for (const [commitHash, commitMsg, commitTs] of stats.commits) {
      allCommits.push([commitTs, commitHash, commitMsg, pageNum, i])
    }
  }

  const totalToolCalls = Object.values(totalToolCounts).reduce((a, b) => a + b, 0)
  const totalCommits = allCommits.length

  // Build timeline items: prompts and commits merged by timestamp
  const timelineItems: Array<[string, string, string]> = [] // [timestamp, type, html]

  // Add prompts
  let promptNum = 0
  for (let i = 0; i < conversations.length; i++) {
    const conv = conversations[i]

    if (conv.is_continuation) continue
    if (conv.user_text.startsWith('Stop hook feedback:')) continue

    promptNum++
    const pageNum = Math.floor(i / PROMPTS_PER_PAGE) + 1
    const msgId = makeMsgId(conv.timestamp)
    const link = `page-${String(pageNum).padStart(3, '0')}.html#${msgId}`
    const renderedContent = renderMarkdownText(conv.user_text)

    // Collect all messages including from subsequent continuation conversations
    const allMessages = [...conv.messages]
    for (let j = i + 1; j < conversations.length; j++) {
      if (!conversations[j].is_continuation) break
      allMessages.push(...conversations[j].messages)
    }

    const stats = analyzeConversation(allMessages)
    const toolStatsStr = formatToolStats(stats.tool_counts)

    let longTextsHtml = ''
    for (const lt of stats.long_texts) {
      const renderedLt = renderMarkdownText(lt)
      longTextsHtml += indexLongText(renderedLt)
    }

    const statsHtml = indexStats(toolStatsStr, longTextsHtml)
    const itemHtml = indexItem(promptNum, link, conv.timestamp, renderedContent, statsHtml)
    timelineItems.push([conv.timestamp, 'prompt', itemHtml])
  }

  // Add commits as separate timeline items
  for (const [commitTs, commitHash, commitMsg] of allCommits) {
    const itemHtml = indexCommit(commitHash, commitMsg, commitTs, _githubRepo)
    timelineItems.push([commitTs, 'commit', itemHtml])
  }

  // Sort by timestamp
  timelineItems.sort((a, b) => a[0].localeCompare(b[0]))
  const indexItemsHtml = timelineItems.map((item) => item[2]).join('')

  // Generate index page
  const indexPaginationHtml = indexPagination(totalPages)
  const indexContent = indexTemplate(
    indexPaginationHtml,
    promptNum,
    totalMessages,
    totalToolCalls,
    totalCommits,
    totalPages,
    indexItemsHtml
  )

  const indexPath = path.join(outputDir, 'index.html')
  fs.writeFileSync(indexPath, indexContent, 'utf-8')
  console.log(`Generated ${indexPath} (${totalConvs} prompts, ${totalPages} pages)`)
}

/**
 * Progress callback type for batch generation
 */
export type ProgressCallback = (
  projectName: string,
  sessionName: string,
  current: number,
  total: number
) => void

/**
 * Batch generation statistics
 */
export interface BatchStats {
  total_projects: number
  total_sessions: number
  failed_sessions: Array<{ project: string; session: string; error: string }>
  output_dir: string
}

/**
 * Generate HTML archive for all sessions in a Claude projects folder
 */
export function generateBatchHtml(
  sourceFolder: string,
  outputDir: string,
  includeAgents = false,
  progressCallback?: ProgressCallback
): BatchStats {
  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true })

  // Find all sessions
  const projects = findAllSessions(sourceFolder, includeAgents)

  // Calculate total for progress tracking
  const totalSessionCount = projects.reduce((sum, p) => sum + p.sessions.length, 0)
  let processedCount = 0
  let successfulSessions = 0
  const failedSessions: Array<{ project: string; session: string; error: string }> = []

  // Process each project
  for (const project of projects) {
    const projectDir = path.join(outputDir, project.name)
    fs.mkdirSync(projectDir, { recursive: true })

    // Process each session
    for (const session of project.sessions) {
      const sessionName = path.basename(session.path, path.extname(session.path))
      const sessionDir = path.join(projectDir, sessionName)

      try {
        generateHtml(session.path, sessionDir)
        successfulSessions++
      } catch (e) {
        failedSessions.push({
          project: project.name,
          session: sessionName,
          error: String(e),
        })
      }

      processedCount++

      if (progressCallback) {
        progressCallback(project.name, sessionName, processedCount, totalSessionCount)
      }
    }

    // Generate project index
    generateProjectIndex(project, projectDir)
  }

  // Generate master index
  generateMasterIndex(projects, outputDir)

  return {
    total_projects: projects.length,
    total_sessions: successfulSessions,
    failed_sessions: failedSessions,
    output_dir: outputDir,
  }
}

/**
 * Generate index.html for a single project
 */
function generateProjectIndex(project: ProjectInfo, outputDir: string): void {
  const sessionsData: TemplateSessionData[] = project.sessions.map((session) => {
    const modTime = new Date(session.mtime)
    return {
      name: path.basename(session.path, path.extname(session.path)),
      summary: session.summary,
      date: modTime.toISOString().slice(0, 16).replace('T', ' '),
      size_kb: session.size / 1024,
    }
  })

  const htmlContent = projectIndexTemplate(project.name, sessionsData, sessionsData.length)
  const outputPath = path.join(outputDir, 'index.html')
  fs.writeFileSync(outputPath, htmlContent, 'utf-8')
}

/**
 * Generate master index.html listing all projects
 */
function generateMasterIndex(projects: ProjectInfo[], outputDir: string): void {
  const projectsData: ProjectData[] = []
  let totalSessions = 0

  for (const project of projects) {
    const sessionCount = project.sessions.length
    totalSessions += sessionCount

    let recentDate = 'N/A'
    if (project.sessions.length > 0) {
      const mostRecent = new Date(project.sessions[0].mtime)
      recentDate = mostRecent.toISOString().slice(0, 10)
    }

    projectsData.push({
      name: project.name,
      session_count: sessionCount,
      recent_date: recentDate,
    })
  }

  const htmlContent = masterIndexTemplate(projectsData, projects.length, totalSessions)
  const outputPath = path.join(outputDir, 'index.html')
  fs.writeFileSync(outputPath, htmlContent, 'utf-8')
}

/**
 * Inject gist preview JS into all HTML files in output directory
 */
export function injectGistPreviewJsToDir(outputDir: string): void {
  const htmlFiles = fs.readdirSync(outputDir).filter((f) => f.endsWith('.html'))

  for (const htmlFile of htmlFiles) {
    const filePath = path.join(outputDir, htmlFile)
    let content = fs.readFileSync(filePath, 'utf-8')
    content = injectGistPreviewJs(content)
    fs.writeFileSync(filePath, content, 'utf-8')
  }
}

/**
 * Generate HTML from session data dict (instead of file path)
 * Used for web API sessions
 */
export function generateHtmlFromSessionData(
  sessionData: SessionData,
  outputDir: string,
  githubRepo: string | null = null
): void {
  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true })

  const loglines = sessionData.loglines || []

  // Auto-detect GitHub repo if not provided
  if (githubRepo === null) {
    githubRepo = detectGithubRepo(loglines)
    if (githubRepo) {
      console.log(`Auto-detected GitHub repo: ${githubRepo}`)
    }
  }

  // Set module-level variable for render functions
  _githubRepo = githubRepo

  // Group messages into conversations (one per user prompt)
  const conversations: Conversation[] = []
  let currentConv: Conversation | null = null

  for (const entry of loglines) {
    const logType = entry.type
    const timestamp = entry.timestamp || ''
    const isCompactSummary = entry.isCompactSummary || false
    const messageData = entry.message || {}

    if (!messageData || Object.keys(messageData).length === 0) {
      continue
    }

    const messageJson = JSON.stringify(messageData)

    let isUserPrompt = false
    let userText = ''

    if (logType === 'user') {
      const text = extractTextFromContent(messageData.content)
      if (text) {
        isUserPrompt = true
        userText = text
      }
    }

    if (isUserPrompt) {
      if (currentConv) {
        conversations.push(currentConv)
      }
      currentConv = {
        user_text: userText,
        timestamp,
        messages: [[logType, messageJson, timestamp]],
        is_continuation: Boolean(isCompactSummary),
      }
    } else if (currentConv) {
      currentConv.messages.push([logType, messageJson, timestamp])
    }
  }

  if (currentConv) {
    conversations.push(currentConv)
  }

  const totalConvs = conversations.length
  const totalPages = Math.ceil(totalConvs / PROMPTS_PER_PAGE)

  // Generate page files
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const startIdx = (pageNum - 1) * PROMPTS_PER_PAGE
    const endIdx = Math.min(startIdx + PROMPTS_PER_PAGE, totalConvs)
    const pageConvs = conversations.slice(startIdx, endIdx)

    const messagesHtml: string[] = []
    for (const conv of pageConvs) {
      let isFirst = true
      for (const [logType, messageJson, timestamp] of conv.messages) {
        let msgHtml = renderMessage(logType, messageJson, timestamp)
        if (msgHtml) {
          if (isFirst && conv.is_continuation) {
            msgHtml = `<details class="continuation"><summary>Session continuation summary</summary>${msgHtml}</details>`
          }
          messagesHtml.push(msgHtml)
        }
        isFirst = false
      }
    }

    const paginationHtml = pagination(pageNum, totalPages)
    const pageContent = pageTemplate(pageNum, totalPages, paginationHtml, messagesHtml.join(''))

    const pagePath = path.join(outputDir, `page-${String(pageNum).padStart(3, '0')}.html`)
    fs.writeFileSync(pagePath, pageContent, 'utf-8')
    console.log(`Generated page-${String(pageNum).padStart(3, '0')}.html`)
  }

  // Calculate overall stats
  const totalToolCounts: Record<string, number> = {}
  let totalMessages = 0
  const allCommits: Array<[string, string, string, number, number]> = []

  for (let i = 0; i < conversations.length; i++) {
    const conv = conversations[i]
    totalMessages += conv.messages.length
    const stats = analyzeConversation(conv.messages)

    for (const [tool, count] of Object.entries(stats.tool_counts)) {
      totalToolCounts[tool] = (totalToolCounts[tool] || 0) + count
    }

    const pageNum = Math.floor(i / PROMPTS_PER_PAGE) + 1
    for (const [commitHash, commitMsg, commitTs] of stats.commits) {
      allCommits.push([commitTs, commitHash, commitMsg, pageNum, i])
    }
  }

  const totalToolCalls = Object.values(totalToolCounts).reduce((a, b) => a + b, 0)
  const totalCommits = allCommits.length

  // Build timeline items
  const timelineItems: Array<[string, string, string]> = []

  let promptNum = 0
  for (let i = 0; i < conversations.length; i++) {
    const conv = conversations[i]

    if (conv.is_continuation) continue
    if (conv.user_text.startsWith('Stop hook feedback:')) continue

    promptNum++
    const pageNum = Math.floor(i / PROMPTS_PER_PAGE) + 1
    const msgId = makeMsgId(conv.timestamp)
    const link = `page-${String(pageNum).padStart(3, '0')}.html#${msgId}`
    const renderedContent = renderMarkdownText(conv.user_text)

    const allMessages = [...conv.messages]
    for (let j = i + 1; j < conversations.length; j++) {
      if (!conversations[j].is_continuation) break
      allMessages.push(...conversations[j].messages)
    }

    const stats = analyzeConversation(allMessages)
    const toolStatsStr = formatToolStats(stats.tool_counts)

    let longTextsHtml = ''
    for (const lt of stats.long_texts) {
      longTextsHtml += indexLongText(renderMarkdownText(lt))
    }

    const statsHtml = indexStats(toolStatsStr, longTextsHtml)
    const itemHtml = indexItem(promptNum, link, conv.timestamp, renderedContent, statsHtml)
    timelineItems.push([conv.timestamp, 'prompt', itemHtml])
  }

  for (const [commitTs, commitHash, commitMsg] of allCommits) {
    const itemHtml = indexCommit(commitHash, commitMsg, commitTs, _githubRepo)
    timelineItems.push([commitTs, 'commit', itemHtml])
  }

  timelineItems.sort((a, b) => a[0].localeCompare(b[0]))
  const indexItemsHtml = timelineItems.map((item) => item[2]).join('')

  const indexPaginationHtml = indexPagination(totalPages)
  const indexContent = indexTemplate(
    indexPaginationHtml,
    promptNum,
    totalMessages,
    totalToolCalls,
    totalCommits,
    totalPages,
    indexItemsHtml
  )

  const indexPath = path.join(outputDir, 'index.html')
  fs.writeFileSync(indexPath, indexContent, 'utf-8')
  console.log(`Generated ${indexPath} (${totalConvs} prompts, ${totalPages} pages)`)
}
