(function () {
  const app = document.getElementById('live-roll30');
  if (!app) return;
  const db = window.Roll30Backend;
  let campaignId = localStorage.getItem('roll30.campaignId');
  let session;
  let campaign;

  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const query = (table) => db.client.from(table).select('*').eq('campaign_id', campaignId).order('created_at', { ascending:false });
  const notice = (message, error = false) => { const el = document.getElementById('live-notice'); if (el) { el.textContent = message; el.className = error ? 'error' : ''; } };

  async function load() {
    session = await db.getSession();
    if (!session || !campaignId) { window.location.replace('./index.html'); return; }
    const { data, error } = await db.client.from('campaigns').select('*').eq('id', campaignId).single();
    if (error) { localStorage.removeItem('roll30.campaignId'); window.location.replace('./index.html'); return; }
    campaign = data;
    render();
  }

  async function content(view) {
    if (view === 'scenes') {
      const { data = [] } = await query('scenes');
      return `<section><div class="live-title"><h2>Scenes</h2><button data-dialog="scene">New scene</button></div>${cards(data, s => `<b>${esc(s.name)}</b><small>${esc(s.scene_type)} · ${esc(s.folder)}</small>`)}</section>`;
    }
    if (view === 'characters') {
      const { data = [] } = await query('characters');
      return `<section><div class="live-title"><h2>Characters</h2><button data-dialog="character">New character</button></div>${cards(data, c => `<b>${esc(c.name)}</b><small>${esc(c.kind)} · ${c.hp_current ?? '—'} / ${c.hp_max ?? '—'} HP</small><div class="hp-actions"><button data-hp="-1" data-character="${c.id}">− HP</button><button data-hp="1" data-character="${c.id}">+ HP</button></div>`)}</section>`;
    }
    if (view === 'messages') {
      const { data = [] } = await query('messages');
      return `<section><div class="live-title"><h2>Table messages</h2></div><form id="message-form" class="live-form"><input id="message-text" placeholder="Say something to the table" required><button>Send</button></form>${cards(data, m => `<b>${esc(m.kind)}</b><small>${esc(m.body && m.body.text || '')}</small>`)}</section>`;
    }
    if (view === 'session') {
      const { data = [] } = await query('sessions');
      const active = data.find(s => s.status === 'active');
      if (!active) return `<section><div class="live-title"><h2>Live session</h2><button id="start-session">Start session</button></div><p>No session is running. Start one when the GM is ready.</p></section>`;
      const { data: characters = [] } = await query('characters');
      const state = active.state || { tokens:[] };
      const tokenByCharacter = new Set((state.tokens || []).map(t => t.character_id));
      const board = (state.tokens || []).map(t => `<button class="map-token" data-token="${t.id}" style="left:${t.x}%;top:${t.y}%" title="${esc(t.name)}">${esc(t.name.slice(0,2).toUpperCase())}</button>`).join('');
      const available = characters.filter(c => !tokenByCharacter.has(c.id));
      return `<section><div class="live-title"><h2>Live session</h2><button id="end-session">End session</button></div><p>Round ${active.round}. Select a token, then click the board to move it. Movement is synchronized to the table.</p><div class="session-board" id="session-board">${board || '<span class="board-empty">Add a character to begin.</span>'}</div><div class="token-tray">${available.map(c => `<button data-add-token="${c.id}" data-token-name="${esc(c.name)}">Add ${esc(c.name)}</button>`).join('')}</div><div class="session-controls"><button id="advance-turn">Advance turn</button><button id="save-snapshot">Save snapshot</button></div></section>`;
    }
    if (view === 'prompts') {
      const { data = [] } = await query('prompts');
      return `<section><div class="live-title"><h2>Player prompts</h2><button data-dialog="prompt">New prompt</button></div>${cards(data, p => `<b>${esc(p.title)}</b><small>${esc(p.body || '')} · ${esc(p.status)}</small><form class="prompt-response" data-prompt="${p.id}"><input placeholder="Your response" required><button>Respond</button></form>`)}</section>`;
    }
    if (view === 'shops') {
      const [{ data: shops = [] }, { data: items = [] }, { data: characters = [] }] = await Promise.all([query('shops'),query('items'),query('characters')]);
      const stockResult = await db.client.from('shop_stock').select('*, items(name), shops!inner(campaign_id)').eq('shops.campaign_id',campaignId);
      const stock = stockResult.data || [];
      return `<section><div class="live-title"><h2>Shops</h2><button data-dialog="shop">New shop</button></div>${shops.length ? shops.map(s => `<article><b>${esc(s.name)}</b><small>${esc(s.settings?.mode || 'approval')} purchases</small><form class="stock-form" data-shop="${s.id}"><select>${items.map(i => `<option value="${i.id}">${esc(i.name)}</option>`).join('')}</select><input type="number" min="0" value="1" placeholder="Price"><button>Stock item</button></form>${stock.filter(x=>x.shop_id===s.id).map(x=>`<div class="stock-row">${esc(x.items?.name)} · ${x.price} gp ${x.quantity === null ? '' : `(${x.quantity})`}<form class="buy-form" data-shop="${s.id}" data-item="${x.item_id}"><select>${characters.filter(c=>c.kind==='pc').map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select><button>Request buy</button></form></div>`).join('') || '<small>No stock yet.</small>'}</article>`).join('') : '<p class="muted">Create a shop to add stock.</p>'}</section>`;
    }
    if (view === 'items') {
      const { data = [] } = await query('items');
      return `<section><div class="live-title"><h2>Items</h2><button data-dialog="item">New item</button></div>${cards(data, i => `<b>${esc(i.name)}</b><small>${esc(i.item_data?.type || 'Custom item')}</small>`)}</section>`;
    }
    if (view === 'compendium') {
      const [monsters, spells] = await Promise.all([
        fetch('./DND%205E%20Data/5e-SRD-Monsters.json').then(r => r.json()),
        fetch('./DND%205E%20Data/5e-SRD-Spells.json').then(r => r.json()),
      ]);
      return `<section><h2>5e compendium</h2><p class="muted">Bundled SRD reference data. Add a copy to your campaign when you need to customise it.</p><div class="live-title"><h3>Monsters (${monsters.length})</h3></div>${cards(monsters.slice(0,24), m => `<b>${esc(m.name)}</b><small>CR ${esc(m.challenge_rating)} · AC ${esc(Array.isArray(m.armor_class) ? m.armor_class[0]?.value : m.armor_class)} · ${esc(m.hit_points)} HP</small><button data-import-monster="${esc(m.name)}">Add to campaign</button>`)}</section>`;
    }
    if (view === 'media') {
      const { data = [] } = await query('campaign_assets');
      return `<section><div class="live-title"><h2>Campaign media</h2></div><form id="upload-media" class="live-form"><input id="media-file" type="file" accept="image/*,audio/*,.pdf" required><button>Upload</button></form>${cards(data, a => `<b>${esc(a.label || a.storage_path.split('/').pop())}</b><small>${esc(a.kind)} · uploaded ${new Date(a.created_at).toLocaleDateString()}</small>`)}</section>`;
    }
    const [sceneRes, charRes, sessionRes] = await Promise.all([query('scenes'), query('characters'), query('sessions')]);
    return `<section><h2>${esc(campaign.name)}</h2><p class="muted">${esc(campaign.system)} · Join code <strong>${esc(campaign.join_code)}</strong></p><div class="live-stats"><div><b>${sceneRes.data?.length || 0}</b><small>scenes</small></div><div><b>${charRes.data?.length || 0}</b><small>characters</small></div><div><b>${sessionRes.data?.filter(s => s.status === 'active').length || 0}</b><small>live sessions</small></div></div><p>Start by creating a scene or a character. Everything here belongs to this campaign and is shared with its members.</p></section>`;
  }
  function cards(rows, renderCard) { return rows.length ? `<div class="live-cards">${rows.map(r => `<article>${renderCard(r)}</article>`).join('')}</div>` : '<p class="muted">Nothing here yet.</p>'; }
  async function render(view = 'overview') {
    app.innerHTML = `<header><div><strong>Roll30</strong><span>${esc(campaign.name)}</span></div><button id="leave-campaign">Campaigns</button></header><nav>${['overview','scenes','characters','items','compendium','media','shops','prompts','session','messages'].map(v => `<button data-view="${v}" class="${v === view ? 'active' : ''}">${v}</button>`).join('')}</nav><main><p id="live-notice"></p><div id="live-content">Loading…</div></main><dialog id="live-dialog"></dialog>`;
    document.getElementById('live-content').innerHTML = await content(view);
    bind(view);
  }
  function bind(view) {
    app.querySelectorAll('[data-view]').forEach(b => b.onclick = () => render(b.dataset.view));
    document.getElementById('leave-campaign').onclick = () => { localStorage.removeItem('roll30.campaignId'); window.location.replace('./index.html'); };
    app.querySelectorAll('[data-dialog]').forEach(b => b.onclick = () => openDialog(b.dataset.dialog));
    app.querySelectorAll('[data-hp]').forEach(b => b.onclick = async () => { const { error } = await db.client.rpc('change_roll30_hp', { target_character:b.dataset.character, delta:Number(b.dataset.hp) }); if (error) notice(error.message, true); else render('characters'); });
    app.querySelectorAll('[data-import-monster]').forEach(b => b.onclick = async () => { const response = await fetch('./DND%205E%20Data/5e-SRD-Monsters.json'); const monsters = await response.json(); const monster = monsters.find(m => m.name === b.dataset.importMonster); if (!monster) return; const { error } = await db.client.from('characters').insert({ campaign_id:campaignId,name:monster.name,kind:'monster',hp_current:monster.hit_points,hp_max:monster.hit_points,sheet:monster }); if (error) notice(error.message, true); else { notice(monster.name + ' added to this campaign.'); render('characters'); } });
    const messageForm = document.getElementById('message-form');
    if (messageForm) messageForm.onsubmit = async e => { e.preventDefault(); const text = document.getElementById('message-text').value.trim(); if (!text) return; const { error } = await db.client.from('messages').insert({ campaign_id:campaignId, sender_id:session.user.id, kind:'message', body:{ text } }); if (error) return notice(error.message, true); render('messages'); };
    const mediaForm = document.getElementById('upload-media');
    if (mediaForm) mediaForm.onsubmit = async e => { e.preventDefault(); const file = document.getElementById('media-file').files[0]; if (!file) return; const path = `${campaignId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`; notice('Uploading media…'); const { error: uploadError } = await db.client.storage.from('campaign-media').upload(path, file); if (uploadError) return notice(uploadError.message, true); const kind = file.type.startsWith('audio/') ? 'audio' : file.type === 'application/pdf' ? 'handout' : 'image'; const { error } = await db.client.from('campaign_assets').insert({ campaign_id:campaignId, uploaded_by:session.user.id, kind, storage_path:path, label:file.name }); if (error) return notice(error.message, true); render('media'); };
    app.querySelectorAll('.prompt-response').forEach(form => form.onsubmit = async e => { e.preventDefault(); const text = form.querySelector('input').value.trim(); const { error } = await db.client.from('prompt_responses').upsert({ prompt_id:form.dataset.prompt, user_id:session.user.id, response:{ text } }); if (error) notice(error.message, true); else notice('Response sent to the GM.'); });
    app.querySelectorAll('.stock-form').forEach(form => form.onsubmit = async e => { e.preventDefault(); const item_id = form.querySelector('select').value; const price = Number(form.querySelector('input').value); const { error } = await db.client.from('shop_stock').upsert({ shop_id:form.dataset.shop,item_id,price,quantity:null }); if (error) notice(error.message,true); else render('shops'); });
    app.querySelectorAll('.buy-form').forEach(form => form.onsubmit = async e => { e.preventDefault(); const character_id=form.querySelector('select').value; const { error } = await db.client.from('purchase_requests').insert({shop_id:form.dataset.shop,item_id:form.dataset.item,character_id,quantity:1,requested_by:session.user.id}); if(error)notice(error.message,true);else notice('Purchase request sent to the GM.'); });
    const start = document.getElementById('start-session');
    if (start) start.onclick = async () => { const { data: sessions } = await query('sessions'); let active = sessions.find(s => s.status === 'active'); if (!active) { const result = await db.client.from('sessions').insert({ campaign_id:campaignId }).select().single(); if (result.error) return notice(result.error.message, true); active = result.data; } localStorage.setItem('roll30.sessionId', active.id); render('session'); };
    const advance = document.getElementById('advance-turn');
    if (advance) advance.onclick = async () => { const id = localStorage.getItem('roll30.sessionId'); if (!id) return; const { error } = await db.client.rpc('advance_roll30_turn', { target_session:id }); if (error) notice(error.message, true); else notice('Turn advanced for everyone at the table.'); };
    const end = document.getElementById('end-session');
    if (end) end.onclick = async () => { const id = localStorage.getItem('roll30.sessionId'); const { error } = await db.client.from('sessions').update({ status:'ended' }).eq('id', id); if (error) notice(error.message, true); else { localStorage.removeItem('roll30.sessionId'); render('session'); } };
    const snapshot = document.getElementById('save-snapshot');
    if (snapshot) snapshot.onclick = async () => { const id = localStorage.getItem('roll30.sessionId'); const { error } = await db.client.rpc('snapshot_roll30_session', { target_session:id, snapshot_label:'Manual snapshot' }); if (error) notice(error.message, true); else notice('Snapshot saved.'); };
    app.querySelectorAll('[data-add-token]').forEach(b => b.onclick = async () => {
      const id = localStorage.getItem('roll30.sessionId'); const { data: current, error: getError } = await db.client.from('sessions').select('*').eq('id', id).single();
      if (getError) return notice(getError.message, true);
      const state = current.state || {}; const tokens = [...(state.tokens || []), { id:crypto.randomUUID(), character_id:b.dataset.addToken, name:b.dataset.tokenName, x:50, y:50 }];
      const { error } = await db.client.from('sessions').update({ state:{...state,tokens} }).eq('id', id); if (error) notice(error.message, true); else render('session');
    });
    let selectedToken = null;
    app.querySelectorAll('[data-token]').forEach(b => b.onclick = () => { selectedToken = b.dataset.token; app.querySelectorAll('[data-token]').forEach(x => x.classList.toggle('selected', x.dataset.token === selectedToken)); });
    const board = document.getElementById('session-board');
    if (board) board.onclick = async event => {
      if (!selectedToken || event.target !== board) return;
      const id = localStorage.getItem('roll30.sessionId'); const rect = board.getBoundingClientRect(); const x = Math.max(2, Math.min(98, Math.round((event.clientX - rect.left) / rect.width * 100))); const y = Math.max(2, Math.min(98, Math.round((event.clientY - rect.top) / rect.height * 100)));
      const { error } = await db.client.rpc('move_roll30_token', { target_session:id, target_token:selectedToken, target_x:x, target_y:y }); if (error) notice(error.message, true); else render('session');
    };
  }
  function openDialog(kind) {
    const dialog = document.getElementById('live-dialog');
    dialog.innerHTML = kind === 'scene'
      ? `<form method="dialog" id="create-record"><h3>New scene</h3><input id="record-name" placeholder="Scene name" required><select id="record-type"><option value="playing">Playing Field</option><option value="battle">Battle Field</option></select><button>Create scene</button></form>`
        : kind === 'prompt'
        ? `<form method="dialog" id="create-record"><h3>New prompt</h3><input id="record-name" placeholder="Prompt title" required><input id="record-body" placeholder="Question or instructions"><button>Send prompt</button></form>`
        : kind === 'shop'
          ? `<form method="dialog" id="create-record"><h3>New shop</h3><input id="record-name" placeholder="Shop name" required><button>Create shop</button></form>`
          : kind === 'item'
            ? `<form method="dialog" id="create-record"><h3>New item</h3><input id="record-name" placeholder="Item name" required><input id="record-body" placeholder="Item type or description"><button>Create item</button></form>`
          : `<form method="dialog" id="create-record"><h3>New character</h3><input id="record-name" placeholder="Character name" required><select id="record-type"><option value="pc">Player character</option><option value="npc">NPC</option><option value="monster">Monster</option></select><button>Create character</button></form>`;
    dialog.showModal();
    dialog.querySelector('#create-record').onsubmit = async e => { e.preventDefault(); const name = dialog.querySelector('#record-name').value.trim(); const type = dialog.querySelector('#record-type')?.value; const body = dialog.querySelector('#record-body')?.value; const table = kind === 'scene' ? 'scenes' : kind === 'prompt' ? 'prompts' : kind === 'shop' ? 'shops' : kind === 'item' ? 'items' : 'characters'; const row = kind === 'scene' ? {campaign_id:campaignId,name,scene_type:type,created_by:session.user.id} : kind === 'prompt' ? {campaign_id:campaignId,created_by:session.user.id,title:name,body} : kind === 'shop' ? {campaign_id:campaignId,name} : kind === 'item' ? {campaign_id:campaignId,name,item_data:{type:body || 'Custom item'}} : {campaign_id:campaignId,name,kind:type,owner_id:type === 'pc' ? session.user.id : null,hp_current:10,hp_max:10}; const { error } = await db.client.from(table).insert(row); if (error) notice(error.message, true); dialog.close(); render(kind === 'scene' ? 'scenes' : kind === 'prompt' ? 'prompts' : kind === 'shop' ? 'shops' : kind === 'item' ? 'items' : 'characters'); };
  }
  db.client.channel('roll30-live').on('postgres_changes',{event:'*',schema:'public',table:'sessions',filter:`campaign_id=eq.${campaignId}`},() => notice('Live session updated.')).on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:`campaign_id=eq.${campaignId}`},() => notice('New table message.')).subscribe();
  document.addEventListener('DOMContentLoaded', () => { document.querySelector('x-dc')?.remove(); app.style.display = 'block'; load().catch(error => { app.innerHTML = `<main><h2>Roll30 could not load</h2><p>${esc(error.message)}</p></main>`; }); });
})();
