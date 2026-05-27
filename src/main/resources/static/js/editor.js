/* ══════════════════════════════════════════════════════════════════════
   Email Template Editor — editor.js  v2.0
   WYSIWYG Editor with Rich Text, Drag-Drop, FTL Parameters, Preview
   ══════════════════════════════════════════════════════════════════════ */

// ─── State ────────────────────────────────────────────────────────────
let gje = null;                // GrapesJS editor instance
let currentTemplateId = null;
let parameters = [];
let editingParamIndex = -1;
let jsonModeActive = false;
let currentMode = 'design';   // design | html | preview
let isFullscreen = false;
let htmlSourceDirty = false;   // true when user edits HTML source textarea
let draggingParam = null;      // param name currently being dragged from params panel
let hoveredComponent = null;   // last GrapesJS component hovered over in canvas

// Bootstrap modal references
let addParamModal, importJsonModal, importHtmlModal, previewModal, findReplaceModal;

// ─── Init ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    addParamModal   = new bootstrap.Modal(document.getElementById('addParamModal'));
    importJsonModal = new bootstrap.Modal(document.getElementById('importJsonModal'));
    importHtmlModal = new bootstrap.Modal(document.getElementById('importHtmlModal'));
    previewModal    = new bootstrap.Modal(document.getElementById('previewModal'));
    findReplaceModal = new bootstrap.Modal(document.getElementById('findReplaceModal'));

    currentTemplateId = new URLSearchParams(window.location.search).get('id');
    if (currentTemplateId) currentTemplateId = parseInt(currentTemplateId);

    initGrapesJS();

    if (currentTemplateId) {
        await loadTemplate(currentTemplateId);
    } else {
        loadDefaultContent();
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
});

// ─── GrapesJS Initialisation ────────────────────────────────────────
function initGrapesJS() {
    gje = grapesjs.init({
        container: '#gjs',
        fromElement: false,
        height: '100%',
        width: 'auto',
        storageManager: false,

        // External panel containers
        blockManager:  { appendTo: '#blocks-pane',  blocks: getAllBlocks() },
        layerManager:  { appendTo: '#layers-pane' },
        styleManager:  { appendTo: '#styles-pane',  sectors: getStyleSectors() },
        traitManager:  { appendTo: '#traits-pane' },

        // No default GrapesJS panels — we build our own
        panels: { defaults: [] },

        // Device presets
        deviceManager: {
            devices: [
                { name: 'Desktop',    width: '' },
                { name: 'Email 600',  width: '600px',  widthMedia: '600px' },
                { name: 'Mobile',     width: '375px',  widthMedia: '480px' }
            ]
        },

        // Asset manager (image upload)
        assetManager: {
            upload: '/api/upload/image',
            uploadName: 'file',
            multiUpload: false,
            autoAdd: true,
            assets: []
        },

        canvas: {
            styles: ['https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap']
        }
    });

    setupRTE(gje);
    setupPasteHandler(gje);
    setupCanvasDragDrop();

    // Track the component currently under the mouse — used by param drag-drop
    gje.on('component:hover', (comp) => { hoveredComponent = comp || null; });

    // Sync layers / traits on selection
    gje.on('component:selected', () => {
        // Auto-switch right panel to traits when a component is selected
    });
}

// ─── Rich Text Editor Setup ──────────────────────────────────────────
function setupRTE(editor) {
    // Remove default 'wrap' button
    try { editor.RichTextEditor.remove('wrap'); } catch(e) {}

    const rteActions = [
        // Separator helper
        { id: 'sep1', icon: '<span class="rte-sep-el"></span>', result: () => {} },
        // Alignment
        { id: 'justifyLeft',   icon: '<i class="bi bi-text-left"></i>',   title: 'Align Left',   cmd: 'justifyLeft'   },
        { id: 'justifyCenter', icon: '<i class="bi bi-text-center"></i>', title: 'Center',        cmd: 'justifyCenter' },
        { id: 'justifyRight',  icon: '<i class="bi bi-text-right"></i>',  title: 'Align Right',  cmd: 'justifyRight'  },
        { id: 'justifyFull',   icon: '<i class="bi bi-justify"></i>',     title: 'Justify',      cmd: 'justifyFull'   },
        { id: 'sep2', icon: '<span class="rte-sep-el"></span>', result: () => {} },
        // Lists
        { id: 'insertOrderedList',   icon: '<i class="bi bi-list-ol"></i>',             title: 'Numbered List', cmd: 'insertOrderedList' },
        { id: 'insertUnorderedList', icon: '<i class="bi bi-list-ul"></i>',             title: 'Bullet List',   cmd: 'insertUnorderedList' },
        { id: 'outdent',             icon: '<i class="bi bi-text-indent-right"></i>',   title: 'Outdent',       cmd: 'outdent' },
        { id: 'indent',              icon: '<i class="bi bi-text-indent-left"></i>',    title: 'Indent',        cmd: 'indent'  },
        { id: 'sep3', icon: '<span class="rte-sep-el"></span>', result: () => {} },
        // Superscript / Subscript
        { id: 'superscript', icon: '<span style="font-size:10px;font-weight:bold">x²</span>', title: 'Superscript', cmd: 'superscript' },
        { id: 'subscript',   icon: '<span style="font-size:10px">x₂</span>',                title: 'Subscript',   cmd: 'subscript' },
        { id: 'sep4', icon: '<span class="rte-sep-el"></span>', result: () => {} },
        // Remove formatting
        { id: 'removeFormat', icon: '<i class="bi bi-eraser-fill"></i>', title: 'Remove Formatting', cmd: 'removeFormat' },
    ];

    rteActions.forEach(a => {
        const isSep = a.id.startsWith('sep');
        editor.RichTextEditor.add(a.id, {
            icon: a.icon,
            attributes: isSep ? {} : { title: a.title || '' },
            result: isSep ? () => {} : (rte => rte.exec(a.cmd))
        });
    });

    // Text Color (prompt-based)
    editor.RichTextEditor.add('foreColor', {
        icon: '<i class="bi bi-fonts" style="color:#e63946;font-weight:bold"></i>',
        attributes: { title: 'Text Color' },
        result: rte => {
            const c = prompt('Text color (hex or name, e.g. #e63946):', '#000000');
            if (c) document.execCommand('foreColor', false, c);
        }
    });

    // Highlight Color
    editor.RichTextEditor.add('hiliteColor', {
        icon: '<i class="bi bi-highlighter" style="color:#f9a825"></i>',
        attributes: { title: 'Highlight Color' },
        result: rte => {
            const c = prompt('Highlight color (e.g. #ffff00):', '#ffff00');
            if (c) document.execCommand('hiliteColor', false, c);
        }
    });

    // Separator before FTL
    editor.RichTextEditor.add('sep5', { icon: '<span class="rte-sep-el"></span>', result: () => {} });

    // FTL Parameter insertion
    editor.RichTextEditor.add('ftlVariable', {
        icon: '<span style="font-family:monospace;font-size:10px;font-weight:bold;background:#1a3a6a;border-radius:3px;padding:1px 4px;color:#7fb3d3">${}</span>',
        attributes: { title: 'Insert FTL Parameter' },
        result: rte => insertFtlParamInRte(rte)
    });
}

// Insert FTL param in RTE (prompt-based picker)
function insertFtlParamInRte(rte) {
    if (parameters.length === 0) {
        showToast('Add parameters in the Params panel first', 'info');
        return;
    }
    const list = parameters.map((p, i) => `${i + 1}. ${p.name}  — ${p.label || p.type}`).join('\n');
    const choice = prompt(`Choose a parameter to insert:\n\n${list}\n\nEnter number or name:`, '1');
    if (!choice) return;

    let paramName;
    const num = parseInt(choice.trim());
    if (!isNaN(num) && num >= 1 && num <= parameters.length) {
        paramName = parameters[num - 1].name;
    } else {
        const found = parameters.find(p => p.name === choice.trim());
        if (found) paramName = found.name;
    }

    if (paramName) {
        rte.insertHTML(`<span style="background:#fff3cd;border-radius:3px;padding:0 3px;font-family:monospace;font-size:0.9em;color:#856404">\${${paramName}}</span>`);
    } else {
        showToast('Parameter "' + choice.trim() + '" not found', 'error');
    }
}

// ─── Paste Handler (Word/rich content cleanup) ───────────────────────
function setupPasteHandler(editor) {
    editor.on('rte:enable', (view) => {
        const el = view.el;
        if (!el.__pasteHandlerAdded) {
            el.addEventListener('paste', handlePaste);
            el.__pasteHandlerAdded = true;
        }
    });
}

function handlePaste(e) {
    const html = e.clipboardData.getData('text/html');
    if (!html) return; // plain text — let it pass through normally
    e.preventDefault();
    const clean = stripWordMarkup(html);
    document.execCommand('insertHTML', false, clean);
}

function stripWordMarkup(html) {
    return html
        // Remove XML namespace declarations
        .replace(/<\?xml[\s\S]*?\?>/gi, '')
        // Remove MS Office tags
        .replace(/<o:[^>]*>[\s\S]*?<\/o:[^>]*>/gi, '')
        .replace(/<w:[^>]*>[\s\S]*?<\/w:[^>]*>/gi, '')
        .replace(/<m:[^>]*>[\s\S]*?<\/m:[^>]*>/gi, '')
        // Remove HTML comments
        .replace(/<!--[\s\S]*?-->/g, '')
        // Remove MSO/Office styles
        .replace(/\s?mso-[^;}"']+;?/gi, '')
        .replace(/\s?MARGIN: 0cm [^;"'}]+;?/gi, '')
        // Remove Office class attributes
        .replace(/\s?class="Mso[^"]*"/gi, '')
        // Remove font tags (use CSS instead)
        .replace(/<font[^>]*>/gi, '').replace(/<\/font>/gi, '')
        // Remove empty style attrs
        .replace(/\s?style=""/gi, '')
        // Remove span tags with only class (e.g. spell-check)
        .replace(/<span[^>]*class="(Spell|Grammar)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '$2')
        // Clean up
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

// ─── Default Content (new template) ─────────────────────────────────
function loadDefaultContent() {
    gje.setComponents(defaultEmailHtml());
    parameters = defaultParameters();
    renderParametersList();
}

function defaultParameters() {
    return [
        { name: 'customerName', label: 'Customer Name',  type: 'STRING', defaultValue: 'John Doe',    required: true  },
        { name: 'orderId',      label: 'Order ID',        type: 'STRING', defaultValue: 'ORD-1001',    required: true  },
        { name: 'orderTotal',   label: 'Order Total',     type: 'STRING', defaultValue: '$150.00',     required: true  },
        { name: 'orderDate',    label: 'Order Date',      type: 'DATE',   defaultValue: '2024-01-15',  required: false },
        { name: 'ctaUrl',       label: 'CTA Button URL',  type: 'STRING', defaultValue: 'https://example.com/orders', required: false }
    ];
}

function defaultEmailHtml() {
    return `<table width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,Helvetica,sans-serif;background-color:#f4f4f4;">
  <tr><td align="center" style="padding:30px 0;">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <tr><td style="background:#0d6efd;padding:28px;text-align:center;">
        <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">Company Name</h1>
      </td></tr>
      <tr><td style="padding:30px;">
        <p style="font-size:16px;color:#333;margin:0 0 12px;">Hi <strong>\${customerName}</strong>,</p>
        <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 20px;">Thank you for your order! Here are your details:</p>
        <table width="100%" cellpadding="8" cellspacing="0" style="border:1px solid #e0e0e0;border-radius:6px;font-size:14px;color:#333;">
          <tr style="background:#f8f9fa;"><td><strong>Order ID</strong></td><td>\${orderId}</td></tr>
          <tr><td><strong>Total</strong></td><td>\${orderTotal}</td></tr>
          <tr style="background:#f8f9fa;"><td><strong>Date</strong></td><td>\${orderDate}</td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:0 30px 30px;text-align:center;">
        <a href="\${ctaUrl}" style="display:inline-block;background:#0d6efd;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:15px;font-weight:600;">View Order</a>
      </td></tr>
      <tr><td style="background:#f8f9fa;padding:18px;text-align:center;border-top:1px solid #e0e0e0;">
        <p style="margin:0;font-size:12px;color:#aaa;">© 2024 Company · <a href="#" style="color:#aaa;">Unsubscribe</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>`;
}

// ─── Load existing template ──────────────────────────────────────────
async function loadTemplate(id) {
    try {
        const res = await fetch(`/api/templates/${id}`);
        if (!res.ok) throw new Error('Template not found');
        const t = await res.json();
        document.getElementById('template-name').value        = t.name || '';
        document.getElementById('template-description').value = t.description || '';
        document.title = `${t.name} — Editor`;
        if (t.htmlContent) setEditorContent(t.htmlContent);
        parameters = (t.parameters || []).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        renderParametersList();
    } catch (err) {
        showToast('Failed to load template: ' + err.message, 'error');
    }
}

// ─── Content helpers ─────────────────────────────────────────────────
function setEditorContent(html) {
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const body = bodyMatch ? bodyMatch[1].trim() : html;
    const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    const css = styleMatch ? styleMatch[1] : '';
    gje.setComponents(body);
    if (css) gje.setStyle(css);
}

function getFullHtml() {
    const body = gje.getHtml();
    const css  = gje.getCss();
    return `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width,initial-scale=1">\n  <title>\${emailSubject!''}</title>\n  <style>\n${css}\n  </style>\n</head>\n<body>\n${body}\n</body>\n</html>`;
}

// ─── Mode Switching (Design / HTML / Preview) ────────────────────────
function setMode(mode) {
    // If leaving HTML view with unsaved edits, ask the user
    if (currentMode === 'html' && mode !== 'html' && htmlSourceDirty) {
        const apply = confirm('You have unsaved HTML edits. Apply them to the design canvas?');
        if (!apply) return;   // user cancels — stay in HTML mode
        const html = document.getElementById('html-source-area').value.trim();
        if (html) setEditorContent(html);
        htmlSourceDirty = false;
        document.getElementById('html-dirty-badge').classList.add('d-none');
        document.getElementById('apply-html-btn').classList.add('d-none');
    }

    currentMode = mode;
    const gjsWrap   = document.getElementById('gjs-wrapper');
    const htmlView  = document.getElementById('html-mode-view');
    const prevView  = document.getElementById('preview-mode-view');

    gjsWrap.classList.add('d-none');
    htmlView.classList.add('d-none');
    prevView.classList.add('d-none');

    ['mode-design','mode-html','mode-preview'].forEach(id => {
        document.getElementById(id).classList.remove('active');
    });
    document.getElementById('mode-' + mode).classList.add('active');

    if (mode === 'design') {
        gjsWrap.classList.remove('d-none');
    } else if (mode === 'html') {
        htmlView.classList.remove('d-none');
        // Only refresh content when there are no pending edits (preserve user's work)
        if (!htmlSourceDirty) {
            document.getElementById('html-source-area').value = getFullHtml();
        }
    } else if (mode === 'preview') {
        prevView.classList.remove('d-none');
        document.getElementById('canvas-preview-frame').srcdoc = gje.getHtml();
    }
}

// ─── HTML Source Editing ─────────────────────────────────────────────
function onHtmlSourceChange() {
    htmlSourceDirty = true;
    document.getElementById('html-dirty-badge').classList.remove('d-none');
    document.getElementById('apply-html-btn').classList.remove('d-none');
}

function applyHtmlToDesign() {
    const html = document.getElementById('html-source-area').value.trim();
    if (!html) { showToast('HTML source is empty', 'info'); return; }

    setEditorContent(html);
    htmlSourceDirty = false;
    document.getElementById('html-dirty-badge').classList.add('d-none');
    document.getElementById('apply-html-btn').classList.add('d-none');

    // Auto-detect any new ${param} variables introduced in the edited HTML
    const detected = [...html.matchAll(/\$\{([a-zA-Z_][a-zA-Z0-9_.?!]*)\}/g)]
        .map(m => m[1].split('.')[0].replace(/[?!]/g, ''))
        .filter((v, i, a) => a.indexOf(v) === i)
        .filter(name => !parameters.find(p => p.name === name));
    if (detected.length) {
        detected.forEach(name => parameters.push({
            name, label: camelToLabel(name), type: 'STRING', defaultValue: '', required: false
        }));
        renderParametersList();
        showToast(`Applied! ${detected.length} new param(s) auto-detected. Switching to Design.`, 'success');
    } else {
        showToast('HTML applied to design canvas', 'success');
    }

    setMode('design');
}

function setCanvasPreviewWidth(w, btn) {
    document.getElementById('canvas-preview-frame').style.width = w;
    document.querySelectorAll('.source-toolbar .btn-group .btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

// ─── Device Switching ────────────────────────────────────────────────
function switchDevice(btn) {
    const device = btn.dataset.device;
    gje.setDevice(device);
    document.querySelectorAll('.device-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Inject responsive CSS into the canvas iframe for visual simulation
    applyResponsiveCSS(device);

    // Update canvas wrapper class for device frame background
    const cw = document.getElementById('canvas-wrapper');
    cw.classList.remove('device-desktop', 'device-email600', 'device-mobile');
    if (device === 'Mobile')      cw.classList.add('device-mobile');
    else if (device === 'Email 600') cw.classList.add('device-email600');
    else                          cw.classList.add('device-desktop');
}

// ─── GrapesJS Command Proxy ──────────────────────────────────────────
function editorCmd(cmd) { gje.runCommand(cmd); }

// ─── Panel Tab Switching ─────────────────────────────────────────────
function showLeftTab(tab) {
    ['blocks','layers'].forEach(t => {
        document.getElementById(t + '-pane').classList.toggle('d-none', t !== tab);
        document.getElementById('ltab-' + t).classList.toggle('active', t === tab);
    });
    document.getElementById('block-search-wrap').classList.toggle('d-none', tab !== 'blocks');
}

function showRightTab(tab) {
    ['style','traits','params'].forEach(t => {
        const pane = t === 'style' ? 'styles' : (t === 'traits' ? 'traits' : 'params');
        document.getElementById(pane + '-pane').classList.toggle('d-none', t !== tab);
        document.getElementById('rtab-' + t).classList.toggle('active', t === tab);
    });
}

// ─── Block Search ─────────────────────────────────────────────────────
function filterBlocks(query) {
    const q = query.toLowerCase().trim();
    document.querySelectorAll('#blocks-pane .gjs-block').forEach(block => {
        const label = block.querySelector('.gjs-block-label')?.textContent?.toLowerCase() || '';
        const cat   = block.closest('.gjs-block-category')?.querySelector('.gjs-title')?.textContent?.toLowerCase() || '';
        block.style.display = (!q || label.includes(q) || cat.includes(q)) ? '' : 'none';
    });
    // Hide empty categories
    document.querySelectorAll('#blocks-pane .gjs-block-category').forEach(cat => {
        const visible = [...cat.querySelectorAll('.gjs-block')].some(b => b.style.display !== 'none');
        cat.style.display = visible ? '' : 'none';
    });
}

// ─── Clear Canvas ────────────────────────────────────────────────────
function clearCanvas() {
    if (confirm('Clear all content from the canvas?')) {
        gje.setComponents('');
        gje.setStyle('');
    }
}

// ─── Import HTML ─────────────────────────────────────────────────────
function importHtml() {
    document.getElementById('html-import-input').value = '';
    importHtmlModal.show();
}

function loadHtmlIntoEditor() {
    const html = document.getElementById('html-import-input').value.trim();
    if (!html) { showToast('Paste some HTML first', 'info'); return; }
    setEditorContent(html);
    importHtmlModal.hide();

    // Auto-detect ${param} patterns
    const detected = [...html.matchAll(/\$\{([a-zA-Z_][a-zA-Z0-9_.?!]*)\}/g)]
        .map(m => m[1].split('.')[0].replace(/[?!]/g, ''))
        .filter((v, i, a) => a.indexOf(v) === i)
        .filter(name => !parameters.find(p => p.name === name));

    if (detected.length) {
        detected.forEach(name => parameters.push({
            name, label: camelToLabel(name), type: 'STRING', defaultValue: '', required: false
        }));
        renderParametersList();
        showToast(`HTML loaded. Auto-detected ${detected.length} new parameter(s).`, 'success');
    } else {
        showToast('HTML loaded into editor', 'success');
    }
}

// ─── Copy HTML Source ─────────────────────────────────────────────────
function copyHtmlSource() {
    const html = currentMode === 'html'
        ? document.getElementById('html-source-area').value
        : getFullHtml();
    navigator.clipboard.writeText(html)
        .then(() => showToast('HTML copied to clipboard', 'success'))
        .catch(() => showToast('Copy failed — use Ctrl+A + Ctrl+C in the HTML view', 'info'));
}

// ─── Find & Replace ──────────────────────────────────────────────────
function openFindReplace() {
    document.getElementById('find-result').textContent = '';
    findReplaceModal.show();
}

function findInTemplate() {
    const find = document.getElementById('find-text').value;
    const cs   = document.getElementById('find-case-sensitive').checked;
    const html = gje.getHtml();
    if (!find) { document.getElementById('find-result').textContent = 'Enter search text'; return; }
    const flags = cs ? 'g' : 'gi';
    const regex = new RegExp(escapeRegex(find), flags);
    const matches = (html.match(regex) || []).length;
    document.getElementById('find-result').textContent = matches
        ? `Found ${matches} occurrence(s)`
        : 'No matches found';
}

function replaceInTemplate() {
    const find    = document.getElementById('find-text').value;
    const replace = document.getElementById('replace-text').value;
    const cs      = document.getElementById('find-case-sensitive').checked;
    if (!find) { showToast('Enter search text', 'info'); return; }

    const html  = gje.getHtml();
    const css   = gje.getCss();
    const flags = cs ? 'g' : 'gi';
    const regex = new RegExp(escapeRegex(find), flags);
    const count = (html.match(regex) || []).length;
    if (!count) { showToast('No matches found', 'info'); return; }

    const newHtml = html.replace(regex, replace);
    gje.setComponents(newHtml);
    if (css) gje.setStyle(css);
    findReplaceModal.hide();
    showToast(`Replaced ${count} occurrence(s) of "${find}"`, 'success');
}

// ─── Full Screen ─────────────────────────────────────────────────────
function toggleFullscreen() {
    isFullscreen = !isFullscreen;
    document.getElementById('editor-page').classList.toggle('fullscreen', isFullscreen);
    document.getElementById('fs-icon').className = isFullscreen ? 'bi bi-fullscreen-exit' : 'bi bi-fullscreen';
    showToast(isFullscreen ? 'Full screen ON — press F to exit' : 'Full screen OFF', 'info');
}

// ─── Keyboard Shortcuts ──────────────────────────────────────────────
function handleKeyboardShortcuts(e) {
    if (e.ctrlKey || e.metaKey) {
        if (e.key === 's') { e.preventDefault(); saveTemplate(); }
        if (e.key === 'h') { e.preventDefault(); openFindReplace(); }
        if (e.key === 'z') { editorCmd('core:undo'); }
        if (e.key === 'y') { editorCmd('core:redo'); }
    }
    if (e.key === 'F11') { e.preventDefault(); toggleFullscreen(); }
    if (e.key === 'Escape' && isFullscreen) toggleFullscreen();
}

// ─── Save Template ───────────────────────────────────────────────────
async function saveTemplate() {
    const name = document.getElementById('template-name').value.trim();
    if (!name) {
        showToast('Please enter a template name', 'error');
        document.getElementById('template-name').focus();
        return;
    }
    const htmlContent = gje.getHtml();
    const ftlContent  = getFullHtml();
    const payload = {
        name,
        description: document.getElementById('template-description').value.trim(),
        htmlContent,
        ftlContent,
        parameters
    };
    try {
        const method = currentTemplateId ? 'PUT' : 'POST';
        const url    = currentTemplateId ? `/api/templates/${currentTemplateId}` : '/api/templates';
        const res    = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Save failed'); }
        const saved = await res.json();
        if (!currentTemplateId) {
            currentTemplateId = saved.id;
            window.history.replaceState(null, '', `/editor.html?id=${saved.id}`);
        }
        document.title = `${saved.name} — Editor`;
        showToast('Template saved!', 'success');
    } catch (err) {
        showToast('Save failed: ' + err.message, 'error');
    }
}

// ─── Export FTL ──────────────────────────────────────────────────────
async function exportFtl() {
    if (!currentTemplateId) { showToast('Save the template first', 'info'); return; }
    try {
        const res = await fetch(`/api/templates/${currentTemplateId}/export`);
        if (!res.ok) throw new Error('Export failed');
        const blob = await res.blob();
        const name = document.getElementById('template-name').value || 'template';
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url;
        a.download = name.replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase() + '.ftl';
        a.click();
        URL.revokeObjectURL(url);
        showToast('FTL file exported', 'success');
    } catch (err) {
        showToast('Export failed: ' + err.message, 'error');
    }
}

// ─── Parameters Management ────────────────────────────────────────────
function openAddParamModal(index = -1) {
    editingParamIndex = index;
    document.getElementById('param-modal-title').textContent = index === -1 ? 'Add Parameter' : 'Edit Parameter';
    document.getElementById('param-edit-index').value = index;
    if (index >= 0 && parameters[index]) {
        const p = parameters[index];
        document.getElementById('param-name').value        = p.name        || '';
        document.getElementById('param-label').value       = p.label       || '';
        document.getElementById('param-type').value        = p.type        || 'STRING';
        document.getElementById('param-default').value     = p.defaultValue || '';
        document.getElementById('param-description').value = p.description  || '';
        document.getElementById('param-required').checked  = p.required    || false;
        document.getElementById('param-name').disabled     = true;
    } else {
        ['param-name','param-label','param-default','param-description'].forEach(id => document.getElementById(id).value = '');
        document.getElementById('param-type').value = 'STRING';
        document.getElementById('param-required').checked = false;
        document.getElementById('param-name').disabled = false;
    }
    addParamModal.show();
}

function saveParameter() {
    const name = document.getElementById('param-name').value.trim();
    if (!name) { showToast('Variable name is required', 'error'); return; }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
        showToast('Variable name must start with a letter/underscore, no spaces', 'error'); return;
    }
    const param = {
        name,
        label:        document.getElementById('param-label').value.trim()       || camelToLabel(name),
        type:         document.getElementById('param-type').value,
        defaultValue: document.getElementById('param-default').value.trim(),
        description:  document.getElementById('param-description').value.trim(),
        required:     document.getElementById('param-required').checked
    };
    const idx = parseInt(document.getElementById('param-edit-index').value);
    if (idx >= 0) {
        param.id = parameters[idx].id;
        parameters[idx] = param;
    } else {
        if (parameters.find(p => p.name === name)) { showToast(`"${name}" already exists`, 'error'); return; }
        parameters.push(param);
    }
    renderParametersList();
    addParamModal.hide();
    showToast(idx >= 0 ? 'Parameter updated' : `"${name}" added`, 'success');
}

function deleteParameter(index) {
    const p = parameters[index];
    if (!p) return;
    if (!confirm(`Remove parameter "${p.name}"?`)) return;
    parameters.splice(index, 1);
    renderParametersList();
    showToast(`"${p.name}" removed`, 'info');
}

function insertParameter(index) {
    const p = parameters[index];
    if (!p) return;
    const ph = `\${${p.name}}`;
    navigator.clipboard.writeText(ph)
        .then(() => showToast(`Copied ${ph} — paste it inside the editor`, 'success'))
        .catch(() => showToast(`Insert this: ${ph}`, 'info'));
}

function renderParametersList() {
    const list = document.getElementById('params-list');
    if (!parameters.length) {
        list.innerHTML = `<div class="params-empty"><i class="bi bi-braces"></i>No parameters.<br><small>Click + Add to define FTL variables.</small></div>`;
        syncParamsToBlocks();
        return;
    }
    list.innerHTML = parameters.map((p, i) => `
    <div class="param-item" draggable="true"
         ondragstart="onParamDragStart(event,'${p.name}')"
         ondragend="draggingParam=null">
      <div class="param-item-header">
        <span class="param-varname">\${${p.name}}</span>
        <div class="d-flex gap-1">
          <span class="param-type-chip">${p.type || 'STR'}</span>
          ${p.required ? '<span class="param-req-chip">req</span>' : ''}
        </div>
      </div>
      ${p.label ? `<div class="param-lbl">${escapeHtml(p.label)}</div>` : ''}
      ${p.defaultValue ? `<div class="param-lbl" style="color:#555">Default: <code style="color:#7fb3d3">${escapeHtml(p.defaultValue)}</code></div>` : ''}
      <div class="param-drag-hint"><i class="bi bi-grip-horizontal me-1"></i>Drag to canvas or use Insert</div>
      <div class="param-actions">
        <button class="param-insert-btn" onclick="insertParameter(${i})" title="Copy \${${p.name}} to clipboard">
          <i class="bi bi-clipboard"></i> Insert
        </button>
        <button class="param-edit-btn" onclick="openAddParamModal(${i})" title="Edit"><i class="bi bi-pencil"></i></button>
        <button class="param-del-btn"  onclick="deleteParameter(${i})"   title="Remove"><i class="bi bi-trash"></i></button>
      </div>
    </div>`).join('');
    syncParamsToBlocks();
}

// ─── Import / Export JSON Params ─────────────────────────────────────
function openImportJsonModal() {
    document.getElementById('json-import-input').value = '';
    document.getElementById('json-import-error').classList.add('d-none');
    importJsonModal.show();
}

function importParamsFromJson() {
    const raw  = document.getElementById('json-import-input').value.trim();
    const errEl = document.getElementById('json-import-error');
    errEl.classList.add('d-none');
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) throw new Error('Expected a JSON array');
        parameters = parsed.map((p, i) => ({
            name:         p.name || `param${i}`,
            label:        p.label || camelToLabel(p.name || ''),
            type:         p.type || 'STRING',
            defaultValue: p.defaultValue || p.default || '',
            description:  p.description || '',
            required:     !!p.required,
            sortOrder:    p.sortOrder || i
        }));
        renderParametersList();
        importJsonModal.hide();
        showToast(`Imported ${parameters.length} parameter(s)`, 'success');
    } catch (err) {
        errEl.textContent = 'Invalid JSON: ' + err.message;
        errEl.classList.remove('d-none');
    }
}

function exportParamsJson() {
    const json = JSON.stringify(parameters.map(p => ({
        name: p.name, label: p.label, type: p.type,
        defaultValue: p.defaultValue, description: p.description, required: p.required
    })), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = (document.getElementById('template-name').value || 'template').replace(/[^a-zA-Z0-9_\-]/g, '_') + '_params.json';
    a.click();
    URL.revokeObjectURL(url);
}

// ─── Preview (FTL Rendering) ──────────────────────────────────────────
function openPreviewModal() {
    renderPreviewParamsForm();
    document.getElementById('preview-error').classList.add('d-none');
    document.getElementById('preview-iframe').srcdoc = '';
    previewModal.show();
}

function renderPreviewParamsForm() {
    const form = document.getElementById('preview-params-form');
    if (!parameters.length) {
        form.innerHTML = '<p class="text-muted small">No parameters defined.</p>'; return;
    }
    form.innerHTML = parameters.map(p => `
    <div class="mb-2 param-preview-field">
      <label for="prev-${p.name}" class="form-label mb-1">
        ${escapeHtml(p.label || p.name)}
        ${p.required ? '<span class="text-danger ms-1">*</span>' : ''}
        <code class="ms-1" style="font-size:0.7rem;color:#0d6efd">\${${p.name}}</code>
      </label>
      <input type="text" id="prev-${p.name}" class="form-control form-control-sm"
             value="${escapeHtml(p.defaultValue || '')}"
             placeholder="${escapeHtml(p.defaultValue || p.label || p.name)}">
    </div>`).join('');
}

function fillDefaultValues() {
    parameters.forEach(p => {
        const el = document.getElementById(`prev-${p.name}`);
        if (el && p.defaultValue) el.value = p.defaultValue;
    });
}

async function renderPreview() {
    if (!currentTemplateId) { showToast('Save the template first', 'info'); return; }
    let previewParams = {};
    if (jsonModeActive) {
        try { previewParams = JSON.parse(document.getElementById('preview-json-input').value || '{}'); }
        catch (e) { showToast('Invalid JSON', 'error'); return; }
    } else {
        parameters.forEach(p => {
            const el = document.getElementById(`prev-${p.name}`);
            previewParams[p.name] = el ? el.value : (p.defaultValue || '');
        });
    }
    const errEl = document.getElementById('preview-error');
    errEl.classList.add('d-none');
    try {
        const res = await fetch(`/api/templates/${currentTemplateId}/preview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ parameters: previewParams })
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Preview failed'); }
        const html = await res.text();
        document.getElementById('preview-iframe').srcdoc = html;
    } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.remove('d-none');
    }
}

function toggleJsonMode() {
    jsonModeActive = !jsonModeActive;
    const jsonArea = document.getElementById('preview-json-input');
    const formArea = document.getElementById('preview-params-form');
    if (jsonModeActive) {
        const vals = {};
        parameters.forEach(p => {
            const el = document.getElementById(`prev-${p.name}`);
            vals[p.name] = el ? el.value : (p.defaultValue || '');
        });
        jsonArea.value = JSON.stringify(vals, null, 2);
    }
    jsonArea.classList.toggle('d-none', !jsonModeActive);
    formArea.classList.toggle('d-none', jsonModeActive);
}

function setPreviewWidth(w, btn) {
    document.getElementById('preview-iframe').style.width = w;
    document.querySelectorAll('#preview-device-btns button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

// ─── Style Sectors ────────────────────────────────────────────────────
function getStyleSectors() {
    return [
        {
            name: 'Typography', open: true,
            properties: ['font-family','font-size','font-weight','font-style',
                         'color','line-height','letter-spacing','text-align',
                         'text-decoration','text-transform']
        },
        {
            name: 'Spacing', open: false,
            properties: ['margin','margin-top','margin-right','margin-bottom','margin-left',
                         'padding','padding-top','padding-right','padding-bottom','padding-left']
        },
        {
            name: 'Dimension', open: false,
            properties: ['width','height','max-width','min-height']
        },
        {
            name: 'Background', open: false,
            properties: ['background-color','background-image','background-size',
                         'background-position','background-repeat']
        },
        {
            name: 'Border', open: false,
            properties: ['border','border-radius','border-color','border-width','border-style']
        },
        {
            name: 'Display', open: false,
            properties: ['display','vertical-align','float']
        }
    ];
}

// ─── All Blocks ────────────────────────────────────────────────────────
function getAllBlocks() {
    return [
        // ── EMAIL ──
        {
            id: 'email-wrapper',
            label: `<i class="bi bi-envelope" style="font-size:18px;display:block;margin-bottom:3px"></i>Wrapper`,
            category: '📧 Email', content: defaultEmailHtml()
        },
        {
            id: 'email-header',
            label: `<i class="bi bi-badge-hd" style="font-size:18px;display:block;margin-bottom:3px"></i>Header`,
            category: '📧 Email',
            content: `<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:#0d6efd;padding:28px;text-align:center;"><h1 style="margin:0;color:#fff;font-family:Arial,sans-serif;font-size:24px;font-weight:700;">Company Name</h1><p style="margin:6px 0 0;color:#cce5ff;font-size:13px;">Your tagline here</p></td></tr></table>`
        },
        {
            id: 'email-hero',
            label: `<i class="bi bi-image" style="font-size:18px;display:block;margin-bottom:3px"></i>Hero`,
            category: '📧 Email',
            content: `<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:#1a1d23;padding:50px 30px;text-align:center;"><h1 style="margin:0 0 12px;color:#fff;font-family:Arial,sans-serif;font-size:32px;font-weight:700;">Big Headline Here</h1><p style="margin:0 0 24px;color:#aaa;font-family:Arial,sans-serif;font-size:16px;">Supporting text for your hero section</p><a href="\${ctaUrl}" style="display:inline-block;background:#0d6efd;color:#fff;text-decoration:none;padding:14px 32px;border-radius:6px;font-family:Arial,sans-serif;font-size:15px;font-weight:600;">Get Started</a></td></tr></table>`
        },
        {
            id: 'email-text-block',
            label: `<i class="bi bi-paragraph" style="font-size:18px;display:block;margin-bottom:3px"></i>Text`,
            category: '📧 Email',
            content: `<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:20px;font-family:Arial,sans-serif;font-size:14px;color:#333;line-height:1.7;"><p style="margin:0 0 12px;">Hi <strong>\${customerName}</strong>,</p><p style="margin:0;">Your message content goes here. This is a paragraph block you can edit.</p></td></tr></table>`
        },
        {
            id: 'email-img-left',
            label: `<i class="bi bi-layout-text-sidebar" style="font-size:18px;display:block;margin-bottom:3px"></i>Img+Text`,
            category: '📧 Email',
            content: `<table width="100%" cellpadding="0" cellspacing="0"><tr><td width="40%" style="padding:10px;vertical-align:top;"><img src="https://placehold.co/200x150/0d6efd/white?text=Image" style="max-width:100%;height:auto;border-radius:6px;display:block;"></td><td width="60%" style="padding:10px;vertical-align:top;font-family:Arial,sans-serif;font-size:14px;color:#333;line-height:1.7;"><h3 style="margin:0 0 8px;font-size:16px;">Section Title</h3><p style="margin:0;">Description text goes here alongside the image.</p></td></tr></table>`
        },
        {
            id: 'email-cta',
            label: `<i class="bi bi-hand-index" style="font-size:18px;display:block;margin-bottom:3px"></i>CTA Button`,
            category: '📧 Email',
            content: `<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:20px;text-align:center;"><a href="\${ctaUrl}" style="display:inline-block;background:#0d6efd;color:#fff;text-decoration:none;padding:13px 30px;border-radius:6px;font-family:Arial,sans-serif;font-size:15px;font-weight:600;">Click Here</a></td></tr></table>`
        },
        {
            id: 'email-footer',
            label: `<i class="bi bi-file-earmark-post" style="font-size:18px;display:block;margin-bottom:3px"></i>Footer`,
            category: '📧 Email',
            content: `<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:#f8f9fa;padding:20px;text-align:center;border-top:1px solid #e0e0e0;"><p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:12px;color:#666;">© 2024 Company. All rights reserved.</p><p style="margin:0;font-family:Arial,sans-serif;font-size:12px;"><a href="\${unsubscribeUrl}" style="color:#aaa;text-decoration:underline;">Unsubscribe</a> · <a href="#" style="color:#aaa;text-decoration:underline;">Privacy Policy</a></p></td></tr></table>`
        },
        // ── LAYOUT ──
        {
            id: 'layout-1col',
            label: `<i class="bi bi-square" style="font-size:18px;display:block;margin-bottom:3px"></i>1 Column`,
            category: '📐 Layout',
            content: `<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:16px;font-family:Arial,sans-serif;font-size:14px;color:#333;">Content here</td></tr></table>`
        },
        {
            id: 'layout-2col-50',
            label: `<i class="bi bi-layout-split" style="font-size:18px;display:block;margin-bottom:3px"></i>2 Col 50/50`,
            category: '📐 Layout',
            content: `<table width="100%" cellpadding="0" cellspacing="0"><tr><td width="50%" style="padding:12px;vertical-align:top;font-family:Arial,sans-serif;font-size:14px;color:#333;">Left column</td><td width="50%" style="padding:12px;vertical-align:top;font-family:Arial,sans-serif;font-size:14px;color:#333;">Right column</td></tr></table>`
        },
        {
            id: 'layout-2col-33-67',
            label: `<i class="bi bi-layout-sidebar-reverse" style="font-size:18px;display:block;margin-bottom:3px"></i>2 Col 33/67`,
            category: '📐 Layout',
            content: `<table width="100%" cellpadding="0" cellspacing="0"><tr><td width="33%" style="padding:12px;vertical-align:top;font-family:Arial,sans-serif;font-size:14px;color:#333;">Sidebar</td><td width="67%" style="padding:12px;vertical-align:top;font-family:Arial,sans-serif;font-size:14px;color:#333;">Main content</td></tr></table>`
        },
        {
            id: 'layout-3col',
            label: `<i class="bi bi-layout-three-columns" style="font-size:18px;display:block;margin-bottom:3px"></i>3 Columns`,
            category: '📐 Layout',
            content: `<table width="100%" cellpadding="0" cellspacing="0"><tr><td width="33%" style="padding:10px;vertical-align:top;font-family:Arial,sans-serif;font-size:13px;color:#333;text-align:center;">Column 1</td><td width="34%" style="padding:10px;vertical-align:top;font-family:Arial,sans-serif;font-size:13px;color:#333;text-align:center;">Column 2</td><td width="33%" style="padding:10px;vertical-align:top;font-family:Arial,sans-serif;font-size:13px;color:#333;text-align:center;">Column 3</td></tr></table>`
        },
        // ── CONTENT ──
        {
            id: 'content-h1',
            label: `<span style="font-weight:700;font-size:16px;display:block;margin-bottom:3px">H1</span>Heading 1`,
            category: '📝 Content',
            content: `<h1 style="font-family:Arial,sans-serif;font-size:28px;color:#212529;margin:0 0 12px;font-weight:700;">Main Heading</h1>`
        },
        {
            id: 'content-h2',
            label: `<span style="font-weight:700;font-size:14px;display:block;margin-bottom:3px">H2</span>Heading 2`,
            category: '📝 Content',
            content: `<h2 style="font-family:Arial,sans-serif;font-size:22px;color:#212529;margin:0 0 10px;font-weight:600;">Section Heading</h2>`
        },
        {
            id: 'content-para',
            label: `<i class="bi bi-text-paragraph" style="font-size:18px;display:block;margin-bottom:3px"></i>Paragraph`,
            category: '📝 Content',
            content: `<p style="font-family:Arial,sans-serif;font-size:14px;color:#555;line-height:1.7;margin:0 0 12px;">Your paragraph text goes here. Double-click to edit with the rich text toolbar.</p>`
        },
        {
            id: 'content-image',
            label: `<i class="bi bi-card-image" style="font-size:18px;display:block;margin-bottom:3px"></i>Image`,
            category: '📝 Content',
            content: `<img src="https://placehold.co/600x300/0d6efd/white?text=Image" alt="Image" style="max-width:100%;height:auto;display:block;border-radius:4px;">`
        },
        {
            id: 'content-button',
            label: `<i class="bi bi-toggles" style="font-size:18px;display:block;margin-bottom:3px"></i>Button`,
            category: '📝 Content',
            content: `<a href="#" style="display:inline-block;background:#0d6efd;color:#fff;text-decoration:none;padding:10px 22px;border-radius:5px;font-family:Arial,sans-serif;font-size:14px;font-weight:600;">Button</a>`
        },
        {
            id: 'content-divider',
            label: `<i class="bi bi-dash-lg" style="font-size:18px;display:block;margin-bottom:3px"></i>Divider`,
            category: '📝 Content',
            content: `<hr style="border:none;border-top:1px solid #e0e0e0;margin:20px 0;">`
        },
        {
            id: 'content-spacer',
            label: `<i class="bi bi-distribute-vertical" style="font-size:18px;display:block;margin-bottom:3px"></i>Spacer`,
            category: '📝 Content',
            content: `<div style="height:24px;line-height:24px;font-size:1px;">&nbsp;</div>`
        },
        {
            id: 'content-quote',
            label: `<i class="bi bi-chat-quote" style="font-size:18px;display:block;margin-bottom:3px"></i>Quote`,
            category: '📝 Content',
            content: `<blockquote style="border-left:4px solid #0d6efd;margin:0 0 16px;padding:12px 16px;background:#f0f6ff;border-radius:0 6px 6px 0;"><p style="margin:0;font-family:Arial,sans-serif;font-size:14px;color:#333;font-style:italic;line-height:1.6;">"Your quote text goes here."</p><footer style="margin-top:8px;font-size:12px;color:#888;">— Author Name</footer></blockquote>`
        },
        {
            id: 'content-alert',
            label: `<i class="bi bi-exclamation-triangle" style="font-size:18px;display:block;margin-bottom:3px"></i>Alert`,
            category: '📝 Content',
            content: `<div style="background:#fff3cd;border:1px solid #ffc107;border-radius:6px;padding:12px 16px;font-family:Arial,sans-serif;font-size:14px;color:#856404;margin-bottom:12px;">⚠️ This is an important notice for the recipient.</div>`
        },
        {
            id: 'content-video',
            label: `<i class="bi bi-play-btn" style="font-size:18px;display:block;margin-bottom:3px"></i>Video`,
            category: '📝 Content',
            content: `<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:10px;text-align:center;"><a href="\${videoUrl}" style="display:block;position:relative;"><img src="https://placehold.co/560x315/1a1a2e/white?text=▶+Watch+Video" alt="Watch Video" style="max-width:100%;height:auto;border-radius:6px;display:block;"><span style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.7);color:#fff;border-radius:50%;width:50px;height:50px;display:flex;align-items:center;justify-content:center;font-size:20px;">▶</span></a></td></tr></table>`
        },
        {
            id: 'content-table',
            label: `<i class="bi bi-table" style="font-size:18px;display:block;margin-bottom:3px"></i>Table`,
            category: '📝 Content',
            content: `<table width="100%" cellpadding="8" cellspacing="0" style="font-family:Arial,sans-serif;font-size:14px;color:#333;border-collapse:collapse;"><tr style="background:#f8f9fa;font-weight:bold;"><td style="border:1px solid #dee2e6;padding:10px;">Column 1</td><td style="border:1px solid #dee2e6;padding:10px;">Column 2</td><td style="border:1px solid #dee2e6;padding:10px;">Column 3</td></tr><tr><td style="border:1px solid #dee2e6;padding:10px;">Data A</td><td style="border:1px solid #dee2e6;padding:10px;">Data B</td><td style="border:1px solid #dee2e6;padding:10px;">Data C</td></tr><tr style="background:#f8f9fa;"><td style="border:1px solid #dee2e6;padding:10px;">Data D</td><td style="border:1px solid #dee2e6;padding:10px;">Data E</td><td style="border:1px solid #dee2e6;padding:10px;">Data F</td></tr></table>`
        },
        // ── DATA ──
        {
            id: 'data-order',
            label: `<i class="bi bi-receipt" style="font-size:18px;display:block;margin-bottom:3px"></i>Order Summary`,
            category: '📊 Data',
            content: `<table width="100%" cellpadding="8" cellspacing="0" style="font-family:Arial,sans-serif;font-size:14px;color:#333;border:1px solid #e0e0e0;border-radius:6px;"><tr style="background:#f8f9fa;"><td><strong>Order ID</strong></td><td>\${orderId}</td></tr><tr><td><strong>Total</strong></td><td>\${orderTotal}</td></tr><tr style="background:#f8f9fa;"><td><strong>Date</strong></td><td>\${orderDate}</td></tr><tr><td><strong>Status</strong></td><td>\${orderStatus}</td></tr></table>`
        },
        {
            id: 'data-product',
            label: `<i class="bi bi-box-seam" style="font-size:18px;display:block;margin-bottom:3px"></i>Product Card`,
            category: '📊 Data',
            content: `<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;"><tr><td style="padding:0;"><img src="https://placehold.co/300x180/e9ecef/888?text=Product+Image" style="width:100%;height:auto;display:block;"></td></tr><tr><td style="padding:16px;font-family:Arial,sans-serif;"><h3 style="margin:0 0 6px;font-size:16px;color:#212529;">\${productName}</h3><p style="margin:0 0 10px;font-size:13px;color:#666;">\${productDescription}</p><span style="font-size:18px;font-weight:700;color:#0d6efd;">\${productPrice}</span></td></tr></table>`
        },
        {
            id: 'data-key-value',
            label: `<i class="bi bi-card-list" style="font-size:18px;display:block;margin-bottom:3px"></i>Key-Value`,
            category: '📊 Data',
            content: `<table width="100%" cellpadding="8" cellspacing="0" style="font-family:Arial,sans-serif;font-size:14px;"><tr><td style="color:#888;width:40%;padding:6px 0;border-bottom:1px solid #f0f0f0;">Customer:</td><td style="color:#333;font-weight:600;padding:6px 0;border-bottom:1px solid #f0f0f0;">\${customerName}</td></tr><tr><td style="color:#888;padding:6px 0;border-bottom:1px solid #f0f0f0;">Email:</td><td style="color:#333;padding:6px 0;border-bottom:1px solid #f0f0f0;">\${customerEmail}</td></tr><tr><td style="color:#888;padding:6px 0;">Amount:</td><td style="color:#0d6efd;font-weight:700;padding:6px 0;">\${orderTotal}</td></tr></table>`
        },
        {
            id: 'data-pricing',
            label: `<i class="bi bi-tags" style="font-size:18px;display:block;margin-bottom:3px"></i>Pricing Row`,
            category: '📊 Data',
            content: `<table width="100%" cellpadding="8" cellspacing="0" style="font-family:Arial,sans-serif;"><tr><td style="font-size:14px;color:#333;">\${itemName}</td><td style="font-size:13px;color:#888;text-align:center;">\${itemQty} × \${itemUnitPrice}</td><td style="font-size:14px;font-weight:600;color:#0d6efd;text-align:right;">\${itemTotal}</td></tr></table>`
        },
        // ── SOCIAL ──
        {
            id: 'social-icons',
            label: `<i class="bi bi-share" style="font-size:18px;display:block;margin-bottom:3px"></i>Social Icons`,
            category: '🌐 Social',
            content: `<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:16px;text-align:center;"><a href="\${twitterUrl}"  style="display:inline-block;margin:0 5px;"><img src="https://placehold.co/32x32/1da1f2/white?text=TW" style="border-radius:50%;width:32px;height:32px;" alt="Twitter"></a><a href="\${facebookUrl}" style="display:inline-block;margin:0 5px;"><img src="https://placehold.co/32x32/1877f2/white?text=FB" style="border-radius:50%;width:32px;height:32px;" alt="Facebook"></a><a href="\${linkedinUrl}" style="display:inline-block;margin:0 5px;"><img src="https://placehold.co/32x32/0a66c2/white?text=IN" style="border-radius:50%;width:32px;height:32px;" alt="LinkedIn"></a></td></tr></table>`
        },
        // ── FTL ──
        {
            id: 'ftl-variable',
            label: `<span style="font-family:monospace;font-size:12px;display:block;margin-bottom:3px">\${}</span>Variable`,
            category: '🔀 FTL',
            content: `<span style="background:#fff3cd;border-radius:3px;padding:1px 4px;font-family:monospace;font-size:0.9em;color:#856404">\${paramName}</span>`
        },
        {
            id: 'ftl-if',
            label: `<span style="font-family:monospace;font-size:11px;display:block;margin-bottom:3px">&lt;#if&gt;</span>If/Else`,
            category: '🔀 FTL',
            content: `<#if condition??>\n  <p style="font-family:Arial,sans-serif;font-size:14px;color:#333;">Content when condition is true</p>\n<#else>\n  <p style="font-family:Arial,sans-serif;font-size:14px;color:#999;">Fallback content</p>\n</#if>`
        },
        {
            id: 'ftl-list',
            label: `<span style="font-family:monospace;font-size:11px;display:block;margin-bottom:3px">&lt;#list&gt;</span>For Each`,
            category: '🔀 FTL',
            content: `<#list items as item>\n<table width="100%" cellpadding="8" cellspacing="0" style="border-bottom:1px solid #eee;font-family:Arial,sans-serif;font-size:14px;"><tr><td>\${item.name}</td><td>\${item.value}</td></tr></table>\n</#list>`
        },
        {
            id: 'ftl-comment',
            label: `<span style="font-family:monospace;font-size:11px;display:block;margin-bottom:3px">&lt;#--&gt;</span>Comment`,
            category: '🔀 FTL',
            content: `<#-- FTL Comment: this will not appear in output -->`
        }
    ];
}

// ─── Param → Blocks Sync ─────────────────────────────────────────────
// Keeps a "🔧 Parameters" category in the Blocks panel in sync with the
// current parameters array so users can drag params from the Blocks panel too.
function syncParamsToBlocks() {
    if (!gje) return;
    const bm = gje.BlockManager;
    // Collect stale param block IDs then remove them
    const toRemove = [];
    bm.getAll().each(b => { if (b.id && b.id.startsWith('param-block-')) toRemove.push(b.id); });
    toRemove.forEach(id => bm.remove(id));
    // Re-add fresh blocks for each current parameter
    parameters.forEach(p => {
        bm.add(`param-block-${p.name}`, {
            label: `<span style="font-family:monospace;font-size:10px;display:block;margin-bottom:3px">\${${p.name}}</span>${escapeHtml(p.label || p.name)}`,
            category: '🔧 Parameters',
            content: `<span data-ftl-var="1" style="background:#fff3cd;border-radius:3px;padding:0 3px;font-family:monospace;font-size:0.9em;color:#856404">\${${p.name}}</span>`,
            attributes: { title: `Insert \${${p.name}} variable` }
        });
    });
}

// ─── Parameter Drag-Drop into Canvas ─────────────────────────────────
function onParamDragStart(e, paramName) {
    draggingParam = paramName;
    e.dataTransfer.setData('text/plain', paramName);
    e.dataTransfer.effectAllowed = 'copy';
}

// Attach dragover/drop to the GrapesJS canvas iframe document.
// Called once GrapesJS finishes loading; retried via timeout as fallback.
function setupCanvasDragDrop() {
    const attach = () => {
        try {
            const canvasDoc = gje.Canvas.getDocument();
            if (!canvasDoc || canvasDoc.__ftlDropReady) return;
            canvasDoc.__ftlDropReady = true;

            canvasDoc.addEventListener('dragover', (e) => {
                if (draggingParam) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'copy';
                }
            });

            canvasDoc.addEventListener('drop', (e) => {
                if (!draggingParam) return;
                e.preventDefault();
                const pName = draggingParam;
                draggingParam = null;
                insertParamAtCanvasPoint(e.clientX, e.clientY, pName);
            });

            // Clear drag state if user releases outside the iframe
            canvasDoc.addEventListener('dragend', () => { draggingParam = null; });
        } catch (err) {
            console.warn('[FTL] Canvas drop setup deferred:', err.message);
        }
    };
    gje.on('load',               attach);
    gje.on('canvas:frame:load',  attach);
    setTimeout(attach, 800);   // belt-and-suspenders for fast GrapesJS loads
}

// Insert an FTL variable span into whichever canvas component is under the cursor.
function insertParamAtCanvasPoint(cx, cy, paramName) {
    const varHtml = `<span data-ftl-var="1" style="background:#fff3cd;border-radius:3px;padding:0 3px;`
        + `font-family:monospace;font-size:0.9em;color:#856404">\${${paramName}}</span>`;

    // hoveredComponent is tracked via gje.on('component:hover') and will almost
    // always be populated when the user drops over the canvas.
    let comp = hoveredComponent;

    if (comp) {
        try {
            comp.append(varHtml);
            showToast(`\${${paramName}} inserted into element`, 'success');
            return;
        } catch (e) {
            // Component might not accept children — try its parent
            const parent = comp.parent && comp.parent();
            if (parent) {
                try {
                    parent.append(varHtml);
                    showToast(`\${${paramName}} inserted`, 'success');
                    return;
                } catch (e2) { /* fall through */ }
            }
        }
    }

    // Last-resort: append to the canvas root wrapper
    try {
        gje.addComponents(varHtml);
        showToast(`\${${paramName}} added to canvas`, 'success');
    } catch (err) {
        showToast(`Could not insert — hover over a content element first`, 'info');
    }
}

// ─── Responsive CSS Injection ─────────────────────────────────────────
// Injects (or removes) a <style> tag directly in the GrapesJS canvas iframe
// to simulate how the email looks on each device. These styles are NOT saved
// to the template HTML — they're view-only previews.
function applyResponsiveCSS(deviceName) {
    try {
        const canvasDoc = gje.Canvas.getDocument();
        if (!canvasDoc) return;

        // Remove any previously injected responsive override
        const prev = canvasDoc.getElementById('__ftl-responsive__');
        if (prev) prev.remove();

        let css = '';

        if (deviceName === 'Mobile') {
            css = `
                /* ── Mobile simulation ── */
                table, tr, td { display:block !important; width:100% !important;
                    box-sizing:border-box !important; }
                img { max-width:100% !important; height:auto !important; display:block !important; }
                h1 { font-size:22px !important; }
                h2 { font-size:18px !important; }
                p, td, li, span { font-size:14px !important; line-height:1.6 !important; }
                a[style*="display:inline-block"] {
                    display:block !important;
                    width:calc(100% - 32px) !important;
                    box-sizing:border-box !important;
                    text-align:center !important;
                }
                [style*="width:600"] { width:100% !important; }
            `;
        } else if (deviceName === 'Email 600') {
            css = `
                /* ── Email-client simulation ── */
                body { background:#e0dcd6 !important; }
                img { max-width:100% !important; height:auto !important; }
            `;
        }
        // Desktop: no overrides — pure canvas, injected styles already removed above

        if (css) {
            const style = canvasDoc.createElement('style');
            style.id = '__ftl-responsive__';
            style.textContent = css;
            (canvasDoc.head || canvasDoc.documentElement).appendChild(style);
        }
    } catch (err) {
        // Canvas not ready (e.g., during init) — silently ignore
    }
}

// ─── Utility ──────────────────────────────────────────────────────────
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function camelToLabel(str) {
    if (!str) return '';
    return str.replace(/([A-Z])/g,' $1').replace(/^./,s => s.toUpperCase()).trim();
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('main-toast');
    const body  = document.getElementById('toast-body');
    const title = document.getElementById('toast-title');
    const icon  = document.getElementById('toast-icon');
    const cfg = {
        success: { title:'Success', icon:'bi-check-circle-fill', cls:'text-success' },
        error:   { title:'Error',   icon:'bi-exclamation-triangle-fill', cls:'text-danger'  },
        info:    { title:'Info',    icon:'bi-info-circle-fill', cls:'text-primary' }
    }[type] || { title:'Info', icon:'bi-info-circle-fill', cls:'text-primary' };
    title.textContent = cfg.title;
    body.textContent  = message;
    icon.className    = `bi ${cfg.icon} me-2 ${cfg.cls}`;
    bootstrap.Toast.getOrCreateInstance(toast, { delay: 3000 }).show();
}
