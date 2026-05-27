/* app.js — Template list page logic */

let deleteTargetId = null;
let deleteModal = null;

document.addEventListener('DOMContentLoaded', () => {
    deleteModal = new bootstrap.Modal(document.getElementById('deleteModal'));
    document.getElementById('confirm-delete-btn').addEventListener('click', confirmDelete);
    loadTemplates();
});

// ─── Load & render templates ───────────────────────────────────────────────

async function loadTemplates() {
    try {
        const res = await fetch('/api/templates');
        if (!res.ok) throw new Error('Failed to load templates');
        const templates = await res.json();

        document.getElementById('loading').classList.add('d-none');

        if (templates.length === 0) {
            document.getElementById('empty-state').classList.remove('d-none');
        } else {
            renderTemplates(templates);
        }
    } catch (err) {
        document.getElementById('loading').classList.add('d-none');
        showToast('Error loading templates: ' + err.message, 'error');
    }
}

function renderTemplates(templates) {
    const grid = document.getElementById('templates-grid');
    grid.innerHTML = templates.map(t => templateCard(t)).join('');
}

function templateCard(t) {
    const params = (t.parameters || []);
    const paramChips = params.slice(0, 5)
        .map(p => `<span class="param-chip">\${${p.name}}</span>`)
        .join('');
    const moreChips = params.length > 5
        ? `<span class="param-chip" style="background:#f0f0f0;color:#888">+${params.length - 5} more</span>`
        : '';

    const updated = t.updatedAt
        ? new Date(t.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '—';

    return `
    <div class="col-12 col-sm-6 col-lg-4 col-xl-3">
      <div class="template-card">
        <div class="card-title">
          <i class="bi bi-file-earmark-code text-primary me-1"></i>${escapeHtml(t.name)}
        </div>
        <div class="card-desc">${escapeHtml(t.description || 'No description')}</div>

        ${params.length > 0 ? `
        <div class="param-chips">
          ${paramChips}${moreChips}
        </div>` : ''}

        <div class="card-meta">
          <i class="bi bi-clock me-1"></i>${updated}
          &nbsp;·&nbsp;
          <i class="bi bi-sliders me-1"></i>${params.length} parameter${params.length !== 1 ? 's' : ''}
        </div>

        <div class="card-actions">
          <a href="/editor.html?id=${t.id}" class="btn btn-sm btn-outline-primary flex-fill">
            <i class="bi bi-pencil"></i> Edit
          </a>
          <button class="btn btn-sm btn-outline-success flex-fill" onclick="previewTemplate(${t.id})">
            <i class="bi bi-eye"></i> Preview
          </button>
          <button class="btn btn-sm btn-outline-secondary" onclick="exportFtl(${t.id}, '${escapeHtml(t.name)}')">
            <i class="bi bi-download"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger" onclick="askDelete(${t.id}, '${escapeHtml(t.name)}')">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
    </div>`;
}

// ─── Actions ───────────────────────────────────────────────────────────────

async function previewTemplate(id) {
    try {
        const res = await fetch(`/api/templates/${id}`);
        const template = await res.json();

        // Build a quick preview with default values
        const params = {};
        (template.parameters || []).forEach(p => {
            params[p.name] = p.defaultValue || `[${p.label || p.name}]`;
        });

        const previewRes = await fetch(`/api/templates/${id}/preview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ parameters: params })
        });

        const html = await previewRes.text();
        const win = window.open('', '_blank', 'width=800,height=600');
        win.document.write(html);
        win.document.close();
    } catch (err) {
        showToast('Preview failed: ' + err.message, 'error');
    }
}

async function exportFtl(id, name) {
    try {
        const res = await fetch(`/api/templates/${id}/export`);
        if (!res.ok) throw new Error('Export failed');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name.replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase() + '.ftl';
        a.click();
        URL.revokeObjectURL(url);
    } catch (err) {
        showToast('Export failed: ' + err.message, 'error');
    }
}

function askDelete(id, name) {
    deleteTargetId = id;
    document.getElementById('delete-name').textContent = name;
    deleteModal.show();
}

async function confirmDelete() {
    if (!deleteTargetId) return;
    try {
        const res = await fetch(`/api/templates/${deleteTargetId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Delete failed');
        deleteModal.hide();
        showToast('Template deleted', 'success');
        loadTemplates();
    } catch (err) {
        showToast('Delete failed: ' + err.message, 'error');
    } finally {
        deleteTargetId = null;
    }
}

// ─── Utility ───────────────────────────────────────────────────────────────

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;')
              .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('main-toast');
    const body = document.getElementById('toast-body');
    const title = document.getElementById('toast-title');
    toast.className = `toast ${type}`;
    title.textContent = type === 'error' ? 'Error' : type === 'success' ? 'Success' : 'Info';
    body.textContent = message;
    bootstrap.Toast.getOrCreateInstance(toast).show();
}
