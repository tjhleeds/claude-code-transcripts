#!/usr/bin/env node
/**
 * CLI for Claude Code Transcripts
 */

import { program } from 'commander'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

import pkg from '../package.json' with { type: 'json' }

const { version } = pkg
import { spawn } from 'node:child_process'
import Enquirer from 'enquirer'

import {
  findLocalSessions,
  findSessionById,
  findAllSessions,
  getSessionSummary,
  getDefaultProjectsFolder,
} from './parser.js'

import {
  generateHtml,
  generateBatchHtml,
} from './renderer.js'

const enquirer = new Enquirer()

/**
 * Open a URL in the default browser
 */
function openBrowser(url: string): void {
  const platform = process.platform
  let cmd: string
  let args: string[]

  if (platform === 'darwin') {
    cmd = 'open'
    args = [url]
  } else if (platform === 'win32') {
    cmd = 'cmd'
    args = ['/c', 'start', url]
  } else {
    cmd = 'xdg-open'
    args = [url]
  }

  spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref()
}

/**
 * Format a date for display
 */
function formatDate(date: Date): string {
  return date.toISOString().slice(0, 16).replace('T', ' ')
}

// Set up CLI
program
  .name('claude-code-transcripts')
  .description('Convert Claude Code session JSON to mobile-friendly HTML pages')
  .version(version)

// Local command (default)
program
  .command('local [sessionId]', { isDefault: true })
  .description('Select and convert a local Claude Code session to HTML (or pass a session ID to skip selection)')
  .option('-o, --output <dir>', 'Output directory')
  .option('-a, --output-auto', 'Auto-name output subdirectory based on session filename')
  .option('--repo <repo>', 'GitHub repo (owner/name) for commit links')
  .option('--json', 'Include the original JSONL session file in output')
  .option('--open', 'Open in browser')
  .option('--limit <n>', 'Maximum sessions to show', '10')
  .action(async (sessionId: string | undefined, options) => {
    const projectsFolder = getDefaultProjectsFolder()

    if (!fs.existsSync(projectsFolder)) {
      console.log(`Projects folder not found: ${projectsFolder}`)
      console.log('No local Claude Code sessions available.')
      return
    }

    let sessionFile: string

    if (sessionId) {
      const found = findSessionById(projectsFolder, sessionId)
      if (!found) {
        console.error(`Error: Session not found: ${sessionId}`)
        process.exit(1)
      }
      sessionFile = found
    } else {
      console.log('Loading local sessions...')
      const results = findLocalSessions(projectsFolder, parseInt(options.limit))

      if (results.length === 0) {
        console.log('No local sessions found.')
        return
      }

      // Build choices for selection
      const choices = results.map(({ path: filepath, summary }) => {
        const stat = fs.statSync(filepath)
        const modTime = new Date(stat.mtimeMs)
        const sizeKb = stat.size / 1024
        const dateStr = formatDate(modTime)
        const truncatedSummary = summary.length > 50 ? summary.slice(0, 47) + '...' : summary
        return {
          name: filepath,
          message: `${dateStr}  ${sizeKb.toFixed(0).padStart(5)} KB  ${truncatedSummary}`,
        }
      })

      let response: { session: string }
      try {
        response = await enquirer.prompt({
          type: 'select',
          name: 'session',
          message: 'Select a session to convert:',
          choices,
        }) as { session: string }
      } catch {
        console.log('No session selected.')
        return
      }

      sessionFile = response.session
    }

    const sessionStem = path.basename(sessionFile, path.extname(sessionFile))

    // Determine output directory
    const autoOpen = !options.output && !options.outputAuto
    let outputDir: string

    if (options.outputAuto) {
      const parentDir = options.output || '.'
      outputDir = path.join(parentDir, sessionStem)
    } else if (options.output) {
      outputDir = options.output
    } else {
      outputDir = path.join(os.tmpdir(), `claude-session-${sessionStem}`)
    }

    generateHtml(sessionFile, outputDir, options.repo || null)
    console.log(`Output: ${path.resolve(outputDir)}`)

    // Copy JSONL file if requested
    if (options.json) {
      fs.mkdirSync(outputDir, { recursive: true })
      const jsonDest = path.join(outputDir, path.basename(sessionFile))
      fs.copyFileSync(sessionFile, jsonDest)
      const jsonSizeKb = fs.statSync(jsonDest).size / 1024
      console.log(`JSONL: ${jsonDest} (${jsonSizeKb.toFixed(1)} KB)`)
    }

    if (options.open || autoOpen) {
      const indexUrl = `file://${path.resolve(outputDir, 'index.html')}`
      openBrowser(indexUrl)
    }
  })

// JSON command
program
  .command('json <file>')
  .description('Convert a Claude Code session JSON/JSONL file to HTML')
  .option('-o, --output <dir>', 'Output directory')
  .option('-a, --output-auto', 'Auto-name output subdirectory based on filename')
  .option('--repo <repo>', 'GitHub repo (owner/name) for commit links')
  .option('--json', 'Include the original JSON file in output')
  .option('--open', 'Open in browser')
  .action(async (file, options) => {
    const jsonFilePath: string = file
    if (!fs.existsSync(jsonFilePath)) {
      console.error(`Error: File not found: ${file}`)
      process.exit(1)
    }

    const fileStem = path.basename(jsonFilePath, path.extname(jsonFilePath))

    // Determine output directory
    const autoOpen = !options.output && !options.outputAuto
    let outputDir: string

    if (options.outputAuto) {
      const parentDir = options.output || '.'
      outputDir = path.join(parentDir, fileStem)
    } else if (options.output) {
      outputDir = options.output
    } else {
      outputDir = path.join(os.tmpdir(), `claude-session-${fileStem}`)
    }

    generateHtml(jsonFilePath, outputDir, options.repo || null)
    console.log(`Output: ${path.resolve(outputDir)}`)

    // Copy JSON file if requested
    if (options.json) {
      fs.mkdirSync(outputDir, { recursive: true })
      const jsonDest = path.join(outputDir, path.basename(jsonFilePath))
      fs.copyFileSync(jsonFilePath, jsonDest)
      const jsonSizeKb = fs.statSync(jsonDest).size / 1024
      console.log(`JSON: ${jsonDest} (${jsonSizeKb.toFixed(1)} KB)`)
    }

    if (options.open || autoOpen) {
      const indexUrl = `file://${path.resolve(outputDir, 'index.html')}`
      openBrowser(indexUrl)
    }
  })

// All command
program
  .command('all')
  .description('Convert all local Claude Code sessions to a browsable HTML archive')
  .option('-s, --source <dir>', 'Source directory containing Claude projects')
  .option('-o, --output <dir>', 'Output directory for the archive', './claude-archive')
  .option('--include-agents', 'Include agent-* session files')
  .option('--dry-run', 'Show what would be converted without creating files')
  .option('--open', 'Open the generated archive in browser')
  .option('-q, --quiet', 'Suppress all output except errors')
  .action((options) => {
    const sourceFolder = options.source || getDefaultProjectsFolder()

    if (!fs.existsSync(sourceFolder)) {
      console.error(`Error: Source directory not found: ${sourceFolder}`)
      process.exit(1)
    }

    const outputDir = options.output

    if (!options.quiet) {
      console.log(`Scanning ${sourceFolder}...`)
    }

    const projects = findAllSessions(sourceFolder, options.includeAgents)

    if (projects.length === 0) {
      if (!options.quiet) {
        console.log('No sessions found.')
      }
      return
    }

    const totalSessions = projects.reduce((sum, p) => sum + p.sessions.length, 0)

    if (!options.quiet) {
      console.log(`Found ${projects.length} projects with ${totalSessions} sessions`)
    }

    if (options.dryRun) {
      if (!options.quiet) {
        console.log('\nDry run - would convert:')
        for (const project of projects) {
          console.log(`\n  ${project.name} (${project.sessions.length} sessions)`)
          for (const session of project.sessions.slice(0, 3)) {
            const modTime = new Date(session.mtime)
            const dateStr = modTime.toISOString().slice(0, 10)
            console.log(`    - ${path.basename(session.path, '.jsonl')} (${dateStr})`)
          }
          if (project.sessions.length > 3) {
            console.log(`    ... and ${project.sessions.length - 3} more`)
          }
        }
      }
      return
    }

    if (!options.quiet) {
      console.log(`\nGenerating archive in ${outputDir}...`)
    }

    // Progress callback
    const onProgress = (projectName: string, sessionName: string, current: number, total: number) => {
      if (!options.quiet && current % 10 === 0) {
        console.log(`  Processed ${current}/${total} sessions...`)
      }
    }

    const stats = generateBatchHtml(sourceFolder, outputDir, options.includeAgents, onProgress)

    // Report failures
    if (stats.failed_sessions.length > 0) {
      console.log(`\nWarning: ${stats.failed_sessions.length} session(s) failed:`)
      for (const failure of stats.failed_sessions) {
        console.log(`  ${failure.project}/${failure.session}: ${failure.error}`)
      }
    }

    if (!options.quiet) {
      console.log(`\nGenerated archive with ${stats.total_projects} projects, ${stats.total_sessions} sessions`)
      console.log(`Output: ${path.resolve(outputDir)}`)
    }

    if (options.open) {
      const indexUrl = `file://${path.resolve(outputDir, 'index.html')}`
      openBrowser(indexUrl)
    }
  })

// Parse and run
program.parse()
