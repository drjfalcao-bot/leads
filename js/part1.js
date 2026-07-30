const SUPABASE_URL = 'https://bednyrjjescarwbhsfwz.supabase.co';
const SUPABASE_KEY = 'sb_publishable__2b3v54XmPqN1dk8Gc787w_8mIq7k0w';
const ALLOWED_EMAIL = 'dr.jfalcao@gmail.com';
const HUBSPOT_COMPANY = 'https://app.hubspot.com/contacts/50778387/record/0-2/';
const HUBSPOT_CONTACT = 'https://app.hubspot.com/contacts/50778387/record/0-1/';
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = (id) => document.getElementById(id);

const state = {
  companyPage: 0,
  companyTotal: 0,
  companyRows: [],
  contactPage: 0,
  contactTotal: 0,
  contactRows: [],
  states: [],
  statuses: [],
  owners: [],
  currentCompany: null,
  currentCompanyContacts: [],
  currentView: 'overview'
};

const viewMeta = {
  overview: ['PAINEL COMERCIAL', 'Visão geral'],
  companies: ['BASE DE EMPRESAS', 'Empresas'],
  contacts: ['RELACIONAMENTOS', 'Contatos'],
  states: ['DISTRIBUIÇÃO GEOGRÁFICA', 'Estados'],
  settings: ['SISTEMA', 'Configurações']
};

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

const formatNumber = (value) => Number(value || 0).toLocaleString('pt-BR');
const formatDate = (value) => value ? new Date(value).toLocaleDateString('pt-BR') : '—';
const clean = (value) => String(value ?? '').trim();
const initials = (value) => clean(value).split(/\s+/).slice(0, 2).map((x) => x[0] || '').join('').toUpperCase() || '—';
const statusOf = (row) => clean(row.custom_status || row.lead_status || row.lifecycle_stage || row.lifecycle_status || row.status_bucket) || 'Sem status';
const statusClass = (status) => {
  const text = clean(status).toLowerCase();
  if (/cliente|qualific|ganho/.test(text)) return 'success';
  if (/proposta|contato|andamento/.test(text)) return 'warning';
  if (/descart|perd|sem interesse/.test(text)) return 'danger';
  if (/novo|lead/.test(text)) return 'primary';
  return 'neutral';
};
const priorityLabel = (value) => ({ 0: 'Normal', 1: 'Baixa', 2: 'Média', 3: 'Alta' }[Number(value)] || 'Normal');

let toastTimer;
function toast(message, type = '') {
  clearTimeout(toastTimer);
  const el = $('toast');
  el.textContent = message;
  el.className = `toast show ${type}`;
  toastTimer = setTimeout(() => { el.className = 'toast'; }, 3400);
}

function setBusy(button, busy, label = 'Salvando…') {
  if (!button) return;
  if (busy) {
    button.dataset.oldText = button.textContent;
    button.textContent = label;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.oldText || button.textContent;
    button.disabled = false;
  }
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('leads-theme', theme);
  const checked = theme === 'dark';
  $('settingsThemeToggle')?.setAttribute('aria-checked', String(checked));
}

function toggleTheme() {
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
}

applyTheme(localStorage.getItem('leads-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

async function applySession(session) {
  const email = clean(session?.user?.email).toLowerCase();
  if (session && email !== ALLOWED_EMAIL) {
    await client.auth.signOut();
    $('authMessage').textContent = 'E-mail não autorizado.';
    return;
  }
  $('authView').hidden = Boolean(session);
  $('appView').hidden = !session;
  if (session) {
    await bootstrap();
  }
}
