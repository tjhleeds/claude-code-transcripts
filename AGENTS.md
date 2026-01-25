# AGENTS.md

Instructions for AI assistants working on this codebase.

## Project Overview

This is a TypeScript CLI tool that converts Claude Code session files (JSON/JSONL) into clean, mobile-friendly HTML pages with pagination. It was recently migrated from Python (the original Python implementation is archived in the `python/` folder for reference).

## Quick Commands

```bash
# Build TypeScript
pnpm build

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run CLI in development mode (no build needed)
pnpm dev --help
pnpm dev json tests/sample_session.jsonl --open
```

## Architecture

### Source Files (src/)

- **cli.ts** - CLI application using Commander.js. Handles `local`, `json`, and `all` commands. Includes URL fetching, gist creation, and browser opening.

- **parser.ts** - Session file parsing. Key functions:
  - `parseSessionFile(filepath)` - Parse JSON/JSONL files
  - `findLocalSessions(folder, limit)` - List recent sessions from `~/.claude/projects`
  - `findAllSessions(folder, includeAgents)` - List all sessions grouped by project
  - `detectGithubRepo(loglines)` - Auto-detect GitHub repo from git push output

- **renderer.ts** - HTML generation engine. Key functions:
  - `generateHtml(jsonPath, outputDir, githubRepo?)` - Main entry point for single session
  - `generateBatchHtml(sourceFolder, outputDir, includeAgents)` - Batch convert all sessions
  - `renderMessage()`, `renderContentBlock()` - Message rendering
  - Tool-specific renderers: `renderBashTool()`, `renderEditTool()`, `renderWriteTool()`, `renderTodoWrite()`

- **templates.ts** - HTML template functions. All functions return HTML strings:
  - Layout: `baseTemplate()`, `pageTemplate()`, `indexTemplate()`, `pagination()`
  - Messages: `message()`, `userContent()`, `assistantText()`, `thinking()`
  - Tools: `toolUse()`, `toolResult()`, `bashTool()`, `editTool()`, `writeTool()`
  - Index: `indexItem()`, `indexCommit()`, `indexStats()`
  - Utilities: `escapeHtml()`, `injectGistPreviewJs()`

- **css.ts** - Embedded CSS stylesheet as a string constant

- **js.ts** - Embedded client-side JavaScript as a string constant (time formatting, JSON highlighting, content truncation)

- **index.ts** - Public API exports for use as a library

### Key Types (defined in parser.ts)

```typescript
interface ContentBlock {
  type: string;  // 'text', 'image', 'thinking', 'tool_use', 'tool_result'
  text?: string;
  thinking?: string;
  name?: string;  // tool name
  input?: Record<string, unknown>;
  // ... more fields
}

interface LogEntry {
  type: string;  // 'user' or 'assistant'
  timestamp?: string;
  message?: MessageData;
}

interface SessionData {
  loglines: LogEntry[];
}
```

### Output Structure

Single session generates:
```
output/
├── index.html       # Timeline with commits and stats
├── page-001.html    # First 5 conversations
├── page-002.html    # Next 5 conversations
└── ...
```

Batch mode (`all` command) generates:
```
output/
├── index.html       # Master index of all projects
├── project-name/
│   ├── index.html   # Project session listing
│   └── session-id/
│       ├── index.html
│       └── page-XXX.html
```

## Testing

Tests use Vitest. Run with `pnpm test`.

- **parser.test.ts** - File parsing, text extraction, session discovery
- **renderer.test.ts** - HTML generation, tool rendering, batch processing
- **templates.test.ts** - Template functions, HTML escaping

Test data files are in `tests/sample_session.json` and `tests/sample_session.jsonl`.

## Constants

- `PROMPTS_PER_PAGE = 5` - Conversations per HTML page
- `LONG_TEXT_THRESHOLD = 300` - Characters before truncating content

## Dependencies

- **commander** - CLI argument parsing
- **enquirer** - Interactive session picker
- **marked** - Markdown to HTML conversion
- **common-tags** - Template literal utilities (stripIndent)

## Common Tasks

### Adding a new tool renderer

1. Add rendering function in `renderer.ts` (e.g., `renderMyTool()`)
2. Add template function in `templates.ts` for HTML structure
3. Update `renderContentBlock()` to call new renderer for tool type
4. Add tests in `renderer.test.ts`

### Modifying HTML output

1. Edit template functions in `templates.ts`
2. Update CSS in `css.ts` if styling changes needed
3. Update JavaScript in `js.ts` if interactive behavior changes
4. Run tests to check for regressions

### Adding CLI options

1. Add option to command in `cli.ts` using Commander.js
2. Pass through to appropriate renderer/parser functions
3. Document in README.md
