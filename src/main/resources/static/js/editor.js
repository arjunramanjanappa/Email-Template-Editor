/* editor.js — WYSIWYG Email Template Editor logic */

// ─── State ────────────────────────────────────────────────────────────────
let grapesjsEditor = null;
let currentTemplateId = null;
let parameters = [];          // Array of ParameterDTO objects
let editingParamIndex = -1;   // -1 = adding new, >=0 = editing existing
let jsonModeActive = false;

// Bootstrap modal instances
let addParamModal, importJsonModal, importHtmlModal, previewModal;

// ─── Init ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    // Bootstrap modals
    addParamModal    = new bootstrap.Modal(document.getElementById('addParamModal'));
    importJsonModal  = new bootstrap.Modal(document.getElementById('importJsonModal'));
    importHtmlModal  = new bootstrap.Modal(document.getElementById('importHtmlModal'));
    previewModal     = new bootstrap.Modal(document.getElementById('previewModal'));

    // Read template id from query string
    const params = new URLSearchParams(window.location.search);
    currentTemplateId = params.get('id') ? parseInt(params.get('id')) : null;

    initGrapesJS();

    if (currentTemplateId) {
        await loadTemplate(currentTemplateId);
    } else {
        // New template — start with a default blank email structure
        loadDefaultContent();
    }
});

// ─── GrapesJS Initialisation ──────────────────────────────────────────────
function initGrapesJS() {
    grapesjsEditor = grapesjs.init({
        container: '#gjs',
        fromElement: false,
        height: '100%',
        width: 'auto',
        storageManager: false,   // We handle save/load manually
        assetManager: { assets: [] },

        // Email-optimised block definitions
        blockManager: {
            blocks: emailBlocks()
        },

        // Style sectors relevant to email
        styleManager: {
            sectors: [
                {
                    name: 'Typography',
                    open: true,
                    properties: ['font-family', 'font-size', 'font-weight', 'color', 'line-height', 'text-align', 'text-decoration']
                },
                {
                    name: 'Spacing',
                    open: false,
                    properties: ['margin', 'padding']
                },
                {
                    name: 'Dimension',
                    open: false,
                    properties: ['width', 'max-width', 'height']
                },
                {
                    name: 'Background',
                    open: false,
                    properties: ['background-color', 'background']
                },
                {
                    name: 'Border',
                    open: false,
                    properties: ['border-radius', 'border']
                }
            ]
        },

        // Device presets
        deviceManager: {
            devices: [
                { name: 'Desktop', width: '' },
                { name: 'Email (600px)', width: '600px', widthMedia: '600px' },
                { name: 'Mobile', width: '375px', widthMedia: '480px' }
            ]
        },

        canvas: {
            styles: [
                'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap'
            ]
        }
    });

    // ── Custom RTE button: Insert Parameter ─────────────────────────────
    grapesjsEditor.RichTextEditor.add('ftl-variable', {
        icon: '<span title="Insert FTL Parameter" style="font-family:monospace;font-size:11px;font-weight:bold;padding:0 2px">${…}</span>',
        attributes: { title: 'Insert FTL Parameter' },
        result: (rte) => {
            // Store rte reference so param picker can use it
            window._activeRte = rte;
            openParamPickerInline(rte);
        }
    });
}

// ── FTL Parameter picker (inline prompt, avoids modal focus clash) ─────
function openParamPickerInline(rte) {
    if (parameters.length === 0) {
        showToast('No parameters defined yet. Add parameters in the right panel first.', 'info');
        return;
    }
    const paramNames = parameters.map(p => `${p.name} (${p.label || p.type})`).join('\n');
    const choice = prompt(
        `Select a parameter to insert:\n\n${parameters.map((p, i) => `${i + 1}. ${p.name} — ${p.label || p.description || p.type}`).join('\n')}\n\nEnter the number or variable name:`,
        '1'
    );
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
        rte.insertHTML(`<span style="background:#fff3cd;border-radius:3px;padding:0 3px;font-family:monospace;font-size:0.9em">\${${paramName}}</span>`);
    } else {
        showToast('Parameter not found: ' + choice.trim(), 'error');
    }
}

// ─── Default Content (new template) ──────────────────────────────────────
function loadDefaultContent() {
    grapesjsEditor.setComponents(`
<table width="100%" cellpadding="0" cellspacing="0"
       style="font-family:Arial,Helvetica,sans-serif;background-color:#f4f4f4;">
  <tr>
    <td align="center" style="padding:30px 0;">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background-color:#0d6efd;padding:30px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;">Your Company</h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="font-size:16px;color:#333;margin:0 0 12px;">Hi <strong>\${customerName}</strong>,</p>
            <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 20px;">
              Thank you for your order! Here are your details:
            </p>
            <table width="100%" cellpadding="8" cellspacing="0"
                   style="border:1px solid #e0e0e0;border-radius:6px;font-size:14px;color:#333;">
              <tr style="background:#f8f9fa;">
                <td><strong>Order ID</strong></td>
                <td>\${orderId}</td>
              </tr>
              <tr>
                <td><strong>Order Total</strong></td>
                <td>\${orderTotal}</td>
              </tr>
              <tr style="background:#f8f9fa;">
                <td><strong>Order Date</strong></td>
                <td>\${orderDate}</td>
              </tr>
            </table>
            <p style="font-size:14px;color:#555;margin:24px 0 0;">
              If you have any questions, reply to this email or contact our support team.
            </p>
          </td>
        </tr>
        <!-- CTA -->
        <tr>
          <td style="padding:0 32px 32px;text-align:center;">
            <a href="\${ctaUrl}" style="display:inline-block;background:#0d6efd;color:#fff;
               text-decoration:none;padding:12px 28px;border-radius:6px;font-size:15px;font-weight:600;">
              View Order
            </a>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8f9fa;padding:20px;text-align:center;border-top:1px solid #e0e0e0;">
            <p style="margin:0;font-size:12px;color:#aaa;">
              © 2024 Your Company · <a href="#" style="color:#aaa;">Unsubscribe</a>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`);

    // Pre-populate matching parameters
    parameters = [
        { name: 'customerName', label: 'Customer Name',  type: 'STRING', defaultValue: 'John Doe',    required: true  },
        { name: 'orderId',      label: 'Order ID',        type: 'STRING', defaultValue: 'ORD-1001',    required: true  },
        { name: 'orderTotal',   label: 'Order Total',     type: 'STRING', defaultValue: '$150.00',     required: true  },
        { name: 'orderDate',    label: 'Order Date',      type: 'DATE',   defaultValue: '2024-01-15',  required: false },
        { name: 'ctaUrl',       label: 'CTA Button URL',  type: 'STRING', defaultValue: 'https://example.com/orders', required: false }
    ];
    renderParametersList();
}

// ─── Load existing template ───────────────────────────────────────────────
async function loadTemplate(id) {
    try {
        const res = await fetch(`/api/templates/${id}`);
        if (!res.ok) throw new Error('Template not found');
        const template = await res.json();

        document.getElementById('template-name').value        = template.name || '';
        document.getElementById('template-description').value = template.description || '';

        const html = template.htmlContent || template.ftlContent || '';
        if (html) {
            setEditorContent(html);
        }

        parameters = (template.parameters || []).sort((a, b) => a.sortOrder - b.sortOrder);
        renderParametersList();

        document.title = `${template.name} — Template Editor`;
    } catch (err) {
        showToast('Failed to load template: ' + err.message, 'error');
    }
}

// ─── Set editor content (handles full HTML or fragment) ───────────────────
function setEditorContent(html) {
    // Extract <body> content if full HTML document
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1].trim() : html;

    // Extract <style> from <head> if present
    const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    const css = styleMatch ? styleMatch[1] : '';

    grapesjsEditor.setComponents(bodyContent);
    if (css) grapesjsEditor.setStyle(css);
}

// ─── Get full FTL content from editor ────────────────────────────────────
function getEditorFtlContent() {
    const bodyHtml = grapesjsEditor.getHtml();
    const css      = grapesjsEditor.getCss();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>\${emailSubject!''}</title>
  <style>
${css}
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

// ─── Save Template ────────────────────────────────────────────────────────
async function saveTemplate() {
    const name = document.getElementById('template-name').value.trim();
    if (!name) {
        showToast('Please enter a template name', 'error');
        document.getElementById('template-name').focus();
        return;
    }

    const htmlContent = grapesjsEditor.getHtml();
    const ftlContent  = getEditorFtlContent();

    const payload = {
        name,
        description: document.getElementById('template-description').value.trim(),
        htmlContent,
        ftlContent,
        parameters
    };

    try {
        let res;
        if (currentTemplateId) {
            res = await fetch(`/api/templates/${currentTemplateId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } else {
            res = await fetch('/api/templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Save failed');
        }

        const saved = await res.json();
        if (!currentTemplateId) {
            currentTemplateId = saved.id;
            window.history.replaceState(null, '', `/editor.html?id=${saved.id}`);
        }
        document.title = `${saved.name} — Template Editor`;
        showToast('Template saved successfully!', 'success');
    } catch (err) {
        showToast('Save failed: ' + err.message, 'error');
    }
}

// ─── Export FTL ───────────────────────────────────────────────────────────
async function exportFtl() {
    if (!currentTemplateId) {
        showToast('Save the template first before exporting', 'info');
        return;
    }
    try {
        const res = await fetch(`/api/templates/${currentTemplateId}/export`);
        if (!res.ok) throw new Error('Export failed');
        const blob = await res.blob();
        const name = document.getElementById('template-name').value || 'template';
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = name.replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase() + '.ftl';
        a.click();
        URL.revokeObjectURL(url);
        showToast('FTL file downloaded', 'success');
    } catch (err) {
        showToast('Export failed: ' + err.message, 'error');
    }
}

// ─── Import HTML ──────────────────────────────────────────────────────────
function importHtml() {
    document.getElementById('html-import-input').value = '';
    importHtmlModal.show();
}

function loadHtmlIntoEditor() {
    const html = document.getElementById('html-import-input').value.trim();
    if (!html) {
        showToast('Please paste some HTML first', 'info');
        return;
    }
    setEditorContent(html);
    importHtmlModal.hide();

    // Auto-detect FTL parameters from ${...} patterns
    const found = [...html.matchAll(/\$\{([a-zA-Z_][a-zA-Z0-9_.?!]*)\}/g)]
        .map(m => m[1].split('.')[0])   // strip property chains
        .filter((v, i, a) => a.indexOf(v) === i)  // unique
        .filter(name => !parameters.find(p => p.name === name));

    if (found.length > 0) {
        found.forEach(name => {
            parameters.push({
                name,
                label: camelToLabel(name),
                type: 'STRING',
                defaultValue: '',
                required: false
            });
        });
        renderParametersList();
        showToast(`HTML loaded. Auto-detected ${found.length} new parameter(s): ${found.join(', ')}`, 'success');
    } else {
        showToast('HTML loaded into editor', 'success');
    }
}

// ─── Parameters Management ────────────────────────────────────────────────

function openAddParamModal(index = -1) {
    editingParamIndex = index;
    document.getElementById('param-modal-title').textContent = index === -1 ? 'Add Parameter' : 'Edit Parameter';
    document.getElementById('param-edit-index').value = index;

    if (index >= 0 && parameters[index]) {
        const p = parameters[index];
        document.getElementById('param-name').value        = p.name || '';
        document.getElementById('param-label').value       = p.label || '';
        document.getElementById('param-type').value        = p.type || 'STRING';
        document.getElementById('param-default').value     = p.defaultValue || '';
        document.getElementById('param-description').value = p.description || '';
        document.getElementById('param-required').checked  = p.required || false;
        document.getElementById('param-name').disabled     = true; // Don't allow renaming (would break template refs)
    } else {
        document.getElementById('param-name').value        = '';
        document.getElementById('param-label').value       = '';
        document.getElementById('param-type').value        = 'STRING';
        document.getElementById('param-default').value     = '';
        document.getElementById('param-description').value = '';
        document.getElementById('param-required').checked  = false;
        document.getElementById('param-name').disabled     = false;
    }

    addParamModal.show();
}

function saveParameter() {
    const name = document.getElementById('param-name').value.trim();
    if (!name) {
        showToast('Variable name is required', 'error');
        return;
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
        showToast('Variable name must start with a letter/underscore, no spaces or special characters', 'error');
        return;
    }

    const param = {
        name,
        label:        document.getElementById('param-label').value.trim() || camelToLabel(name),
        type:         document.getElementById('param-type').value,
        defaultValue: document.getElementById('param-default').value.trim(),
        description:  document.getElementById('param-description').value.trim(),
        required:     document.getElementById('param-required').checked
    };

    const idx = parseInt(document.getElementById('param-edit-index').value);
    if (idx >= 0) {
        // Preserve the id if it exists (for backend update)
        param.id = parameters[idx].id;
        parameters[idx] = param;
    } else {
        // Check for duplicate name
        if (parameters.find(p => p.name === name)) {
            showToast(`Parameter "${name}" already exists`, 'error');
            return;
        }
        parameters.push(param);
    }

    renderParametersList();
    addParamModal.hide();
    showToast(idx >= 0 ? 'Parameter updated' : `Parameter "${name}" added`, 'success');
}

function deleteParameter(index) {
    const p = parameters[index];
    if (!p) return;
    if (!confirm(`Remove parameter "${p.name}" from this template?`)) return;
    parameters.splice(index, 1);
    renderParametersList();
    showToast(`Parameter "${p.name}" removed`, 'info');
}

/** Copy ${paramName} to clipboard and highlight the insert action. */
function insertParameter(index) {
    const p = parameters[index];
    if (!p) return;
    const placeholder = `\${${p.name}}`;
    navigator.clipboard.writeText(placeholder).then(() => {
        showToast(`Copied ${placeholder} — paste it inside the editor text`, 'success');
    }).catch(() => {
        // Fallback for environments without clipboard API
        showToast(`Insert this in your template: ${placeholder}`, 'info');
    });
}

function renderParametersList() {
    const list = document.getElementById('params-list');
    if (parameters.length === 0) {
        list.innerHTML = `
        <div class="params-empty">
            <i class="bi bi-braces"></i>
            No parameters yet.<br>
            <small>Click <strong>+ Add</strong> to define FTL variables.</small>
        </div>`;
        return;
    }

    list.innerHTML = parameters.map((p, i) => `
    <div class="param-item" id="param-item-${i}">
        <div class="param-item-header">
            <span class="param-name">\${${p.name}}</span>
            <div class="d-flex gap-1">
                <span class="param-type-badge">${escapeHtml(p.type || 'STRING')}</span>
                ${p.required ? '<span class="param-required-badge">required</span>' : ''}
            </div>
        </div>
        ${p.label ? `<div class="param-label">${escapeHtml(p.label)}</div>` : ''}
        ${p.description ? `<div class="param-label text-muted" style="font-size:0.74rem">${escapeHtml(p.description)}</div>` : ''}
        ${p.defaultValue ? `<div class="param-label text-muted" style="font-size:0.74rem">Default: <code>${escapeHtml(p.defaultValue)}</code></div>` : ''}
        <div class="param-item-actions">
            <button class="param-insert-btn" onclick="insertParameter(${i})" title="Copy \${${p.name}} to clipboard">
                <i class="bi bi-clipboard"></i> Insert
            </button>
            <button class="param-edit-btn" onclick="openAddParamModal(${i})" title="Edit parameter">
                <i class="bi bi-pencil"></i>
            </button>
            <button class="param-delete-btn" onclick="deleteParameter(${i})" title="Remove parameter">
                <i class="bi bi-trash"></i>
            </button>
        </div>
    </div>`).join('');
}

// ─── Import / Export JSON ─────────────────────────────────────────────────
function openImportJsonModal() {
    document.getElementById('json-import-input').value = '';
    document.getElementById('json-import-error').classList.add('d-none');
    importJsonModal.show();
}

function importParamsFromJson() {
    const raw = document.getElementById('json-import-input').value.trim();
    const errEl = document.getElementById('json-import-error');
    errEl.classList.add('d-none');

    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) throw new Error('Expected a JSON array of parameters');

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
        showToast(`Imported ${parameters.length} parameter(s) from JSON`, 'success');
    } catch (err) {
        errEl.textContent = 'Invalid JSON: ' + err.message;
        errEl.classList.remove('d-none');
    }
}

function exportParamsJson() {
    const json = JSON.stringify(parameters.map(p => ({
        name:         p.name,
        label:        p.label,
        type:         p.type,
        defaultValue: p.defaultValue,
        description:  p.description,
        required:     p.required
    })), null, 2);

    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const name = document.getElementById('template-name').value || 'template';
    a.href     = url;
    a.download = name.replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase() + '_params.json';
    a.click();
    URL.revokeObjectURL(url);
}

// ─── Preview ─────────────────────────────────────────────────────────────
function openPreviewModal() {
    renderPreviewParamsForm();
    document.getElementById('preview-error').classList.add('d-none');
    document.getElementById('preview-iframe').srcdoc = '';
    previewModal.show();
}

function renderPreviewParamsForm() {
    const form = document.getElementById('preview-params-form');
    if (parameters.length === 0) {
        form.innerHTML = '<p class="text-muted small">No parameters defined. Add parameters in the right panel.</p>';
        return;
    }
    form.innerHTML = parameters.map(p => `
    <div class="mb-2 param-preview-field">
        <label for="prev-${p.name}" class="form-label mb-1">
            ${escapeHtml(p.label || p.name)}
            ${p.required ? '<span class="text-danger ms-1">*</span>' : ''}
            <code class="ms-1" style="font-size:0.72rem;color:#0d6efd">\${${p.name}}</code>
        </label>
        <input type="text" id="prev-${p.name}"
               class="form-control form-control-sm"
               value="${escapeHtml(p.defaultValue || '')}"
               placeholder="${escapeHtml(p.defaultValue || p.label || p.name)}">
        ${p.description ? `<div class="param-hint">${escapeHtml(p.description)}</div>` : ''}
    </div>`).join('');
}

function fillDefaultValues() {
    parameters.forEach(p => {
        const el = document.getElementById(`prev-${p.name}`);
        if (el && p.defaultValue) el.value = p.defaultValue;
    });
}

async function renderPreview() {
    if (!currentTemplateId) {
        showToast('Save the template first before previewing', 'info');
        return;
    }

    let previewParams = {};

    if (jsonModeActive) {
        // Parse from JSON textarea
        try {
            previewParams = JSON.parse(document.getElementById('preview-json-input').value || '{}');
        } catch (e) {
            showToast('Invalid JSON in parameter values', 'error');
            return;
        }
    } else {
        // Collect from form fields
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

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Preview failed');
        }

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
        // Build JSON from current form values
        const vals = {};
        parameters.forEach(p => {
            const el = document.getElementById(`prev-${p.name}`);
            vals[p.name] = el ? el.value : (p.defaultValue || '');
        });
        jsonArea.value = JSON.stringify(vals, null, 2);
        jsonArea.classList.remove('d-none');
        formArea.classList.add('d-none');
    } else {
        jsonArea.classList.add('d-none');
        formArea.classList.remove('d-none');
    }
}

function setPreviewWidth(width, btn) {
    const iframe = document.getElementById('preview-iframe');
    iframe.style.width = width;

    // Toggle active state
    document.querySelectorAll('#preview-device-btns button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

// ─── Email Blocks for GrapesJS ────────────────────────────────────────────
function emailBlocks() {
    return [
        {
            id: 'email-layout',
            label: `<div><i style="font-size:20px">📧</i><br>Email Wrapper</div>`,
            category: 'Layout',
            content: `<table width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;background:#f4f4f4;">
  <tr><td align="center" style="padding:20px 0;">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:6px;">
      <tr><td style="padding:24px;">Put your content here</td></tr>
    </table>
  </td></tr>
</table>`
        },
        {
            id: 'email-header',
            label: `<div><i style="font-size:20px">🏷️</i><br>Header</div>`,
            category: 'Email',
            content: `<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td style="background:#0d6efd;padding:28px;text-align:center;">
    <h1 style="margin:0;color:#fff;font-family:Arial,sans-serif;font-size:24px;font-weight:700;">Company Name</h1>
    <p style="margin:6px 0 0;color:#cce5ff;font-size:13px;">Your tagline here</p>
  </td></tr>
</table>`
        },
        {
            id: 'email-text',
            label: `<div><i style="font-size:20px">📝</i><br>Text Block</div>`,
            category: 'Email',
            content: `<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td style="padding:20px;font-family:Arial,sans-serif;font-size:14px;color:#333;line-height:1.7;">
    <p style="margin:0 0 12px;">Hi <strong>\${customerName}</strong>,</p>
    <p style="margin:0;">Your email body text goes here.</p>
  </td></tr>
</table>`
        },
        {
            id: 'email-button',
            label: `<div><i style="font-size:20px">🔘</i><br>CTA Button</div>`,
            category: 'Email',
            content: `<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td style="padding:20px;text-align:center;">
    <a href="\${ctaUrl}" style="display:inline-block;background:#0d6efd;color:#fff;
       text-decoration:none;padding:12px 28px;border-radius:6px;
       font-family:Arial,sans-serif;font-size:15px;font-weight:600;">
      Click Here
    </a>
  </td></tr>
</table>`
        },
        {
            id: 'email-image',
            label: `<div><i style="font-size:20px">🖼️</i><br>Image</div>`,
            category: 'Email',
            content: `<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td style="padding:0;text-align:center;">
    <img src="https://placehold.co/600x200/0d6efd/white?text=Image"
         alt="Image" width="600" style="max-width:100%;height:auto;display:block;">
  </td></tr>
</table>`
        },
        {
            id: 'email-divider',
            label: `<div><i style="font-size:20px">➖</i><br>Divider</div>`,
            category: 'Email',
            content: `<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td style="padding:16px 20px;">
    <hr style="border:none;border-top:1px solid #e0e0e0;margin:0;">
  </td></tr>
</table>`
        },
        {
            id: 'email-two-col',
            label: `<div><i style="font-size:20px">⬛⬛</i><br>2 Columns</div>`,
            category: 'Layout',
            content: `<table width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td width="50%" style="padding:12px;vertical-align:top;font-family:Arial,sans-serif;font-size:14px;color:#333;">
      Left column content
    </td>
    <td width="50%" style="padding:12px;vertical-align:top;font-family:Arial,sans-serif;font-size:14px;color:#333;">
      Right column content
    </td>
  </tr>
</table>`
        },
        {
            id: 'email-order-table',
            label: `<div><i style="font-size:20px">📋</i><br>Order Table</div>`,
            category: 'Email',
            content: `<table width="100%" cellpadding="8" cellspacing="0"
       style="font-family:Arial,sans-serif;font-size:14px;color:#333;border-collapse:collapse;margin:10px 0;">
  <tr style="background:#f8f9fa;font-weight:bold;">
    <td style="border:1px solid #dee2e6;padding:10px;">Item</td>
    <td style="border:1px solid #dee2e6;padding:10px;">Qty</td>
    <td style="border:1px solid #dee2e6;padding:10px;">Price</td>
  </tr>
  <tr>
    <td style="border:1px solid #dee2e6;padding:10px;">\${itemName}</td>
    <td style="border:1px solid #dee2e6;padding:10px;">\${itemQty}</td>
    <td style="border:1px solid #dee2e6;padding:10px;">\${itemPrice}</td>
  </tr>
  <tr style="background:#f8f9fa;font-weight:bold;">
    <td colspan="2" style="border:1px solid #dee2e6;padding:10px;text-align:right;">Total:</td>
    <td style="border:1px solid #dee2e6;padding:10px;">\${orderTotal}</td>
  </tr>
</table>`
        },
        {
            id: 'email-footer',
            label: `<div><i style="font-size:20px">🔻</i><br>Footer</div>`,
            category: 'Email',
            content: `<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td style="background:#f8f9fa;padding:20px;text-align:center;border-top:1px solid #e0e0e0;">
    <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:12px;color:#666;">
      © 2024 Your Company. All rights reserved.
    </p>
    <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#aaa;">
      <a href="\${unsubscribeUrl}" style="color:#aaa;text-decoration:underline;">Unsubscribe</a>
      &nbsp;·&nbsp;
      <a href="\${privacyUrl}" style="color:#aaa;text-decoration:underline;">Privacy Policy</a>
    </p>
  </td></tr>
</table>`
        },
        {
            id: 'ftl-if-block',
            label: `<div><i style="font-size:20px">🔀</i><br>FTL If/Else</div>`,
            category: 'FTL',
            content: `<#if condition??>
  <!-- Content shown when condition is true -->
  <p style="font-family:Arial,sans-serif;font-size:14px;">Conditional content here</p>
<#else>
  <!-- Fallback content -->
</#if>`
        },
        {
            id: 'ftl-list-block',
            label: `<div><i style="font-size:20px">📜</i><br>FTL List</div>`,
            category: 'FTL',
            content: `<#list items as item>
  <table width="100%" cellpadding="8" cellspacing="0" style="border-bottom:1px solid #eee;">
    <tr>
      <td style="font-family:Arial,sans-serif;font-size:14px;">\${item.name}</td>
      <td style="font-family:Arial,sans-serif;font-size:14px;">\${item.value}</td>
    </tr>
  </table>
</#list>`
        }
    ];
}

// ─── Utility ─────────────────────────────────────────────────────────────

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** Convert camelCase to "Title Case" label */
function camelToLabel(str) {
    if (!str) return '';
    return str
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, s => s.toUpperCase())
        .trim();
}

function showToast(message, type = 'info') {
    const toast   = document.getElementById('main-toast');
    const body    = document.getElementById('toast-body');
    const title   = document.getElementById('toast-title');
    const icon    = document.getElementById('toast-icon');

    const cfg = {
        success: { title: 'Success', cls: 'text-success', icon: 'bi-check-circle-fill' },
        error:   { title: 'Error',   cls: 'text-danger',  icon: 'bi-exclamation-triangle-fill' },
        info:    { title: 'Info',    cls: 'text-primary', icon: 'bi-info-circle-fill' }
    }[type] || { title: 'Info', cls: 'text-primary', icon: 'bi-info-circle-fill' };

    title.textContent = cfg.title;
    body.textContent  = message;
    icon.className    = `bi ${cfg.icon} me-2 ${cfg.cls}`;

    bootstrap.Toast.getOrCreateInstance(toast, { delay: 3500 }).show();
}
