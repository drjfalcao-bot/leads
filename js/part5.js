function renderStates() {
  const term = clean($('stateSearch').value).toUpperCase();
  const rows = state.states.filter((item) => !term || String(item.state_code).toUpperCase().includes(term));
  const max = Math.max(1, ...state.states.map((item) => Number(item.total)));
  $('stateCards').innerHTML = rows.map((item) => `<article class="state-card" data-state="${escapeHtml(item.state_code)}"><div class="state-card-head"><span class="state-code">${escapeHtml(item.state_code)}</span><span class="status-pill neutral">${formatNumber(item.with_contacts)} com contato</span></div><strong>${formatNumber(item.total)}</strong><p>empresas na carteira</p><div class="state-progress"><span style="width:${Math.max(2, Number(item.total) / max * 100)}%"></span></div></article>`).join('');
  document.querySelectorAll('[data-state]').forEach((card) => card.onclick = () => {
    $('companyState').value = card.dataset.state;
    state.companyPage = 0;
    navigate('companies');
  });
}

async function savePassword() {
  const password = $('newPassword').value;
  const confirmation = $('confirmPassword').value;
  if (password.length < 10) return toast('A senha precisa ter ao menos 10 caracteres.', 'error');
  if (password !== confirmation) return toast('As senhas não coincidem.', 'error');
  setBusy($('savePasswordBtn'), true);
  const { error } = await client.auth.updateUser({ password });
  setBusy($('savePasswordBtn'), false);
  if (error) return toast(error.message, 'error');
  $('passwordDialog').close();
  $('newPassword').value = '';
  $('confirmPassword').value = '';
  toast('Senha alterada.', 'success');
}

function exportCompaniesPage() {
  if (!state.companyRows.length) return toast('Não há dados nesta página para exportar.', 'error');
  const headers = ['HubSpot ID', 'Empresa', 'Status', 'Responsável', 'Telefone', 'CNPJ', 'Cidade', 'UF', 'Contatos', 'Prioridade'];
  const lines = state.companyRows.map((row) => [row.hubspot_id, row.company_name, statusOf(row), row.owner_name, row.phone || row.mobile_phone || row.other_phones, row.cnpj, row.city, row.state_code || row.state, row.associated_contacts, priorityLabel(row.priority)]);
  const csv = [headers, ...lines].map((line) => line.map(csvCell).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `empresas-pagina-${state.companyPage + 1}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value ?? '').replace(/"/g, '""');
  return `"${text}"`;
}

function skeletonRows(rows, cols) {
  return Array.from({ length: rows }, () => `<tr>${Array.from({ length: cols }, () => '<td><span style="display:block;width:80%;height:12px;border-radius:6px;background:var(--surface-3)"></span></td>').join('')}</tr>`).join('');
}
