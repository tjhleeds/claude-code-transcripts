# claude-code-transcripts

Convert Claude Code session files (JSON or JSONL) to clean, mobile-friendly HTML pages with pagination.

[Example transcript](https://static.simonwillison.net/static/2025/claude-code-microjs/index.html) produced using this tool.

Read [A new way to extract detailed transcripts from Claude Code](https://simonwillison.net/2025/Dec/25/claude-code-transcripts/) for background on this project.

> Note: This is a pure TypeScript port of `claude-code-transcripts`, originally written in Python by Simon Willison.

## Installation

Install with npm:
```bash
npm install -g claude-code-transcripts
```

Or run directly with npx:
```bash
npx claude-code-transcripts --help
```

## Usage

This tool converts Claude Code session files into browseable multi-page HTML transcripts.

There are three commands available:

- `local` (default) - select from local Claude Code sessions stored in `~/.claude/projects`
- `json` - convert a specific JSON or JSONL session file (or URL)
- `all` - convert all local sessions to a browsable HTML archive

The quickest way to view a recent local session:

```bash
claude-code-transcripts
```

This shows an interactive picker to select a session, generates HTML, and opens it in your default browser.

### Output options

All commands support these options:

- `-o, --output <directory>` - output directory (default: writes to temp dir and opens browser)
- `-a, --output-auto` - auto-name output subdirectory based on session ID or filename
- `--repo <owner/name>` - GitHub repo for commit links (auto-detected from git push output if not specified)
- `--open` - open the generated `index.html` in your default browser (default if no `-o` specified)
- `--gist` - upload the generated HTML files to a GitHub Gist and output a preview URL
- `--json` - include the original session file in the output directory

The generated output includes:
- `index.html` - an index page with a timeline of prompts and commits
- `page-001.html`, `page-002.html`, etc. - paginated transcript pages

### Local sessions

Local Claude Code sessions are stored as JSONL files in `~/.claude/projects`. Run with no arguments to select from recent sessions:

```bash
claude-code-transcripts
# or explicitly:
claude-code-transcripts local
```

Use `--limit` to control how many sessions are shown (default: 10):

```bash
claude-code-transcripts local --limit 20
```

### Publishing to GitHub Gist

Use the `--gist` option to automatically upload your transcript to a GitHub Gist and get a shareable preview URL:

```bash
claude-code-transcripts --gist
claude-code-transcripts json session.json --gist
```

This will output something like:
```
Gist: https://gist.github.com/username/abc123def456
Preview: https://gisthost.github.io/?abc123def456/index.html
Files: /var/folders/.../session-id
```

The preview URL uses [gisthost.github.io](https://gisthost.github.io/) to render your HTML gist. The tool automatically injects JavaScript to fix relative links when served through gisthost.

Combine with `-o` to keep a local copy:

```bash
claude-code-transcripts json session.json -o ./my-transcript --gist
```

**Requirements:** The `--gist` option requires the [GitHub CLI](https://cli.github.com/) (`gh`) to be installed and authenticated (`gh auth login`).

### Auto-naming output directories

Use `-a/--output-auto` to automatically create a subdirectory named after the session:

```bash
# Creates ./session_ABC123/ subdirectory
claude-code-transcripts json session_ABC123.json -a

# Creates ./transcripts/session_ABC123/ subdirectory
claude-code-transcripts json session.json -o ./transcripts -a
```

### Including the source file

Use the `--json` option to include the original session file in the output directory:

```bash
claude-code-transcripts json session.json -o ./my-transcript --json
```

This is useful for archiving the source data alongside the HTML output.

### Converting from JSON/JSONL files

Convert a specific session file directly:

```bash
claude-code-transcripts json session.json -o output-directory/
claude-code-transcripts json session.jsonl --open
```

This works with both JSONL files in the `~/.claude/projects/` folder and JSON session files.

The `json` command can take a URL to a JSON or JSONL file as an alternative to a path on disk:

```bash
claude-code-transcripts json https://example.com/session.jsonl --open
```

### Converting all sessions

Convert all your local Claude Code sessions to a browsable HTML archive:

```bash
claude-code-transcripts all
```

This creates a directory structure with:
- A master index listing all projects
- Per-project pages listing sessions
- Individual session transcripts

Options:

- `-s, --source <directory>` - source directory (default: `~/.claude/projects`)
- `-o, --output <directory>` - output directory (default: `./claude-archive`)
- `--include-agents` - include agent session files (excluded by default)
- `--dry-run` - show what would be converted without creating files
- `--open` - open the generated archive in your default browser
- `-q, --quiet` - suppress all output except errors

Examples:

```bash
# Preview what would be converted
claude-code-transcripts all --dry-run

# Convert all sessions and open in browser
claude-code-transcripts all --open

# Convert to a specific directory
claude-code-transcripts all -o ./my-archive

# Include agent sessions
claude-code-transcripts all --include-agents
```

## Features

- **Session Parsing**: Supports JSON and JSONL formats with graceful error handling
- **Markdown Rendering**: Full markdown support in all text blocks
- **Code Highlighting**: Syntax-highlighted JSON output
- **Git Integration**: Auto-detects GitHub repos, creates clickable commit links
- **Responsive Design**: Mobile-friendly with touch-friendly buttons
- **Pagination**: Splits conversations into manageable pages (5 per page)
- **Content Truncation**: Long content can be expanded/collapsed
- **Interactive Timestamps**: Shows relative times in browser
- **Batch Processing**: Convert entire session archives with progress tracking
- **GitHub Gist Publishing**: One-command publishing with preview URLs
- **Image Embedding**: Embedded image support in tool results
- **Thinking Blocks**: Collapsible AI thinking visualization
- **Tool Display**: Custom rendering for Bash, Write, Edit, and TodoWrite tools

## Development

Clone the repository and install dependencies:

```bash
git clone https://github.com/simonw/claude-code-transcripts
cd claude-code-transcripts
pnpm install
```

Build the TypeScript:

```bash
pnpm build
```

Run tests:

```bash
pnpm test
# or watch mode:
pnpm test:watch
```

Run the CLI in development mode:

```bash
pnpm dev --help
pnpm dev json session.jsonl --open
```

### Project Structure

```
src/
├── cli.ts        # CLI application with Commander.js
├── parser.ts     # Session file parsing (JSON/JSONL)
├── renderer.ts   # HTML generation engine
├── templates.ts  # HTML template functions
├── css.ts        # Embedded CSS stylesheet
├── js.ts         # Embedded client-side JavaScript
└── index.ts      # Public API exports

tests/
├── parser.test.ts
├── renderer.test.ts
├── templates.test.ts
└── sample_session.json/jsonl
```
