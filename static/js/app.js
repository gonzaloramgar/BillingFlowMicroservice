// ============================================================
//  BillingFlow — App logic
//  API base preparada para el futuro invoice-service
// ============================================================
const INVOICE_API = 'http://localhost:8083/api/invoices'; // invoice-service (pendiente)
const CUSTOMER_API = 'http://localhost:8082/api/customers';

// ---- AUTH CHECK ----
const raw = localStorage.getItem('currentCustomer');
if (!raw) {
    window.location.href = 'login.html';
}
const currentUser = raw ? JSON.parse(raw) : null;

// ---- STATE ----
// Facturas en memoria (localStorage) hasta que invoice-service esté activo
const DRAFTS_KEY = 'billingflow_drafts';
let drafts = JSON.parse(localStorage.getItem(DRAFTS_KEY) || '[]');

function saveDrafts() {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
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
    window.location.href = 'login.html';
}

document.getElementById('logoutBtn').addEventListener('click', logout);
document.getElementById('profileLogoutBtn').addEventListener('click', logout);

// ---- DASHBOARD ----
function renderDashboard() {
    const all = drafts;
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
    let list = [...drafts].reverse();

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
    wrapper.querySelectorAll('.app-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            drafts = drafts.filter(f => f.id !== id);
            saveDrafts();
            renderInvoiceList(
                document.getElementById('invoiceFilter').value,
                document.getElementById('invoiceSearch').value
            );
            renderDashboard();
            showToast('Factura eliminada');
        });
    });
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
            ${withActions ? `<td><button class="app-icon-btn app-delete-btn" data-id="${f.id}" title="Eliminar">🗑</button></td>` : ''}
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
let lineCounter = 0;

function addLine(desc = '', qty = 1, price = 0) {
    lineCounter++;
    const id = `line-${lineCounter}`;
    const div = document.createElement('div');
    div.className = 'app-invoice-line';
    div.dataset.lineId = id;
    div.innerHTML = `
        <input type="text" class="line-desc" placeholder="Descripción del servicio" value="${desc}">
        <input type="number" class="line-qty" min="1" value="${qty}" placeholder="1">
        <input type="number" class="line-price" min="0" step="0.01" value="${price || ''}" placeholder="0,00">
        <span class="line-total">€0,00</span>
        <button type="button" class="app-icon-btn line-remove" title="Eliminar línea">✕</button>`;

    div.querySelector('.line-remove').addEventListener('click', () => {
        div.remove();
        recalcTotals();
    });

    ['line-qty', 'line-price'].forEach(cls => {
        div.querySelector(`.${cls}`).addEventListener('input', recalcTotals);
    });

    document.getElementById('invoiceLines').appendChild(div);
    recalcTotals();
}

function recalcTotals() {
    let base = 0;
    document.querySelectorAll('.app-invoice-line').forEach(line => {
        const qty = parseFloat(line.querySelector('.line-qty').value) || 0;
        const price = parseFloat(line.querySelector('.line-price').value) || 0;
        const lineTotal = qty * price;
        line.querySelector('.line-total').textContent = '€' + lineTotal.toFixed(2).replace('.', ',');
        base += lineTotal;
    });

    const ivaPct = parseFloat(document.getElementById('facturaIva').value) || 0;
    const iva = base * ivaPct / 100;
    const total = base + iva;

    document.getElementById('ivaLabel').textContent = ivaPct;
    document.getElementById('totalBase').textContent = '€' + base.toFixed(2).replace('.', ',');
    document.getElementById('totalIva').textContent = '€' + iva.toFixed(2).replace('.', ',');
    document.getElementById('totalFinal').textContent = '€' + total.toFixed(2).replace('.', ',');
}

document.getElementById('addLineBtn').addEventListener('click', () => addLine());
document.getElementById('facturaIva').addEventListener('change', recalcTotals);

// Autocompletar número de factura con fecha de hoy
function initInvoiceForm() {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    document.getElementById('facturaFecha').value = dateStr;

    const month = String(now.getMonth() + 1).padStart(2, '0');
    const nextNum = String(drafts.length + 1).padStart(3, '0');
    document.getElementById('facturaNumero').value = `FAC-${now.getFullYear()}${month}-${nextNum}`;

    // Prellenar email del emisor
    if (currentUser?.email) {
        document.getElementById('emisorEmail').value = currentUser.email;
    }
    if (currentUser) {
        const fullName = `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim();
        document.getElementById('emisorNombre').value = fullName;
    }

    // Añadir una línea por defecto
    document.getElementById('invoiceLines').innerHTML = '';
    lineCounter = 0;
    addLine('', 1, 0);
}

// Guardar borrador
document.getElementById('saveBtn').addEventListener('click', () => {
    const draft = collectFormData();
    if (!draft.clienteNombre && !draft.numero) {
        showToast('Rellena al menos el número de factura y el cliente', 'error');
        return;
    }
    draft.status = 'draft';
    draft.id = 'draft-' + Date.now();
    drafts.push(draft);
    saveDrafts();
    showToast('Borrador guardado ✓');
    navigate('mis-facturas');
});

// Envío del formulario (futuro invoice-service)
document.getElementById('invoiceForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    showToast('El Invoice Service aún no está activo. Guardado como borrador.', 'warning');
});

function collectFormData() {
    const lines = [];
    document.querySelectorAll('.app-invoice-line').forEach(line => {
        lines.push({
            descripcion: line.querySelector('.line-desc').value,
            cantidad: parseFloat(line.querySelector('.line-qty').value) || 0,
            precio: parseFloat(line.querySelector('.line-price').value) || 0,
        });
    });

    const base = lines.reduce((s, l) => s + l.cantidad * l.precio, 0);
    const ivaPct = parseFloat(document.getElementById('facturaIva').value) || 0;
    const total = base + base * ivaPct / 100;

    return {
        numero: document.getElementById('facturaNumero').value,
        fecha: document.getElementById('facturaFecha').value,
        vencimiento: document.getElementById('facturaVencimiento').value,
        emisorNombre: document.getElementById('emisorNombre').value,
        emisorNif: document.getElementById('emisorNif').value,
        emisorDireccion: document.getElementById('emisorDireccion').value,
        emisorEmail: document.getElementById('emisorEmail').value,
        emisorTelefono: document.getElementById('emisorTelefono').value,
        clienteNombre: document.getElementById('clienteNombre').value,
        clienteNif: document.getElementById('clienteNif').value,
        clienteDireccion: document.getElementById('clienteDireccion').value,
        clienteEmail: document.getElementById('clienteEmail').value,
        clienteTelefono: document.getElementById('clienteTelefono').value,
        iva: ivaPct,
        base,
        total,
        nota: document.getElementById('facturaNota').value,
        lineas: lines,
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

// ---- INIT ----
initUser();
initInvoiceForm();
initAdminPanel();
navigate('dashboard');

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
                    <button class="app-icon-btn admin-edit-btn" data-id="${u.id}" title="Editar">✏️</button>
                    <button class="app-icon-btn admin-delete-btn" data-id="${u.id}" ${isSelf(u.id) ? 'disabled title="No puedes eliminarte a ti mismo"' : 'title="Eliminar usuario"'}>🗑</button>
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
