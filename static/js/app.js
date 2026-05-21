// ============================================================
//  BillingFlow — App logic
//  API base preparada para el futuro invoice-service
// ============================================================
const INVOICE_API = 'http://localhost:8083/api/facturas';
const CUSTOMER_API = 'http://localhost:8082/api/customers';

// ---- AUTH CHECK ----
const raw = localStorage.getItem('currentCustomer');
if (!raw) {
    window.location.href = 'login.html';
}
const currentUser = raw ? JSON.parse(raw) : null;
if (!currentUser?.token && !localStorage.getItem('currentCustomerToken')) {
    localStorage.removeItem('currentCustomer');
    localStorage.removeItem('currentCustomerEmail');
    localStorage.removeItem('currentCustomerRole');
    window.location.href = 'login.html';
}

// ---- STATE ----
// Borradores locales + facturas persistidas en invoice-service
const DRAFTS_KEY = 'billingflow_drafts';
let drafts = JSON.parse(localStorage.getItem(DRAFTS_KEY) || '[]');
let serverInvoices = [];
// Si no es null, el formulario está editando un borrador existente.
let editingDraftId = null;

function getAuthToken() {
    return currentUser?.token || localStorage.getItem('currentCustomerToken') || '';
}

function getAuthHeaders(extra = {}) {
    const token = getAuthToken();
    const headers = { ...extra };
    if (token) {
        // Todas las llamadas protegidas al backend viajan con JWT Bearer.
        headers.Authorization = `Bearer ${token}`;
    }
    return headers;
}

function saveDrafts() {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
}

async function fetchInvoicesFromServer() {
    try {
        const res = await fetch(INVOICE_API, { headers: getAuthHeaders({ 'Content-Type': 'application/json' }) });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const data = await res.json();
        serverInvoices = Array.isArray(data) ? data : [];
        setInvoiceServiceNotice(true);
    } catch (error) {
        serverInvoices = [];
        setInvoiceServiceNotice(false, error.message);
    }
}

function mapServerInvoice(invoice) {
    const id = invoice?.id;
    const date = typeof invoice?.fechaEmision === 'string' ? invoice.fechaEmision.split('T')[0] : '';

    return {
        id: `srv-${id}`,
        serverId: id,
        numero: `FAC-${String(id).padStart(5, '0')}`,
        clienteNombre: invoice?.cliente || 'Cliente',
        fecha: date,
        total: Number(invoice?.total || 0),
        status: 'paid',
        source: 'server'
    };
}

function getAllInvoices() {
    const remote = serverInvoices.map(mapServerInvoice);
    return [...remote, ...drafts];
}

function setInvoiceServiceNotice(isOnline, details = '') {
    const notice = document.getElementById('comingSoonNotice');
    const generateBtn = document.getElementById('generateBtn');
    if (!notice || !generateBtn) return;

    if (isOnline) {
        notice.innerHTML = '<span>✅</span><span>Factura conectada al <strong>Invoice Service</strong>. Al generar, se descargará el PDF automáticamente.</span>';
        notice.style.borderColor = 'rgba(16,185,129,0.35)';
        notice.style.background = 'rgba(16,185,129,0.1)';
        notice.style.color = '#6ee7b7';
        generateBtn.disabled = false;
    } else {
        notice.innerHTML = `<span>⚠️</span><span>No se pudo conectar con <strong>Invoice Service</strong>${details ? ` (${escHtml(details)})` : ''}. Puedes guardar borradores.</span>`;
        notice.style.borderColor = 'rgba(245,158,11,0.3)';
        notice.style.background = 'rgba(245,158,11,0.1)';
        notice.style.color = '#fcd34d';
        generateBtn.disabled = true;
    }
}

// ---- NAVIGATION ----
function navigate(viewName) {
    document.querySelectorAll('.app-view').forEach(v => v.style.display = 'none');
    document.querySelectorAll('.app-nav-item').forEach(b => b.classList.remove('active'));

    const view = document.getElementById('view-' + viewName);
    if (view) view.style.display = 'block';

    const btn = document.querySelector(`.app-nav-item[data-view="${viewName}"]`);
    if (btn) btn.classList.add('active');

    if (viewName === 'dashboard') renderDashboard();
    if (viewName === 'mis-facturas') renderInvoiceList();
    if (viewName === 'admin') loadAdminView();
}

document.querySelectorAll('[data-view]').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.view));
});

// ---- TOPBAR & PROFILE ----
function initUser() {
    if (!currentUser) return;
    const fullName = `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim();

    document.getElementById('topbarUserName').textContent = fullName || currentUser.email;
    document.getElementById('dashboardWelcome').textContent = `Hola, ${currentUser.firstName || 'usuario'} 👋`;

    // Perfil
    document.getElementById('profileAvatar').textContent =
        (currentUser.firstName?.[0] || '?').toUpperCase();
    document.getElementById('profileName').textContent = fullName || '—';
    document.getElementById('profileEmail').textContent = currentUser.email || '—';
    document.getElementById('profileEmail2').textContent = currentUser.email || '—';
    document.getElementById('profileFullName').textContent = fullName || '—';
    document.getElementById('profileId').textContent = currentUser.id || '—';

    const role = currentUser.role || 'USER';
    document.getElementById('profileRole').textContent = role;
    document.getElementById('profileRole2').textContent = role;
    document.getElementById('profileRole').className =
        'app-role-badge' + (role === 'ADMIN' ? ' app-role-badge--admin' : '');

    // Mostrar botón Admin en sidebar solo si es ADMIN
    if (role === 'ADMIN') {
        const adminBtn = document.getElementById('adminNavBtn');
        if (adminBtn) adminBtn.style.display = 'flex';
    }
}

// ---- LOGOUT ----
function logout() {
    localStorage.removeItem('currentCustomer');
    localStorage.removeItem('currentCustomerEmail');
    localStorage.removeItem('currentCustomerRole');
    localStorage.removeItem('currentCustomerToken');
    window.location.href = 'login.html';
}

document.getElementById('logoutBtn').addEventListener('click', logout);
document.getElementById('profileLogoutBtn').addEventListener('click', logout);

// ---- DASHBOARD ----
function renderDashboard() {
    const all = getAllInvoices();
    const paid = all.filter(f => f.status === 'paid');
    const pending = all.filter(f => f.status === 'pending');
    const now = new Date();
    const thisMonth = all.filter(f => {
        const d = new Date(f.fecha);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    document.getElementById('statTotal').textContent = all.length;
    document.getElementById('statRevenue').textContent =
        '€' + paid.reduce((s, f) => s + (f.total || 0), 0).toFixed(2).replace('.', ',');
    document.getElementById('statPending').textContent = pending.length;
    document.getElementById('statThisMonth').textContent = thisMonth.length;

    const container = document.getElementById('dashboardInvoiceList');
    const recent = [...all].reverse().slice(0, 5);

    if (recent.length === 0) {
        container.innerHTML = `
            <div class="app-empty-state">
                <div class="app-empty-icon">📄</div>
                <p>Aún no has creado ninguna factura</p>
                <button class="btn-large app-btn-new" data-view="nueva-factura">Crear primera factura</button>
            </div>`;
        container.querySelectorAll('[data-view]').forEach(el =>
            el.addEventListener('click', () => navigate(el.dataset.view))
        );
        return;
    }

    container.innerHTML = buildInvoiceTable(recent);
}

// ---- INVOICE LIST ----
function renderInvoiceList(filter = 'all', search = '') {
    const wrapper = document.getElementById('invoiceTableWrapper');
    let list = [...getAllInvoices()].reverse();

    if (filter !== 'all') list = list.filter(f => f.status === filter);
    if (search) {
        const q = search.toLowerCase();
        list = list.filter(f =>
            (f.clienteNombre || '').toLowerCase().includes(q) ||
            (f.numero || '').toLowerCase().includes(q)
        );
    }

    if (list.length === 0) {
        wrapper.innerHTML = `
            <div class="app-empty-state">
                <div class="app-empty-icon">📋</div>
                <p>${search || filter !== 'all' ? 'No hay resultados' : 'No hay facturas aún'}</p>
                ${!search && filter === 'all' ? `<button class="btn-large app-btn-new" data-view="nueva-factura">Crear primera factura</button>` : ''}
            </div>`;
        wrapper.querySelectorAll('[data-view]').forEach(el =>
            el.addEventListener('click', () => navigate(el.dataset.view))
        );
        return;
    }

    wrapper.innerHTML = buildInvoiceTable(list, true);
    wrapper.querySelectorAll('.app-edit-draft-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            editDraftById(btn.dataset.id);
        });
    });

    wrapper.querySelectorAll('.app-delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            const ok = await deleteInvoiceById(id);
            if (!ok) return;

            renderInvoiceList(
                document.getElementById('invoiceFilter').value,
                document.getElementById('invoiceSearch').value
            );
            renderDashboard();
            showToast('Factura eliminada');
        });
    });
}

async function deleteInvoiceById(id) {
    if (id.startsWith('srv-')) {
        const serverId = id.replace('srv-', '');
        try {
            const res = await fetch(`${INVOICE_API}/${serverId}`, { method: 'DELETE', headers: getAuthHeaders() });
            if (!res.ok) throw new Error(`Error ${res.status}`);
            await fetchInvoicesFromServer();
            return true;
        } catch (error) {
            showToast('No se pudo eliminar en servidor: ' + error.message, 'error');
            return false;
        }
    }

    drafts = drafts.filter(f => f.id !== id);
    saveDrafts();
    return true;
}

function editDraftById(id) {
    const draft = drafts.find(f => f.id === id);
    if (!draft) {
        showToast('No se encontró el borrador', 'error');
        return;
    }

    // Entramos en modo "edición" para que guardar actualice y no cree otro borrador.
    editingDraftId = id;
    navigate('nueva-factura');

    document.getElementById('facturaNumero').value = draft.numero || '';
    document.getElementById('invoiceCliente').value = draft.clienteNombre || '';
    document.getElementById('invoiceFechaEmision').value = draft.fecha || '';
    document.getElementById('invoiceMontoBase').value = Number(draft.base || 0).toFixed(2);

    // Reconstruye IVA% si el borrador no lo tenía explícito guardado.
    const draftPct = Number(draft.ivaPct);
    const computedPct = Number(draft.base) > 0 ? ((Number(draft.iva || 0) / Number(draft.base)) * 100) : 21;
    const ivaPercent = Number.isFinite(draftPct) ? draftPct : computedPct;
    const allowedPct = [0, 4, 10, 21].includes(Math.round(ivaPercent)) ? Math.round(ivaPercent) : 21;

    document.getElementById('invoiceIvaPercent').value = String(allowedPct);
    recalcInvoiceTotals();
    document.getElementById('invoiceIva').value = Number(draft.iva || 0).toFixed(2);
    document.getElementById('invoiceTotal').value = Number(draft.total || 0).toFixed(2);
    document.getElementById('saveBtn').textContent = 'Actualizar borrador';
}

function buildInvoiceTable(list, withActions = false) {
    const statusLabel = { paid: 'Pagada', pending: 'Pendiente', draft: 'Borrador' };
    const statusClass = { paid: 'status-paid', pending: 'status-pending', draft: 'status-draft' };

    const rows = list.map(f => `
        <tr>
            <td>${f.numero || '—'}</td>
            <td>${f.clienteNombre || '—'}</td>
            <td>${formatDate(f.fecha)}</td>
            <td>€${(f.total || 0).toFixed(2).replace('.', ',')}</td>
            <td><span class="app-status-tag ${statusClass[f.status] || ''}">${statusLabel[f.status] || f.status}</span></td>
            ${withActions ? `<td>${f.source === 'draft' ? `<button class="app-action-btn app-edit-draft-btn" data-id="${f.id}" title="Editar borrador">Editar</button>` : ''} <button class="app-action-btn app-action-btn--danger app-delete-btn" data-id="${f.id}" title="Eliminar factura">Eliminar</button></td>` : ''}
        </tr>`).join('');

    return `
        <table class="app-table">
            <thead>
                <tr>
                    <th>Nº Factura</th>
                    <th>Cliente</th>
                    <th>Fecha</th>
                    <th>Total</th>
                    <th>Estado</th>
                    ${withActions ? '<th></th>' : ''}
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>`;
}

// ---- SEARCH & FILTER (Mis Facturas) ----
document.getElementById('invoiceSearch').addEventListener('input', e => {
    renderInvoiceList(document.getElementById('invoiceFilter').value, e.target.value);
});
document.getElementById('invoiceFilter').addEventListener('change', e => {
    renderInvoiceList(e.target.value, document.getElementById('invoiceSearch').value);
});

// ---- INVOICE FORM ----
function recalcInvoiceTotals() {
    const base = parseFloat(document.getElementById('invoiceMontoBase').value) || 0;
    const ivaPct = parseFloat(document.getElementById('invoiceIvaPercent').value) || 0;
    const iva = base * ivaPct / 100;
    const total = base + iva;

    document.getElementById('invoiceIva').value = iva.toFixed(2);
    document.getElementById('invoiceTotal').value = total.toFixed(2);
}

// Validación estricta: SOLO números y hasta 2 decimales
// Rechaza: múltiples signos, letra 'e', múltiples puntos, etc.
function validateNumberInput(value) {
    if (value === '') return '';

    const validPattern = /^-?[0-9]+(\.[0-9]{1,2})?$/;

    if (!validPattern.test(value)) {
        let cleaned = value.replace(/[^0-9.-]/g, '');
        cleaned = cleaned.replace(/\.+/g, '.');
        cleaned = cleaned.replace(/-+/g, '-');
        if (cleaned.indexOf('-') > 0) {
            cleaned = cleaned.replace(/-/g, '');
        }

        const parts = cleaned.split('.');
        if (parts.length > 2) {
            cleaned = parts[0] + '.' + parts.slice(1).join('');
        }
        if (parts[1] && parts[1].length > 2) {
            cleaned = parts[0] + '.' + parts[1].substring(0, 2);
        }

        return cleaned;
    }
    return value;
}

document.getElementById('invoiceMontoBase').addEventListener('input', (e) => {
    e.target.value = validateNumberInput(e.target.value);
    recalcInvoiceTotals();
});
document.getElementById('invoiceIvaPercent').addEventListener('change', recalcInvoiceTotals);

// Autocompletar número de factura con fecha de hoy
function initInvoiceForm() {
    // Al abrir "Nueva Factura" limpiamos el modo edición para empezar desde cero.
    editingDraftId = null;
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    document.getElementById('invoiceFechaEmision').value = dateStr;

    const month = String(now.getMonth() + 1).padStart(2, '0');
    const nextNum = String(getAllInvoices().length + 1).padStart(3, '0');
    document.getElementById('facturaNumero').value = `FAC-${now.getFullYear()}${month}-${nextNum}`;

    document.getElementById('invoiceCliente').value = '';
    document.getElementById('invoiceMontoBase').value = '';
    document.getElementById('invoiceIvaPercent').value = '21';
    document.getElementById('saveBtn').textContent = 'Guardar borrador';
    recalcInvoiceTotals();
}

// Guardar borrador
document.getElementById('saveBtn').addEventListener('click', () => {
    const draft = collectFormData();
    if (!draft.clienteNombre || !draft.numero) {
        showToast('Rellena al menos el número de factura y el cliente', 'error');
        return;
    }
    draft.status = 'draft';
    draft.source = 'draft';

    if (editingDraftId) {
        // Actualiza el mismo borrador editado (misma id).
        draft.id = editingDraftId;
        drafts = drafts.map(d => d.id === editingDraftId ? draft : d);
        showToast('Borrador actualizado ✓');
    } else {
        draft.id = 'draft-' + Date.now();
        drafts.push(draft);
        showToast('Borrador guardado ✓');
    }

    saveDrafts();
    navigate('mis-facturas');
});

// Envío del formulario al invoice-service + descarga del PDF
document.getElementById('invoiceForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const generateBtn = document.getElementById('generateBtn');
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generando PDF...';

    try {
        const form = collectFormData();
        if (!form.clienteNombre || !form.total) {
            showToast('Completa cliente y monto base antes de generar', 'error');
            return;
        }

        const payload = {
            cliente: form.clienteNombre,
            montoBase: form.base,
            iva: form.iva,
            total: form.total,
            fechaEmision: form.fecha ? `${form.fecha}T00:00:00` : null
        };

        const response = await fetch(INVOICE_API, {
            method: 'POST',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Error ${response.status}`);
        }

        const blob = await response.blob();
        const fileName = getFileNameFromHeaders(response.headers) || `factura_${Date.now()}.pdf`;
        downloadBlob(blob, fileName);

        if (editingDraftId) {
            // Si venimos de un borrador y se generó factura real, eliminamos el borrador local.
            drafts = drafts.filter(d => d.id !== editingDraftId);
            editingDraftId = null;
            saveDrafts();
            document.getElementById('saveBtn').textContent = 'Guardar borrador';
        }

        await fetchInvoicesFromServer();
        renderDashboard();
        showToast('Factura generada y PDF descargado ✓');
        navigate('mis-facturas');
    } catch (error) {
        showToast('No se pudo generar la factura: ' + error.message, 'error');
    } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generar PDF';
    }
});

function collectFormData() {
    const base = parseFloat(document.getElementById('invoiceMontoBase').value) || 0;
    const ivaPct = parseFloat(document.getElementById('invoiceIvaPercent').value) || 0;
    const iva = parseFloat(document.getElementById('invoiceIva').value) || 0;
    const total = parseFloat(document.getElementById('invoiceTotal').value) || 0;

    return {
        numero: document.getElementById('facturaNumero').value,
        fecha: document.getElementById('invoiceFechaEmision').value,
        clienteNombre: document.getElementById('invoiceCliente').value,
        ivaPct,
        iva,
        base,
        total,
        status: 'pending',
    };
}

// Re-init the form each time the view is opened
document.querySelector('.app-nav-item[data-view="nueva-factura"]').addEventListener('click', initInvoiceForm);

// ---- TOAST ----
let toastTimer;
function showToast(msg, type = 'success') {
    const toast = document.getElementById('appToast');
    toast.textContent = msg;
    toast.className = `app-toast app-toast--${type} app-toast--visible`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('app-toast--visible'), 3200);
}

// ---- HELPERS ----
function formatDate(iso) {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
}

function getFileNameFromHeaders(headers) {
    const disposition = headers.get('content-disposition') || '';
    const match = disposition.match(/filename="?([^";]+)"?/i);
    return match ? match[1] : null;
}

function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

// ---- INIT ----
async function initializeApp() {
    initUser();
    initInvoiceForm();
    initAdminPanel();
    await fetchInvoicesFromServer();
    navigate('dashboard');
}

initializeApp();

// ============================================================
//  ADMIN PANEL
// ============================================================
let allUsers = [];

function isAdmin() {
    return currentUser?.role === 'ADMIN';
}

async function loadAdminView() {
    if (!isAdmin()) {
        navigate('dashboard');
        showToast('Acceso restringido a administradores', 'error');
        return;
    }

    const wrapper = document.getElementById('adminTableWrapper');
    wrapper.innerHTML = `<div class="app-empty-state"><div class="app-empty-icon">⏳</div><p>Cargando usuarios…</p></div>`;

    try {
        const res = await fetch(`${CUSTOMER_API}`, {
            headers: { 'Content-Type': 'application/json' }
        });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        allUsers = await res.json();
        renderAdminStats(allUsers);
        renderAdminTable(
            document.getElementById('adminFilter').value,
            document.getElementById('adminSearch').value
        );
    } catch (err) {
        wrapper.innerHTML = `
            <div class="app-empty-state">
                <div class="app-empty-icon">❌</div>
                <p>No se pudo conectar con el Customer Service</p>
                <small style="color:var(--text-muted)">${err.message}</small>
            </div>`;
    }
}

function renderAdminStats(users) {
    document.getElementById('adminStatTotal').textContent = users.length;
    document.getElementById('adminStatEnabled').textContent = users.filter(u => u.enabled).length;
    document.getElementById('adminStatDisabled').textContent = users.filter(u => !u.enabled).length;
    document.getElementById('adminStatAdmins').textContent = users.filter(u => u.role === 'ADMIN').length;
}

function renderAdminTable(filter = 'all', search = '') {
    const wrapper = document.getElementById('adminTableWrapper');
    let list = [...allUsers];

    if (filter === 'enabled')  list = list.filter(u => u.enabled);
    if (filter === 'disabled') list = list.filter(u => !u.enabled);
    if (filter === 'admin')    list = list.filter(u => u.role === 'ADMIN');

    if (search) {
        const q = search.toLowerCase();
        list = list.filter(u =>
            (u.firstName || '').toLowerCase().includes(q) ||
            (u.lastName  || '').toLowerCase().includes(q) ||
            (u.email     || '').toLowerCase().includes(q)
        );
    }

    if (list.length === 0) {
        wrapper.innerHTML = `<div class="app-empty-state"><div class="app-empty-icon">🔍</div><p>No hay resultados</p></div>`;
        return;
    }

    const isSelf = id => String(id) === String(currentUser?.id);

    const rows = list.map(u => `
        <tr class="${isSelf(u.id) ? 'admin-row-self' : ''}">
            <td><span class="admin-id-badge">#${u.id}</span></td>
            <td>
                <div class="admin-user-cell">
                    <span class="admin-avatar">${(u.firstName?.[0] || '?').toUpperCase()}</span>
                    <div>
                        <strong>${escHtml(u.firstName || '')} ${escHtml(u.lastName || '')}</strong>
                        ${isSelf(u.id) ? '<span class="admin-you-tag">Tú</span>' : ''}
                    </div>
                </div>
            </td>
            <td>${escHtml(u.email || '—')}</td>
            <td><span class="app-role-badge ${u.role === 'ADMIN' ? 'app-role-badge--admin' : ''}">${u.role || 'USER'}</span></td>
            <td>${u.enabled
                ? '<span class="app-status-tag status-paid">Verificado</span>'
                : '<span class="app-status-tag status-draft">Sin verificar</span>'
            }</td>
            <td>
                <div class="admin-actions">
                    <button class="app-action-btn admin-edit-btn" data-id="${u.id}" title="Editar usuario">Editar</button>
                    <button class="app-action-btn app-action-btn--danger admin-delete-btn" data-id="${u.id}" ${isSelf(u.id) ? 'disabled title="No puedes eliminarte a ti mismo"' : 'title="Eliminar usuario"'}>Eliminar</button>
                </div>
            </td>
        </tr>`).join('');

    wrapper.innerHTML = `
        <table class="app-table">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Usuario</th>
                    <th>Email</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>`;

    wrapper.querySelectorAll('.admin-edit-btn').forEach(btn => {
        btn.addEventListener('click', () => openEditModal(btn.dataset.id));
    });
    wrapper.querySelectorAll('.admin-delete-btn:not([disabled])').forEach(btn => {
        btn.addEventListener('click', () => confirmDeleteUser(btn.dataset.id));
    });
}

async function confirmDeleteUser(id) {
    const user = allUsers.find(u => String(u.id) === String(id));
    if (!user) return;
    const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
    if (!confirm(`¿Eliminar al usuario "${name}"? Esta acción no se puede deshacer.`)) return;

    try {
        const res = await fetch(`${CUSTOMER_API}/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        showToast(`Usuario "${name}" eliminado`);
        await loadAdminView();
    } catch (err) {
        showToast('No se pudo eliminar el usuario: ' + err.message, 'error');
    }
}

function openEditModal(id) {
    const user = allUsers.find(u => String(u.id) === String(id));
    if (!user) return;

    document.getElementById('editUserId').value   = user.id;
    document.getElementById('editFirstName').value = user.firstName || '';
    document.getElementById('editLastName').value  = user.lastName  || '';
    document.getElementById('editEmail').value     = user.email     || '';
    document.getElementById('editRole').value      = user.role      || 'USER';
    document.getElementById('editEnabled').value   = String(user.enabled);

    document.getElementById('adminModalOverlay').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('adminModalOverlay').style.display = 'none';
}

async function saveUserEdit() {
    const id        = document.getElementById('editUserId').value;
    const firstName = document.getElementById('editFirstName').value.trim();
    const lastName  = document.getElementById('editLastName').value.trim();
    const email     = document.getElementById('editEmail').value.trim();
    const role      = document.getElementById('editRole').value;
    const enabled   = document.getElementById('editEnabled').value === 'true';

    if (!firstName || !email) {
        showToast('Nombre y email son obligatorios', 'error');
        return;
    }

    try {
        const res = await fetch(`${CUSTOMER_API}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firstName, lastName, email, role, enabled })
        });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        showToast('Usuario actualizado ✓');
        closeEditModal();
        await loadAdminView();
    } catch (err) {
        showToast('No se pudo actualizar: ' + err.message, 'error');
    }
}

function initAdminPanel() {
    document.getElementById('adminRefreshBtn').addEventListener('click', loadAdminView);
    document.getElementById('adminModalClose').addEventListener('click', closeEditModal);
    document.getElementById('adminModalCancel').addEventListener('click', closeEditModal);
    document.getElementById('adminModalSave').addEventListener('click', saveUserEdit);
    document.getElementById('adminModalOverlay').addEventListener('click', e => {
        if (e.target === document.getElementById('adminModalOverlay')) closeEditModal();
    });
    document.getElementById('adminSearch').addEventListener('input', e =>
        renderAdminTable(document.getElementById('adminFilter').value, e.target.value)
    );
    document.getElementById('adminFilter').addEventListener('change', e =>
        renderAdminTable(e.target.value, document.getElementById('adminSearch').value)
    );
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
