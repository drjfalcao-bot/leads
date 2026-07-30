function contactsQuery() {
  let query = client.from('contacts').select('*', { count: 'exact' });
  const term = clean($('contactSearch').value).replace(/[,%()]/g, ' ');
  const status = $('contactStatus').value;
  if (term) query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,mobile_phone.ilike.%${term}%,company_name.ilike.%${term}%`);
  if (status) query = query.eq('custom_status', status);
  return query;
}

async function loadContacts() {
  const size = Number($('contactPageSize').value || 50);
  const from = state.contactPage * size;
  const to = from + size - 1;
  $('contactsBody').innerHTML = skeletonRows(7, 7);
  const { data, count, error } = await contactsQuery().order('full_name', { ascending: true, nullsFirst: false }).range(from, to);
  if (error) {
    toast(error.message, 'error');
    $('contactsBody').innerHTML = '';
    return;
  }
  state.contactRows = data || [];
  state.contactTotal = count || 0;
  renderContacts();
}

function renderContacts() {
  $('contactsBody').innerHTML = state.contactRows.map((row) => {
    const fullName = clean(row.full_name || `${row.first_name || ''} ${row.last_name || ''}`) || 'Contato sem nome';
    const phone = clean(row.mobile_phone || row.whatsapp_phone || row.phone) || '—';
    return `<tr><td><div class="company-cell"><strong>${escapeHtml(fullName)}</strong><small>ID ${escapeHtml(row.hubspot_contact_id)}</small></div></td><td>${escapeHtml(row.company_name || '—')}</td><td>${escapeHtml(row.email || '—')}</td><td>${escapeHtml(phone)}</td><td>${escapeHtml(row.job_title || '—')}</td><td><span class="status-pill ${statusClass(row.custom_status)}">${escapeHtml(row.custom_status || 'Sem status')}</span></td><td><button class="row-action" data-contact-id="${row.id}">Editar</button></td></tr>`;
  }).join('');
  document.querySelectorAll('[data-contact-id]').forEach((button) => button.onclick = () => openContactDialog(state.contactRows.find((row) => Number(row.id) === Number(button.dataset.contactId))));
  $('contactsEmpty').hidden = state.contactRows.length > 0;
  const size = Number($('contactPageSize').value || 50);
  const pages = Math.max(1, Math.ceil(state.contactTotal / size));
  $('contactResultLabel').textContent = `${formatNumber(state.contactTotal)} contatos`;
  $('contactPageLabel').textContent = state.contactRows.length ? `${state.contactPage * size + 1}–${state.contactPage * size + state.contactRows.length}` : '0 resultados';
  $('contactPagination').textContent = `Página ${state.contactPage + 1} de ${pages}`;
  $('contactPrev').disabled = state.contactPage === 0;
  $('contactNext').disabled = state.contactPage + 1 >= pages;
}

function openContactDialog(contact = null, company = null) {
  $('contactDialogTitle').textContent = contact ? 'Editar contato' : company ? `Contato de ${company.company_name}` : 'Novo contato';
  $('contactId').value = contact?.id || '';
  $('contactFirstName').value = contact?.first_name || '';
  $('contactLastName').value = contact?.last_name || '';
  $('contactEmail').value = contact?.email || '';
  $('contactPhone').value = contact?.phone || '';
  $('contactMobile').value = contact?.mobile_phone || contact?.whatsapp_phone || '';
  $('contactJob').value = contact?.job_title || '';
  $('contactCompany').value = company?.company_name || contact?.company_name || '';
  $('contactCustomStatus').value = contact?.custom_status || '';
  $('contactNotes').value = contact?.notes || '';
  $('contactDialog').dataset.companyHubspotId = company?.hubspot_id || '';
  $('contactDialog').showModal();
}

async function saveContact() {
  const firstName = clean($('contactFirstName').value);
  if (!firstName) return toast('Informe o nome do contato.', 'error');
  setBusy($('saveContactBtn'), true);
  const id = $('contactId').value;
  const fullName = clean(`${firstName} ${$('contactLastName').value}`);
  const payload = {
    first_name: firstName,
    last_name: clean($('contactLastName').value) || null,
    full_name: fullName,
    email: clean($('contactEmail').value) || null,
    phone: clean($('contactPhone').value) || null,
    mobile_phone: clean($('contactMobile').value) || null,
    whatsapp_phone: clean($('contactMobile').value) || null,
    job_title: clean($('contactJob').value) || null,
    company_name: clean($('contactCompany').value) || null,
    custom_status: $('contactCustomStatus').value || null,
    notes: clean($('contactNotes').value) || null,
    updated_at: new Date().toISOString()
  };
  let saved;
  let error;
  if (id) {
    ({ data: saved, error } = await client.from('contacts').update(payload).eq('id', id).select().single());
  } else {
    const localHubspotId = -Date.now();
    ({ data: saved, error } = await client.from('contacts').insert({ ...payload, hubspot_contact_id: localHubspotId, source: 'manual' }).select().single());
  }
  if (!error && saved && $('contactDialog').dataset.companyHubspotId) {
    const companyId = Number($('contactDialog').dataset.companyHubspotId);
    const linkResult = await client.from('company_contacts').upsert({ company_hubspot_id: companyId, contact_hubspot_id: saved.hubspot_contact_id, is_primary: false }, { onConflict: 'company_hubspot_id,contact_hubspot_id' });
    error = linkResult.error;
  }
  setBusy($('saveContactBtn'), false);
  if (error) return toast(error.message, 'error');
  $('contactDialog').close();
  toast('Contato salvo.', 'success');
  await Promise.all([loadContacts(), loadContactsOverview()]);
  if (state.currentCompany) await loadCompanyContacts(state.currentCompany.hubspot_id);
}
