function companyQuery() {
  let query = client.from('leads').select('hubspot_id,company_name,contact_name,owner_name,phone,mobile_phone,other_phones,cnpj,city,state,state_code,hubspot_created_at,entered_lead_at,hubspot_updated_at,associated_contacts,lifecycle_status,lifecycle_stage,lead_status,custom_status,notes,priority,status_bucket,raw_data', { count: 'exact' });
  const term = clean($('companySearch').value).replace(/[,%()]/g, ' ');
  const uf = $('companyState').value;
  const status = $('companyStatus').value;
  const owner = $('companyOwner').value;
  const quality = $('companyQuality').value;
  if (term) query = query.or(`company_name.ilike.%${term}%,cnpj.ilike.%${term}%,phone.ilike.%${term}%,mobile_phone.ilike.%${term}%`);
  if (uf === 'SEM UF') query = query.is('state_code', null).is('state', null);
  else if (uf) query = query.eq('state_code', uf);
  if (status) query = query.eq('status_bucket', status);
  if (owner === 'Sem responsável') query = query.or('owner_name.is.null,owner_name.eq.');
  else if (owner) query = query.eq('owner_name', owner);
  if (quality === 'without_cnpj') query = query.or('cnpj.is.null,cnpj.eq.');
  if (quality === 'without_phone') query = query.or('phone.is.null,phone.eq.').or('mobile_phone.is.null,mobile_phone.eq.').or('other_phones.is.null,other_phones.eq.');
  if (quality === 'without_state') query = query.or('state_code.is.null,state_code.eq.').or('state.is.null,state.eq.');
  if (quality === 'with_contacts') query = query.gt('associated_contacts', 0);
  return query;
}

async function loadCompanies() {
  const size = Number($('companyPageSize').value || 50);
  const from = state.companyPage * size;
  const to = from + size - 1;
  $('companiesBody').innerHTML = skeletonRows(8, 9);
  const { data, count, error } = await companyQuery().order('company_name', { ascending: true }).range(from, to);
  if (error) {
    toast(error.message, 'error');
    $('companiesBody').innerHTML = '';
    return;
  }
  state.companyRows = data || [];
  state.companyTotal = count || 0;
  renderCompanies();
}

function renderCompanies() {
  const rows = state.companyRows;
  $('companiesBody').innerHTML = rows.map((row) => {
    const status = statusOf(row);
    const phone = clean(row.phone || row.mobile_phone || row.other_phones) || '—';
    const location = [clean(row.city), clean(row.state_code || row.state)].filter(Boolean).join(' / ') || '—';
    return `<tr>
      <td><div class="company-cell"><strong>${escapeHtml(row.company_name)}</strong><small>ID ${escapeHtml(row.hubspot_id)}</small></div></td>
      <td><span class="status-pill ${statusClass(status)}">${escapeHtml(status)}</span></td>
      <td>${escapeHtml(row.owner_name || 'Sem responsável')}</td>
      <td>${escapeHtml(phone)}</td>
      <td>${escapeHtml(row.cnpj || '—')}</td>
      <td>${escapeHtml(location)}</td>
      <td>${formatNumber(row.associated_contacts)}</td>
      <td><span class="priority p${Number(row.priority || 0)}">${priorityLabel(row.priority)}</span></td>
      <td><button class="row-action" data-company-id="${row.hubspot_id}">Abrir</button></td>
    </tr>`;
  }).join('');
  document.querySelectorAll('[data-company-id]').forEach((button) => button.onclick = () => openCompany(Number(button.dataset.companyId)));
  $('companiesEmpty').hidden = rows.length > 0;
  $('companyResultLabel').textContent = `${formatNumber(state.companyTotal)} empresas`;
  const size = Number($('companyPageSize').value || 50);
  const pages = Math.max(1, Math.ceil(state.companyTotal / size));
  $('companyPageLabel').textContent = rows.length ? `${state.companyPage * size + 1}–${state.companyPage * size + rows.length}` : '0 resultados';
  $('companyPagination').textContent = `Página ${state.companyPage + 1} de ${pages}`;
  $('companyPrev').disabled = state.companyPage === 0;
  $('companyNext').disabled = state.companyPage + 1 >= pages;
}

async function openCompany(hubspotId) {
  let company = state.companyRows.find((row) => Number(row.hubspot_id) === Number(hubspotId));
  if (!company) {
    const { data, error } = await client.from('leads').select('*').eq('hubspot_id', hubspotId).single();
    if (error) return toast(error.message, 'error');
    company = data;
  }
  state.currentCompany = company;
  $('companyDialogTitle').textContent = company.company_name || 'Empresa';
  $('editCompanyStatus').value = company.custom_status || '';
  $('editCompanyPriority').value = String(company.priority || 0);
  $('editCompanyNotes').value = company.notes || '';
  const status = statusOf(company);
  $('companyIdentity').innerHTML = `<h3>${escapeHtml(company.company_name)}</h3><p><span class="status-pill ${statusClass(status)}">${escapeHtml(status)}</span> · ${escapeHtml(company.cnpj || 'CNPJ não informado')} · ${escapeHtml([company.city, company.state_code || company.state].filter(Boolean).join(' / ') || 'Localização não informada')}</p>`;
  const detailRows = [
    ['Responsável', company.owner_name], ['Telefone', company.phone || company.mobile_phone || company.other_phones],
    ['Criada em', formatDate(company.hubspot_created_at)], ['Entrada como lead', formatDate(company.entered_lead_at)],
    ['Atualização HubSpot', formatDate(company.hubspot_updated_at)], ['Contatos informados', company.associated_contacts],
    ['HubSpot', `<a target="_blank" rel="noopener" href="${HUBSPOT_COMPANY}${company.hubspot_id}">Abrir registro</a>`]
  ];
  $('companyDetails').innerHTML = detailRows.map(([label, value]) => `<div class="detail-item"><span>${escapeHtml(label)}</span><strong>${label === 'HubSpot' ? value : escapeHtml(value || '—')}</strong></div>`).join('');
  await loadCompanyContacts(company.hubspot_id);
  $('companyDialog').showModal();
}

async function loadCompanyContacts(companyHubspotId) {
  $('companyContacts').innerHTML = '<div class="helper-text">Carregando contatos…</div>';
  const { data: links, error } = await client.from('company_contacts').select('contact_hubspot_id,is_primary').eq('company_hubspot_id', companyHubspotId);
  if (error) {
    $('companyContacts').innerHTML = '<div class="helper-text">Não foi possível consultar os vínculos.</div>';
    return;
  }
  if (!links?.length) {
    state.currentCompanyContacts = [];
    $('companyContacts').innerHTML = '<div class="helper-text">Nenhum contato individual vinculado. O snapshot original informa apenas a quantidade.</div>';
    return;
  }
  const ids = links.map((item) => item.contact_hubspot_id);
  const { data: contacts } = await client.from('contacts').select('*').in('hubspot_contact_id', ids);
  state.currentCompanyContacts = contacts || [];
  $('companyContacts').innerHTML = state.currentCompanyContacts.map((contact) => `<div class="contact-item"><span class="contact-avatar">${escapeHtml(initials(contact.full_name || `${contact.first_name || ''} ${contact.last_name || ''}`))}</span><div><strong>${escapeHtml(contact.full_name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Contato')}</strong><small>${escapeHtml(contact.email || contact.phone || contact.mobile_phone || 'Sem canal informado')}</small></div>${contact.hubspot_contact_id > 0 ? `<a class="row-action" target="_blank" rel="noopener" href="${HUBSPOT_CONTACT}${contact.hubspot_contact_id}">HubSpot</a>` : ''}</div>`).join('');
}

async function saveCompany() {
  if (!state.currentCompany) return;
  setBusy($('saveCompanyBtn'), true);
  const payload = {
    custom_status: $('editCompanyStatus').value || null,
    priority: Number($('editCompanyPriority').value || 0),
    notes: clean($('editCompanyNotes').value) || null,
    updated_at: new Date().toISOString()
  };
  const { error } = await client.from('leads').update(payload).eq('hubspot_id', state.currentCompany.hubspot_id);
  setBusy($('saveCompanyBtn'), false);
  if (error) return toast(error.message, 'error');
  Object.assign(state.currentCompany, payload);
  $('companyDialog').close();
  toast('Empresa atualizada.', 'success');
  await Promise.all([loadCompanies(), loadOverview(), loadReferenceData()]);
}
