export const JS = `
document.querySelectorAll('time[data-timestamp]').forEach(function(el) {
    const timestamp = el.getAttribute('data-timestamp');
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    if (isToday) { el.textContent = timeStr; }
    else { el.textContent = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + timeStr; }
});
document.querySelectorAll('pre.json').forEach(function(el) {
    let text = el.textContent;
    text = text.replace(/"([^"]+)":/g, '<span style="color: #ce93d8">"$1"</span>:');
    text = text.replace(/: "([^"]*)"/g, ': <span style="color: #81d4fa">"$1"</span>');
    text = text.replace(/: (\\d+)/g, ': <span style="color: #ffcc80">$1</span>');
    text = text.replace(/: (true|false|null)/g, ': <span style="color: #f48fb1">$1</span>');
    el.innerHTML = text;
});
document.querySelectorAll('.truncatable').forEach(function(wrapper) {
    const content = wrapper.querySelector('.truncatable-content');
    const btn = wrapper.querySelector('.expand-btn');
    if (content.scrollHeight > 250) {
        wrapper.classList.add('truncated');
        btn.addEventListener('click', function() {
            if (wrapper.classList.contains('truncated')) { wrapper.classList.remove('truncated'); wrapper.classList.add('expanded'); btn.textContent = 'Show less'; }
            else { wrapper.classList.remove('expanded'); wrapper.classList.add('truncated'); btn.textContent = 'Show more'; }
        });
    }
});
function copyRich(html, text) {
    if (navigator.clipboard && window.isSecureContext && window.ClipboardItem) {
        return navigator.clipboard.write([new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([text], { type: 'text/plain' })
        })]);
    }
    return new Promise(function(resolve, reject) {
        function onCopy(e) {
            e.clipboardData.setData('text/html', html);
            e.clipboardData.setData('text/plain', text);
            e.preventDefault();
        }
        document.addEventListener('copy', onCopy);
        const ok = document.execCommand('copy');
        document.removeEventListener('copy', onCopy);
        if (ok) { resolve(); } else { reject(); }
    });
}
document.querySelectorAll('.copy-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const root = btn.closest(btn.getAttribute('data-copy-root'));
        const target = root && root.querySelector(btn.getAttribute('data-copy-target'));
        if (!target) return;
        const clone = target.cloneNode(true);
        clone.querySelectorAll('.copy-btn, .expand-btn').forEach(function(el) { el.remove(); });
        copyRich(clone.innerHTML, target.innerText.trim()).then(function() {
            btn.classList.add('copied');
            setTimeout(function() { btn.classList.remove('copied'); }, 1500);
        });
    });
});
`
