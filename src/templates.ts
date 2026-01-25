/**
 * Template rendering functions - TypeScript equivalents of Jinja2 macros
 */

import { stripIndent } from 'common-tags'
import { CSS } from './css.js'
import { JS, GIST_PREVIEW_JS } from './js.js'

// HTML escaping utility
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// Zero-pad a number to 3 digits (for page-001.html format)
function padPage(n: number): string {
  return n.toString().padStart(3, '0')
}

/**
 * Pagination for regular pages
 */
export function pagination(currentPage: number, totalPages: number): string {
  if (totalPages <= 1) {
    return '<div class="pagination"><a href="index.html" class="index-link">Index</a></div>'
  }

  let html = '<div class="pagination">\n<a href="index.html" class="index-link">Index</a>\n'

  // Prev link
  if (currentPage > 1) {
    html += `<a href="page-${padPage(currentPage - 1)}.html">&larr; Prev</a>\n`
  } else {
    html += '<span class="disabled">&larr; Prev</span>\n'
  }

  // Page numbers
  for (let page = 1; page <= totalPages; page++) {
    if (page === currentPage) {
      html += `<span class="current">${page}</span>\n`
    } else {
      html += `<a href="page-${padPage(page)}.html">${page}</a>\n`
    }
  }

  // Next link
  if (currentPage < totalPages) {
    html += `<a href="page-${padPage(currentPage + 1)}.html">Next &rarr;</a>\n`
  } else {
    html += '<span class="disabled">Next &rarr;</span>\n'
  }

  html += '</div>'
  return html
}

/**
 * Pagination for index page
 */
export function indexPagination(totalPages: number): string {
  if (totalPages < 1) {
    return '<div class="pagination"><span class="current">Index</span></div>'
  }

  let html = '<div class="pagination">\n<span class="current">Index</span>\n'
  html += '<span class="disabled">&larr; Prev</span>\n'

  for (let page = 1; page <= totalPages; page++) {
    html += `<a href="page-${padPage(page)}.html">${page}</a>\n`
  }

  if (totalPages >= 1) {
    html += '<a href="page-001.html">Next &rarr;</a>\n'
  } else {
    html += '<span class="disabled">Next &rarr;</span>\n'
  }

  html += '</div>'
  return html
}

/**
 * Todo list
 */
export interface TodoItem {
  status?: 'pending' | 'in_progress' | 'completed'
  content?: string
}

export function todoList(todos: TodoItem[], toolId: string): string {
  let itemsHtml = ''
  for (const todo of todos) {
    const status = todo.status || 'pending'
    const content = todo.content || ''

    let icon: string
    let statusClass: string
    if (status === 'completed') {
      icon = '✓'
      statusClass = 'todo-completed'
    } else if (status === 'in_progress') {
      icon = '→'
      statusClass = 'todo-in-progress'
    } else {
      icon = '○'
      statusClass = 'todo-pending'
    }

    itemsHtml += `<li class="todo-item ${statusClass}"><span class="todo-icon">${icon}</span><span class="todo-content">${escapeHtml(content)}</span></li>`
  }

  return `<div class="todo-list" data-tool-id="${escapeHtml(toolId)}"><div class="todo-header"><span class="todo-header-icon">☰</span> Task List</div><ul class="todo-items">${itemsHtml}</ul></div>`
}

/**
 * Write tool
 */
export function writeTool(filePath: string, content: string, toolId: string): string {
  const filename = filePath.includes('/') ? filePath.split('/').pop()! : filePath

  return stripIndent`
    <div class="file-tool write-tool" data-tool-id="${escapeHtml(toolId)}">
      <div class="file-tool-header write-header"><span class="file-tool-icon">📝</span> Write <span class="file-tool-path">${escapeHtml(filename)}</span></div>
      <div class="file-tool-fullpath">${escapeHtml(filePath)}</div>
      <div class="truncatable"><div class="truncatable-content"><pre class="file-content">${escapeHtml(content)}</pre></div><button class="expand-btn">Show more</button></div>
    </div>
  `
}

/**
 * Edit tool
 */
export function editTool(
  filePath: string,
  oldString: string,
  newString: string,
  replaceAll: boolean,
  toolId: string
): string {
  const filename = filePath.includes('/') ? filePath.split('/').pop()! : filePath
  const replaceAllSpan = replaceAll ? ' <span class="edit-replace-all">(replace all)</span>' : ''

  return stripIndent`
    <div class="file-tool edit-tool" data-tool-id="${escapeHtml(toolId)}">
      <div class="file-tool-header edit-header"><span class="file-tool-icon">✏️</span> Edit <span class="file-tool-path">${escapeHtml(filename)}</span>${replaceAllSpan}</div>
      <div class="file-tool-fullpath">${escapeHtml(filePath)}</div>
      <div class="truncatable"><div class="truncatable-content">
        <div class="edit-section edit-old"><div class="edit-label">−</div><pre class="edit-content">${escapeHtml(oldString)}</pre></div>
        <div class="edit-section edit-new"><div class="edit-label">+</div><pre class="edit-content">${escapeHtml(newString)}</pre></div>
      </div><button class="expand-btn">Show more</button></div>
    </div>
  `
}

/**
 * Bash tool
 */
export function bashTool(command: string, description: string, toolId: string): string {
  const descHtml = description
    ? `<div class="tool-description">${escapeHtml(description)}</div>`
    : ''

  return stripIndent`
    <div class="tool-use bash-tool" data-tool-id="${escapeHtml(toolId)}">
      <div class="tool-header"><span class="tool-icon">$</span> Bash</div>
      ${descHtml}<div class="truncatable"><div class="truncatable-content"><pre class="bash-command">${escapeHtml(command)}</pre></div><button class="expand-btn">Show more</button></div>
    </div>
  `
}

/**
 * Generic tool use - inputJson is pre-formatted
 */
export function toolUse(
  toolName: string,
  description: string,
  inputJson: string,
  toolId: string
): string {
  const descHtml = description
    ? `<div class="tool-description">${escapeHtml(description)}</div>`
    : ''

  return stripIndent`
    <div class="tool-use" data-tool-id="${escapeHtml(toolId)}">
      <div class="tool-header"><span class="tool-icon">⚙</span> ${escapeHtml(toolName)}</div>
      ${descHtml}<div class="truncatable"><div class="truncatable-content"><pre class="json">${escapeHtml(inputJson)}</pre></div><button class="expand-btn">Show more</button></div>
    </div>
  `
}

/**
 * Tool result - contentHtml is pre-rendered
 * hasImages=true disables truncation so images are always visible
 */
export function toolResult(contentHtml: string, isError: boolean, hasImages = false): string {
  const errorClass = isError ? ' tool-error' : ''

  if (hasImages) {
    return `<div class="tool-result${errorClass}">${contentHtml}</div>`
  }

  return `<div class="tool-result${errorClass}"><div class="truncatable"><div class="truncatable-content">${contentHtml}</div><button class="expand-btn">Show more</button></div></div>`
}

/**
 * Thinking block - contentHtml is pre-rendered markdown
 */
export function thinking(contentHtml: string): string {
  return `<div class="thinking"><div class="thinking-label">Thinking</div>${contentHtml}</div>`
}

/**
 * Assistant text - contentHtml is pre-rendered markdown
 */
export function assistantText(contentHtml: string): string {
  return `<div class="assistant-text">${contentHtml}</div>`
}

/**
 * User content - contentHtml is pre-rendered
 */
export function userContent(contentHtml: string): string {
  return `<div class="user-content">${contentHtml}</div>`
}

/**
 * Image block with base64 data URL
 */
export function imageBlock(mediaType: string, data: string): string {
  return `<div class="image-block"><img src="data:${escapeHtml(mediaType)};base64,${data}" style="max-width: 100%"></div>`
}

/**
 * Commit card (in tool results)
 */
export function commitCard(
  commitHash: string,
  commitMsg: string,
  githubRepo: string | null
): string {
  const shortHash = commitHash.slice(0, 7)

  if (githubRepo) {
    const githubLink = `https://github.com/${githubRepo}/commit/${commitHash}`
    return `<div class="commit-card"><a href="${escapeHtml(githubLink)}"><span class="commit-card-hash">${escapeHtml(shortHash)}</span> ${escapeHtml(commitMsg)}</a></div>`
  }

  return `<div class="commit-card"><span class="commit-card-hash">${escapeHtml(shortHash)}</span> ${escapeHtml(commitMsg)}</div>`
}

/**
 * Message wrapper - contentHtml is pre-rendered
 */
export function message(
  roleClass: string,
  roleLabel: string,
  msgId: string,
  timestamp: string,
  contentHtml: string
): string {
  return `<div class="message ${roleClass}" id="${escapeHtml(msgId)}"><div class="message-header"><span class="role-label">${escapeHtml(roleLabel)}</span><a href="#${escapeHtml(msgId)}" class="timestamp-link"><time datetime="${escapeHtml(timestamp)}" data-timestamp="${escapeHtml(timestamp)}">${escapeHtml(timestamp)}</time></a></div><div class="message-content">${contentHtml}</div></div>`
}

/**
 * Index item (prompt) - renderedContent and statsHtml are pre-rendered
 */
export function indexItem(
  promptNum: number,
  link: string,
  timestamp: string,
  renderedContent: string,
  statsHtml: string
): string {
  return `<div class="index-item"><a href="${escapeHtml(link)}"><div class="index-item-header"><span class="index-item-number">#${promptNum}</span><time datetime="${escapeHtml(timestamp)}" data-timestamp="${escapeHtml(timestamp)}">${escapeHtml(timestamp)}</time></div><div class="index-item-content">${renderedContent}</div></a>${statsHtml}</div>`
}

/**
 * Index commit
 */
export function indexCommit(
  commitHash: string,
  commitMsg: string,
  timestamp: string,
  githubRepo: string | null
): string {
  const shortHash = commitHash.slice(0, 7)

  if (githubRepo) {
    const githubLink = `https://github.com/${githubRepo}/commit/${commitHash}`
    return `<div class="index-commit"><a href="${escapeHtml(githubLink)}"><div class="index-commit-header"><span class="index-commit-hash">${escapeHtml(shortHash)}</span><time datetime="${escapeHtml(timestamp)}" data-timestamp="${escapeHtml(timestamp)}">${escapeHtml(timestamp)}</time></div><div class="index-commit-msg">${escapeHtml(commitMsg)}</div></a></div>`
  }

  return `<div class="index-commit"><div class="index-commit-header"><span class="index-commit-hash">${escapeHtml(shortHash)}</span><time datetime="${escapeHtml(timestamp)}" data-timestamp="${escapeHtml(timestamp)}">${escapeHtml(timestamp)}</time></div><div class="index-commit-msg">${escapeHtml(commitMsg)}</div></div>`
}

/**
 * Index stats - toolStatsStr and longTextsHtml are pre-rendered
 */
export function indexStats(toolStatsStr: string, longTextsHtml: string): string {
  if (!toolStatsStr && !longTextsHtml) {
    return ''
  }

  const toolStatsSpan = toolStatsStr ? `<span>${escapeHtml(toolStatsStr)}</span>` : ''

  return `<div class="index-item-stats">${toolStatsSpan}${longTextsHtml}</div>`
}

/**
 * Long text in index - renderedContent is pre-rendered markdown
 */
export function indexLongText(renderedContent: string): string {
  return `<div class="index-item-long-text"><div class="truncatable"><div class="truncatable-content"><div class="index-item-long-text-content">${renderedContent}</div></div><button class="expand-btn">Show more</button></div></div>`
}

/**
 * Base HTML template
 */
export function baseTemplate(title: string, content: string): string {
  return stripIndent`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${escapeHtml(title)}</title>
        <style>${CSS}</style>
    </head>
    <body>
        <div class="container">
    ${content}
        </div>
        <script>${JS}</script>
    </body>
    </html>
  `
}

/**
 * Page template
 */
export function pageTemplate(
  pageNum: number,
  totalPages: number,
  paginationHtml: string,
  messagesHtml: string
): string {
  const content = stripIndent`
    <h1><a href="index.html" style="color: inherit; text-decoration: none;">Claude Code transcript</a> - page ${pageNum}/${totalPages}</h1>
    ${paginationHtml}
    ${messagesHtml}
    ${paginationHtml}
  `

  return baseTemplate(`Claude Code transcript - page ${pageNum}`, content)
}

/**
 * Search JS template (with totalPages injected)
 */
function searchJs(totalPages: number): string {
  // This is the search.js content from Python - converted to use totalPages variable
  return `(function() {
    var totalPages = ${totalPages};
    var searchBox = document.getElementById('search-box');
    var searchInput = document.getElementById('search-input');
    var searchBtn = document.getElementById('search-btn');
    var modal = document.getElementById('search-modal');
    var modalInput = document.getElementById('modal-search-input');
    var modalSearchBtn = document.getElementById('modal-search-btn');
    var modalCloseBtn = document.getElementById('modal-close-btn');
    var searchStatus = document.getElementById('search-status');
    var searchResults = document.getElementById('search-results');

    if (!searchBox || !modal) return;

    // Hide search on file:// protocol (doesn't work due to CORS restrictions)
    if (window.location.protocol === 'file:') return;

    // Show search box (progressive enhancement)
    searchBox.style.display = 'flex';

    // Gist preview support - detect if we're on gisthost.github.io or gistpreview.github.io
    var hostname = window.location.hostname;
    var isGistPreview = hostname === 'gisthost.github.io' || hostname === 'gistpreview.github.io';
    var gistId = null;
    var gistOwner = null;
    var gistInfoLoaded = false;

    if (isGistPreview) {
        // Extract gist ID from URL query string like ?78a436a8a9e7a2e603738b8193b95410/index.html
        var queryMatch = window.location.search.match(/^\\?([a-f0-9]+)/i);
        if (queryMatch) {
            gistId = queryMatch[1];
        }
    }

    async function loadGistInfo() {
        if (!isGistPreview || !gistId || gistInfoLoaded) return;
        try {
            var response = await fetch('https://api.github.com/gists/' + gistId);
            if (response.ok) {
                var info = await response.json();
                gistOwner = info.owner.login;
                gistInfoLoaded = true;
            }
        } catch (e) {
            console.error('Failed to load gist info:', e);
        }
    }

    function getPageFetchUrl(pageFile) {
        if (isGistPreview && gistOwner && gistId) {
            // Use raw gist URL for fetching content
            return 'https://gist.githubusercontent.com/' + gistOwner + '/' + gistId + '/raw/' + pageFile;
        }
        return pageFile;
    }

    function getPageLinkUrl(pageFile) {
        if (isGistPreview && gistId) {
            // Use gistpreview URL format for navigation links
            return '?' + gistId + '/' + pageFile;
        }
        return pageFile;
    }

    function escapeHtml(text) {
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function escapeRegex(string) {
        return string.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\' + '$&');
    }

    function openModal(query) {
        modalInput.value = query || '';
        searchResults.innerHTML = '';
        searchStatus.textContent = '';
        modal.showModal();
        modalInput.focus();
        if (query) {
            performSearch(query);
        }
    }

    function closeModal() {
        modal.close();
        // Update URL to remove search fragment, preserving path and query string
        if (window.location.hash.startsWith('#search=')) {
            history.replaceState(null, '', window.location.pathname + window.location.search);
        }
    }

    function updateUrlHash(query) {
        if (query) {
            // Preserve path and query string when adding hash
            history.replaceState(null, '', window.location.pathname + window.location.search + '#search=' + encodeURIComponent(query));
        }
    }

    function highlightTextNodes(element, searchTerm) {
        var walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
        var nodesToReplace = [];

        while (walker.nextNode()) {
            var node = walker.currentNode;
            if (node.nodeValue.toLowerCase().indexOf(searchTerm.toLowerCase()) !== -1) {
                nodesToReplace.push(node);
            }
        }

        nodesToReplace.forEach(function(node) {
            var text = node.nodeValue;
            var regex = new RegExp('(' + escapeRegex(searchTerm) + ')', 'gi');
            var parts = text.split(regex);
            if (parts.length > 1) {
                var span = document.createElement('span');
                parts.forEach(function(part) {
                    if (part.toLowerCase() === searchTerm.toLowerCase()) {
                        var mark = document.createElement('mark');
                        mark.textContent = part;
                        span.appendChild(mark);
                    } else {
                        span.appendChild(document.createTextNode(part));
                    }
                });
                node.parentNode.replaceChild(span, node);
            }
        });
    }

    function fixInternalLinks(element, pageFile) {
        // Update all internal anchor links to include the page file
        var links = element.querySelectorAll('a[href^="#"]');
        links.forEach(function(link) {
            var href = link.getAttribute('href');
            link.setAttribute('href', pageFile + href);
        });
    }

    function processPage(pageFile, html, query) {
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, 'text/html');
        var resultsFromPage = 0;

        // Find all message blocks
        var messages = doc.querySelectorAll('.message');
        messages.forEach(function(msg) {
            var text = msg.textContent || '';
            if (text.toLowerCase().indexOf(query.toLowerCase()) !== -1) {
                resultsFromPage++;

                // Get the message ID for linking
                var msgId = msg.id || '';
                var pageLinkUrl = getPageLinkUrl(pageFile);
                var link = pageLinkUrl + (msgId ? '#' + msgId : '');

                // Clone the message HTML and highlight matches
                var clone = msg.cloneNode(true);
                // Fix internal links to include the page file
                fixInternalLinks(clone, pageLinkUrl);
                highlightTextNodes(clone, query);

                var resultDiv = document.createElement('div');
                resultDiv.className = 'search-result';
                resultDiv.innerHTML = '<a href="' + link + '">' +
                    '<div class="search-result-page">' + escapeHtml(pageFile) + '</div>' +
                    '<div class="search-result-content">' + clone.innerHTML + '</div>' +
                    '</a>';
                searchResults.appendChild(resultDiv);
            }
        });

        return resultsFromPage;
    }

    async function performSearch(query) {
        if (!query.trim()) {
            searchStatus.textContent = 'Enter a search term';
            return;
        }

        updateUrlHash(query);
        searchResults.innerHTML = '';
        searchStatus.textContent = 'Searching...';

        // Load gist info if on gistpreview (needed for constructing URLs)
        if (isGistPreview && !gistInfoLoaded) {
            searchStatus.textContent = 'Loading gist info...';
            await loadGistInfo();
            if (!gistOwner) {
                searchStatus.textContent = 'Failed to load gist info. Search unavailable.';
                return;
            }
        }

        var resultsFound = 0;
        var pagesSearched = 0;

        // Build list of pages to fetch
        var pagesToFetch = [];
        for (var i = 1; i <= totalPages; i++) {
            pagesToFetch.push('page-' + String(i).padStart(3, '0') + '.html');
        }

        searchStatus.textContent = 'Searching...';

        // Process pages in batches of 3, but show results immediately as each completes
        var batchSize = 3;
        for (var i = 0; i < pagesToFetch.length; i += batchSize) {
            var batch = pagesToFetch.slice(i, i + batchSize);

            // Create promises that process results immediately when each fetch completes
            var promises = batch.map(function(pageFile) {
                return fetch(getPageFetchUrl(pageFile))
                    .then(function(response) {
                        if (!response.ok) throw new Error('Failed to fetch');
                        return response.text();
                    })
                    .then(function(html) {
                        // Process and display results immediately
                        var count = processPage(pageFile, html, query);
                        resultsFound += count;
                        pagesSearched++;
                        searchStatus.textContent = 'Found ' + resultsFound + ' result(s) in ' + pagesSearched + '/' + totalPages + ' pages...';
                    })
                    .catch(function() {
                        pagesSearched++;
                        searchStatus.textContent = 'Found ' + resultsFound + ' result(s) in ' + pagesSearched + '/' + totalPages + ' pages...';
                    });
            });

            // Wait for this batch to complete before starting the next
            await Promise.all(promises);
        }

        searchStatus.textContent = 'Found ' + resultsFound + ' result(s) in ' + totalPages + ' pages';
    }

    // Event listeners
    searchBtn.addEventListener('click', function() {
        openModal(searchInput.value);
    });

    searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            openModal(searchInput.value);
        }
    });

    modalSearchBtn.addEventListener('click', function() {
        performSearch(modalInput.value);
    });

    modalInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            performSearch(modalInput.value);
        }
    });

    modalCloseBtn.addEventListener('click', closeModal);

    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeModal();
        }
    });

    // Check for #search= in URL on page load
    if (window.location.hash.startsWith('#search=')) {
        var query = decodeURIComponent(window.location.hash.substring(8));
        if (query) {
            searchInput.value = query;
            openModal(query);
        }
    }
})();`
}

/**
 * Index template
 */
export function indexTemplate(
  paginationHtml: string,
  promptNum: number,
  totalMessages: number,
  totalToolCalls: number,
  totalCommits: number,
  totalPages: number,
  indexItemsHtml: string
): string {
  const content = stripIndent`
    <div class="header-row">
      <h1>Claude Code transcript</h1>
      <div id="search-box">
        <input type="text" id="search-input" placeholder="Search..." aria-label="Search transcripts">
        <button id="search-btn" type="button" aria-label="Search">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg>
        </button>
      </div>
    </div>
    ${paginationHtml}
    <p style="color: var(--text-muted); margin-bottom: 24px;">${promptNum} prompts · ${totalMessages} messages · ${totalToolCalls} tool calls · ${totalCommits} commits · ${totalPages} pages</p>
    ${indexItemsHtml}
    ${paginationHtml}

    <dialog id="search-modal">
      <div class="search-modal-header">
        <input type="text" id="modal-search-input" placeholder="Search..." aria-label="Search transcripts">
        <button id="modal-search-btn" type="button" aria-label="Search">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg>
        </button>
        <button id="modal-close-btn" type="button" aria-label="Close">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>
        </button>
      </div>
      <div id="search-status"></div>
      <div id="search-results"></div>
    </dialog>
    <script>
    ${searchJs(totalPages)}
    </script>
  `

  return baseTemplate('Claude Code transcript - Index', content)
}

/**
 * Project index template
 */
export interface SessionData {
  name: string
  summary: string
  date: string
  size_kb: number
}

export function projectIndexTemplate(
  projectName: string,
  sessions: SessionData[],
  sessionCount: number
): string {
  let sessionsHtml = ''
  for (const session of sessions) {
    const truncatedSummary =
      session.summary.length > 100 ? session.summary.slice(0, 100) + '...' : session.summary

    sessionsHtml += stripIndent`
      <div class="index-item">
        <a href="${escapeHtml(session.name)}/index.html">
          <div class="index-item-header">
            <span class="index-item-number">${escapeHtml(session.date)}</span>
            <span style="color: var(--text-muted);">${Math.round(session.size_kb)} KB</span>
          </div>
          <div class="index-item-content">
            <p style="margin: 0;">${escapeHtml(truncatedSummary)}</p>
          </div>
        </a>
      </div>
    `
  }

  const sessionWord = sessionCount === 1 ? 'session' : 'sessions'
  const content = stripIndent`
    <h1><a href="../index.html" style="color: inherit; text-decoration: none;">Claude Code Archive</a> / ${escapeHtml(projectName)}</h1>
    <p style="color: var(--text-muted); margin-bottom: 24px;">${sessionCount} ${sessionWord}</p>

    ${sessionsHtml}
    <div style="margin-top: 24px;">
      <a href="../index.html" class="pagination" style="display: inline-block; padding: 8px 16px; background: var(--user-border); color: white; text-decoration: none; border-radius: 6px;">Back to Archive</a>
    </div>
  `

  return baseTemplate(`${projectName} - Claude Code Archive`, content)
}

/**
 * Master index template
 */
export interface ProjectData {
  name: string
  session_count: number
  recent_date: string
}

export function masterIndexTemplate(
  projects: ProjectData[],
  totalProjects: number,
  totalSessions: number
): string {
  let projectsHtml = ''
  for (const project of projects) {
    const sessionWord = project.session_count === 1 ? 'session' : 'sessions'

    projectsHtml += stripIndent`
      <div class="index-item">
        <a href="${escapeHtml(project.name)}/index.html">
          <div class="index-item-header">
            <span class="index-item-number">${escapeHtml(project.name)}</span>
            <time>${escapeHtml(project.recent_date)}</time>
          </div>
          <div class="index-item-content">
            <p style="margin: 0;">${project.session_count} ${sessionWord}</p>
          </div>
        </a>
      </div>
    `
  }

  const content = stripIndent`
    <h1>Claude Code Archive</h1>
    <p style="color: var(--text-muted); margin-bottom: 24px;">${totalProjects} projects · ${totalSessions} sessions</p>

    ${projectsHtml}
  `

  return baseTemplate('Claude Code Archive', content)
}

/**
 * Inject gist preview JS into HTML content
 */
export function injectGistPreviewJs(htmlContent: string): string {
  if (htmlContent.includes('</body>')) {
    return htmlContent.replace('</body>', `<script>${GIST_PREVIEW_JS}</script>\n</body>`)
  }
  return htmlContent
}
