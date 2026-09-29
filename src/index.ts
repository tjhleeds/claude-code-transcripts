/**
 * Claude Code Transcripts
 * Convert Claude Code session JSON to clean mobile-friendly HTML pages with pagination
 */

// Re-export from parser
export {
  extractTextFromContent,
  getSessionSummary,
  parseSessionFile,
  getProjectDisplayName,
  findLocalSessions,
  findSessionById,
  findAllSessions,
  detectGithubRepo,
  getDefaultProjectsFolder,
  COMMIT_PATTERN,
  GITHUB_REPO_PATTERN,
  type ContentBlock,
  type MessageData,
  type LogEntry,
  type SessionData,
  type SessionInfo,
  type ProjectInfo,
} from './parser.js'

// Re-export from renderer
export {
  formatJson,
  renderMarkdownText,
  isJsonLike,
  renderTodoWrite,
  renderWriteTool,
  renderEditTool,
  renderBashTool,
  renderContentBlock,
  renderUserMessageContent,
  renderAssistantMessage,
  makeMsgId,
  isToolResultMessage,
  renderMessage,
  analyzeConversation,
  formatToolStats,
  generateHtml,
  generateBatchHtml,
  generateHtmlFromSessionData,
  PROMPTS_PER_PAGE,
  LONG_TEXT_THRESHOLD,
  type ConversationStats,
  type ProgressCallback,
  type BatchStats,
} from './renderer.js'

// Re-export from templates
export {
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
  baseTemplate,
  pageTemplate,
  indexTemplate,
  projectIndexTemplate,
  masterIndexTemplate,
  type TodoItem,
  type SessionData as TemplateSessionData,
  type ProjectData,
} from './templates.js'

// Re-export CSS and JS constants
export { CSS } from './css.js'
export { JS } from './js.js'
