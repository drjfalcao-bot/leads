
$('loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = clean($('email').value).toLowerCase();
  const password = $('password').value;
  $('authMessage').textContent = '';
  if (email !== ALLOWED_EMAIL) {
    $('authMessage').textContent = 'E-mail não autorizado.';
    return;
  }
  const submit = event.submitter;
  setBusy(submit, true, 'Entrando…');
  const { error } = await client.auth.signInWithPassword({ email, password });
  setBusy(submit, false);
  if (error) $('authMessage').textContent = error.message === 'Invalid login credentials' ? 'E-mail ou senha inválidos.' : error.message;
});

$('togglePassword').onclick = () => {
  const input = $('password');
  input.type = input.type === 'password' ? 'text' : 'password';
};
$('logoutBtn').onclick = () => client.auth.signOut();
$('themeToggle').onclick = toggleTheme;
$('settingsThemeToggle').onclick = toggleTheme;
$('mobileMenu').onclick = () => document.querySelector('.sidebar').classList.toggle('open');

async function bootstrap() {
  await Promise.all([loadReferenceData(), loadOverview(), loadContactsOverview()]);
  bindFilters();
  navigate('overview');
}

function navigate(view) {
  state.currentView = view;
  document.querySelectorAll('.view').forEach((el) => el.classList.toggle('active', el.id === `view-${view}`));
  document.querySelectorAll('.nav-item').forEach((el) => el.classList.toggle('active', el.dataset.view === view));
  const [eyebrow, title] = viewMeta[view];
  $('sectionEyebrow').textContent = eyebrow;
  $('sectionTitle').textContent = title;
  document.querySelector('.sidebar').classList.remove('open');
  if (view === 'companies') loadCompanies();
  if (view === 'contacts') loadContacts();
  if (view === 'states') renderStates();
}

document.querySelectorAll('.nav-item').forEach((button) => button.onclick = () => navigate(button.dataset.view));
document.querySelectorAll('[data-go]').forEach((button) => button.onclick = () => navigate(button.dataset.go));

async function loadReferenceData() {
  const [statesRes, statusesRes, ownersRes] = await Promise.all([
    client.from('leads_by_state').select('*').limit(100),
    client.from('leads_by_status').select('*').limit(100),
    client.from('leads_by_owner').select('*').limit(250)
  ]);
  if (statesRes.error || statusesRes.error || ownersRes.error) {
    toast('Não foi possível carregar os filtros.', 'error');
  }
  state.states = statesRes.data || [];
  state.statuses = statusesRes.data || [];
  state.owners = ownersRes.data || [];
  $('companyState').innerHTML = '<option value="">Todos</option>' + state.states.map((item) => `<option value="${escapeHtml(item.state_code)}">${escapeHtml(item.state_code)} · ${formatNumber(item.total)}</option>`).join('');
  $('companyStatus').innerHTML = '<option value="">Todos</option>' + state.statuses.map((item) => `<option value="${escapeHtml(item.status)}">${escapeHtml(item.status)} · ${formatNumber(item.total)}</option>`).join('');
  $('companyOwner').innerHTML = '<option value="">Todos</option>' + state.owners.map((item) => `<option value="${escapeHtml(item.owner_name)}">${escapeHtml(item.owner_name)} · ${formatNumber(item.total)}</option>`).join('');
}

async function loadOverview() {
  const [{ data: overview, error }, { data: statuses }, { data: states }, { data: owners }] = await Promise.all([
    client.from('dashboard_overview').select('*').maybeSingle(),
    client.from('leads_by_status').select('*').limit(7),
    client.from('leads_by_state').select('*').limit(8),
    client.from('leads_by_owner').select('*').limit(7)
  ]);
  if (error) {
    toast('Falha ao carregar o resumo da base.', 'error');
    return;
  }
  const o = overview || {};
  $('overviewStats').innerHTML = [
    ['▤', 'Empresas', o.total_companies, 'Total da fotografia', '#2056d8'],
    ['◎', 'Com contatos', o.companies_with_contacts, 'Empresas com vínculo', '#16825d'],
    ['◇', 'Sem estado', o.companies_without_state, 'Pendência de UF', '#b96b0a'],
    ['◌', 'Sem telefone', o.companies_without_phone, 'Pendência de contato', '#c43232']
  ].map(([icon, label, value, hint, color]) => metricCard(icon, label, value, hint, color)).join('');
  $('snapshotLabel').textContent = o.last_import_at ? formatDate(o.last_import_at) : '23/07/2026';
  renderStateBars(states || []);
  renderStatusDonut(statuses || [], o.total_companies || 0);
  renderOwnerRanking(owners || []);
  $('qualityCards').innerHTML = [
    ['Sem CNPJ', o.companies_without_cnpj],
    ['Sem telefone', o.companies_without_phone],
    ['Sem estado', o.companies_without_state],
    ['Contatos associados', o.associated_contacts_total]
  ].map(([label, value]) => `<article class="quality-card"><span>${escapeHtml(label)}</span><strong>${formatNumber(value)}</strong></article>`).join('');
}

function metricCard(icon, label, value, hint, color = '#2056d8') {
  return `<article class="metric-card" style="--metric-color:${color}"><div class="metric-icon">${icon}</div><span>${escapeHtml(label)}</span><strong>${formatNumber(value)}</strong><small>${escapeHtml(hint)}</small></article>`;
}

function renderStateBars(rows) {
  const max = Math.max(1, ...rows.map((item) => Number(item.total)));
  $('stateBars').innerHTML = rows.map((item) => `<div class="bar-row"><b>${escapeHtml(item.state_code)}</b><div class="bar-track"><div class="bar-fill" style="width:${Math.max(2, Number(item.total) / max * 100)}%"></div></div><strong>${formatNumber(item.total)}</strong></div>`).join('') || '<div class="empty-state"><span>Sem dados carregados.</span></div>';
}

function renderStatusDonut(rows, total) {
  const palette = ['#2056d8', '#60a5fa', '#4cc9a4', '#e6ad4a', '#ef7373', '#9b87f5', '#98a2b3'];
  let cursor = 0;
  const gradient = rows.map((item, index) => {
    const start = cursor;
    cursor += total ? Number(item.total) / Number(total) * 100 : 0;
    return `${palette[index % palette.length]} ${start}% ${cursor}%`;
  }).join(', ');
  $('statusDonut').innerHTML = `<div class="donut-wrap"><div class="donut" style="background:conic-gradient(${gradient || '#d0d5dd 0 100%'})"></div><div class="donut-label"><strong>${formatNumber(total)}</strong><small>empresas</small></div></div><div class="legend">${rows.map((item, index) => `<div class="legend-row"><span class="legend-dot" style="background:${palette[index % palette.length]}"></span><span>${escapeHtml(item.status)}</span><strong>${formatNumber(item.total)}</strong></div>`).join('')}</div>`;
}

function renderOwnerRanking(rows) {
  $('ownerRanking').innerHTML = rows.map((item, index) => `<div class="rank-row"><span class="rank-number">${index + 1}</span><div><strong>${escapeHtml(item.owner_name)}</strong><small>Responsável</small></div><b>${formatNumber(item.total)}</b></div>`).join('') || '<div class="empty-state"><span>Sem responsáveis carregados.</span></div>';
}

async function loadContactsOverview() {
  const { data } = await client.from('contacts_overview').select('*').maybeSingle();
  const o = data || {};
  $('contactStats').innerHTML = [
    ['◎', 'Contatos', o.total_contacts, 'Cadastrados', '#2056d8'],
    ['@', 'Com e-mail', o.with_email, 'E-mail disponível', '#16825d'],
    ['☎', 'Com telefone', o.with_phone, 'Telefone disponível', '#b96b0a'],
    ['◇', 'Sem empresa', o.without_company, 'Sem vínculo nominal', '#c43232']
  ].map(([icon, label, value, hint, color]) => metricCard(icon, label, value, hint, color)).join('');
}

function bindFilters() {
  ['companySearch', 'companyState', 'companyStatus', 'companyOwner', 'companyQuality', 'companyPageSize'].forEach((id) => {
    $(id).onchange = debounce(() => { state.companyPage = 0; loadCompanies(); }, 120);
  });
  $('companySearch').oninput = debounce(() => { state.companyPage = 0; loadCompanies(); }, 350);
  $('refreshCompanies').onclick = () => loadCompanies();
  $('companyPrev').onclick = () => { if (state.companyPage > 0) { state.companyPage -= 1; loadCompanies(); } };
  $('companyNext').onclick = () => { state.companyPage += 1; loadCompanies(); };
  $('exportCompanies').onclick = exportCompaniesPage;

  $('contactSearch').oninput = debounce(() => { state.contactPage = 0; loadContacts(); }, 350);
  $('contactStatus').onchange = () => { state.contactPage = 0; loadContacts(); };
  $('contactPageSize').onchange = () => { state.contactPage = 0; loadContacts(); };
  $('contactPrev').onclick = () => { if (state.contactPage > 0) { state.contactPage -= 1; loadContacts(); } };
  $('contactNext').onclick = () => { state.contactPage += 1; loadContacts(); };
  $('newContactBtn').onclick = () => openContactDialog();
  $('stateSearch').oninput = () => renderStates();
  $('openPasswordModal').onclick = () => $('passwordDialog').showModal();
  $('savePasswordBtn').onclick = savePassword;
  $('saveCompanyBtn').onclick = saveCompany;
  $('saveContactBtn').onclick = saveContact;
  $('addContactForCompany').onclick = () => openContactDialog(null, state.currentCompany);
}

function debounce(fn, wait) {
  let timeout;
  return (...args) => { clearTimeout(timeout); timeout = setTimeout(() => fn(...args), wait); };
}
