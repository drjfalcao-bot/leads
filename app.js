const SUPABASE_URL='https://bednyrjjescarwbhsfwz.supabase.co';
const SUPABASE_KEY='sb_publishable__2b3v54XmPqN1dk8Gc787w_8mIq7k0w';
const ALLOWED_EMAIL='dr.jfalcao@gmail.com';
const client=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id);
const hubspotBase='https://app.hubspot.com/contacts/50778387/record/0-2/';
let page=0,total=0;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=v=>v?new Date(v).toLocaleDateString('pt-BR'):'—';
const statusOf=r=>r.lead_status||r.lifecycle_stage||r.lifecycle_status||'Sem status';

async function applySession(session){
  const email=(session?.user?.email||'').toLowerCase();
  if(session&&email!==ALLOWED_EMAIL){await client.auth.signOut();$('authMessage').textContent='E-mail não autorizado.';return;}
  $('authView').hidden=!!session;$('appView').hidden=!session;
  if(session){await Promise.all([loadStates(),loadStatuses()]);await loadLeads();}
}
client.auth.getSession().then(({data})=>applySession(data.session));
client.auth.onAuthStateChange((_e,s)=>applySession(s));

$('loginForm').addEventListener('submit',async e=>{
  e.preventDefault();$('authMessage').textContent='';
  const email=$('email').value.trim().toLowerCase();
  if(email!==ALLOWED_EMAIL){$('authMessage').textContent='E-mail não autorizado.';return;}
  const {error}=await client.auth.signInWithPassword({email,password:$('password').value});
  if(error)$('authMessage').textContent=error.message;
});
$('logoutBtn').onclick=()=>client.auth.signOut();

async function loadStates(){
  const {data}=await client.from('leads').select('state_code').not('state_code','is',null).limit(5000);
  const items=[...new Set((data||[]).map(x=>x.state_code).filter(Boolean))].sort();
  $('stateFilter').innerHTML='<option value="">Todos os estados</option>'+items.map(x=>`<option>${esc(x)}</option>`).join('');
}

async function loadStatuses(){
  const {data}=await client.from('leads_by_status').select('*');
  const rows=data||[];
  $('statusFilter').innerHTML='<option value="">Todos os status</option>'+rows.map(r=>`<option value="${esc(r.status)}">${esc(r.status)}</option>`).join('');
  $('statusCards').innerHTML=rows.slice(0,12).map(r=>`<article data-status="${esc(r.status)}"><span>${esc(r.status)}</span><strong>${Number(r.total).toLocaleString('pt-BR')}</strong></article>`).join('');
  document.querySelectorAll('#statusCards article').forEach(card=>card.onclick=()=>{$('statusFilter').value=card.dataset.status;page=0;loadLeads();});
}

function queryBase(){
  let q=client.from('leads').select('*',{count:'exact'});
  const term=$('searchInput').value.trim();
  const status=$('statusFilter').value;
  const state=$('stateFilter').value;
  const owner=$('ownerFilter').value.trim();
  const start=$('startDate').value,end=$('endDate').value;
  if(term)q=q.or(`company_name.ilike.%${term}%,cnpj.ilike.%${term}%,phone.ilike.%${term}%,mobile_phone.ilike.%${term}%`);
  if(status==='Sem status')q=q.is('lead_status',null).is('lifecycle_stage',null).is('lifecycle_status',null);
  else if(status)q=q.or(`lead_status.eq.${status},lifecycle_stage.eq.${status},lifecycle_status.eq.${status}`);
  if(state)q=q.eq('state_code',state);
  if(owner)q=q.ilike('owner_name',`%${owner}%`);
  if(start)q=q.gte('entered_lead_at',`${start}T00:00:00`);
  if(end)q=q.lte('entered_lead_at',`${end}T23:59:59`);
  return q;
}

async function loadLeads(){
  const size=Number($('pageSize').value),from=page*size,to=from+size-1;
  const {data,count,error}=await queryBase().order('entered_lead_at',{ascending:false,nullsFirst:false}).range(from,to);
  if(error){$('emptyState').hidden=false;$('emptyState').textContent=error.message;return;}
  total=count||0;
  $('leadsBody').innerHTML=(data||[]).map(r=>`<tr>
    <td><strong>${esc(r.company_name)}</strong></td><td>${esc(statusOf(r))}</td><td>${esc(r.contact_name||'—')}</td>
    <td>${esc(r.owner_name||'—')}</td><td>${esc(r.phone||r.mobile_phone||r.other_phones||'—')}</td>
    <td>${esc(r.cnpj||'—')}</td><td>${esc([r.city,r.state_code||r.state].filter(Boolean).join(' / ')||'—')}</td>
    <td>${date(r.entered_lead_at||r.hubspot_created_at)}</td><td><a class="hubspot-link" target="_blank" rel="noopener" href="${hubspotBase}${encodeURIComponent(r.hubspot_id)}">Abrir</a></td>
  </tr>`).join('');
  $('emptyState').hidden=(data||[]).length>0;
  const pages=Math.max(1,Math.ceil(total/size));
  $('paginationInfo').textContent=`Página ${page+1} de ${pages} — ${total.toLocaleString('pt-BR')} registros`;
  $('prevPage').disabled=page===0;$('nextPage').disabled=page+1>=pages;
}

$('applyFilters').onclick=()=>{page=0;loadLeads();};
$('clearFilters').onclick=()=>{['searchInput','ownerFilter','startDate','endDate'].forEach(id=>$(id).value='');$('statusFilter').value='';$('stateFilter').value='';page=0;loadLeads();};
$('pageSize').onchange=()=>{page=0;loadLeads();};
$('prevPage').onclick=()=>{if(page>0){page--;loadLeads();}};
$('nextPage').onclick=()=>{page++;loadLeads();};
