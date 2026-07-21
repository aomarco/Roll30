import { addDialogActions, cards as renderCards, errorPanel, escapeHtml, shell } from './roll30/ui.js';
import { ensurePrivateAccess } from './roll30/gate.js';
import { bindCompendium, compendiumView } from './roll30/compendium.js';

(function () {
  const app = document.getElementById('live-roll30');
  if (!app) return;
  const db = window.Roll30Backend;
  let campaignId = localStorage.getItem('roll30.campaignId');
  let session;
  let campaign;
  let currentRole;
  let currentCharacterId;
  let currentView = 'overview';
  let onlineCount = 0;
  let realtimeStarted = false;

  const esc = escapeHtml;
  const query = (table) => db.client.from(table).select('*').eq('campaign_id', campaignId).order('created_at', { ascending:false });
  const notice = (message, error = false) => { const el = document.getElementById('live-notice'); if (el) { el.textContent = message; el.className = error ? 'error' : ''; } };
  const showModal = dialog => { addDialogActions(dialog); dialog.showModal(); };
  const abilityModifier = score => Math.floor((Number(score || 10) - 10) / 2);

  async function load() {
    session = await db.getSession();
    if (!session || !campaignId) { window.location.replace('./index.html'); return; }
    const { data, error } = await db.client.from('campaigns').select('*').eq('id', campaignId).single();
    if (error) { localStorage.removeItem('roll30.campaignId'); window.location.replace('./index.html'); return; }
    campaign = data;
    const { data: membership } = await db.client.from('campaign_members').select('role,character_id').eq('campaign_id', campaignId).eq('user_id', session.user.id).single();
    currentRole = membership?.role;
    currentCharacterId = membership?.character_id;
    startRealtime();
    render();
  }

  async function content(view) {
    if (view === 'scenes') {
      const controls = currentRole === 'gm';
      const [{ data = [] }, trashResult] = await Promise.all([
        query('scenes').is('deleted_at', null),
        controls ? db.client.rpc('list_roll30_trashed_scenes',{target_campaign:campaignId}) : Promise.resolve({data:[]})
      ]);
      if (trashResult.error) throw trashResult.error;
      const trashed = trashResult.data || [];
      const trashSection = controls && trashed.length ? `<h3>Trash</h3>${cards(trashed, scene => `<b>${esc(scene.name)}</b><small>${esc(scene.scene_type)}${scene.folder ? ` · ${esc(scene.folder)}` : ''}</small><div class="hp-actions"><button data-restore-scene="${scene.id}">Restore</button><button data-delete-scene-permanently="${scene.id}">Delete permanently</button></div>`)}` : '';
      return `<section><div class="live-title"><div><h2>Scenes</h2><p class="muted">Prepare locations, organise them into folders, and run one at the live table.</p></div>${controls ? '<button data-dialog="scene">New scene</button>' : ''}</div>${cards(data, s => `<b>${esc(s.name)}</b><small>${esc(s.scene_type)}${s.folder ? ` · ${esc(s.folder)}` : ''}</small>${controls ? `<div class="hp-actions"><button data-run-scene="${s.id}">Run scene</button><button data-scene-config="${s.id}">Configure</button><button data-duplicate-scene="${s.id}">Duplicate</button><button data-save-template="${s.id}" data-scene-name="${esc(s.name)}">Save template</button><button data-trash-scene="${s.id}">Move to trash</button></div>` : ''}`)}${trashSection}</section>`;
    }
    if (view === 'characters') {
      const { data = [] } = await query('characters');
      const canEdit = c => currentRole === 'gm' || c.owner_id === session.user.id;
      return `<section><div class="live-title"><div><h2>Characters</h2><p class="muted">Versioned 5e sheets, ownership, resources, and campaign-ready NPCs.</p></div><button data-dialog="character">New character</button></div>${cards(data, c => { const abilities=c.sheet?.abilities || {}; const attack=c.sheet?.attacks?.[0] || c.sheet?.attack; return `<b>${esc(c.name)}</b><small>${esc(c.kind)} · ${c.hp_current ?? '—'} / ${c.hp_max ?? '—'} HP · AC ${esc(c.sheet?.armor_class ?? '—')}${c.sheet?.class ? ` · ${esc(c.sheet.class)} ${esc(c.sheet.level || '')}` : ''}${c.sheet?.conditions?.length ? ` · ${esc(c.sheet.conditions.join(', '))}` : ''}</small>${Object.keys(abilities).length ? `<div class="ability-strip">${['str','dex','con','int','wis','cha'].map(key=>`<span>${key.toUpperCase()} <b>${abilityModifier(abilities[key]) >= 0 ? '+' : ''}${abilityModifier(abilities[key])}</b></span>`).join('')}</div>` : ''}<div class="hp-actions"><button data-hp="-1" data-character="${c.id}">− HP</button><button data-hp="1" data-character="${c.id}">+ HP</button>${canEdit(c) ? `<button data-edit-sheet="${c.id}">Edit sheet</button><button data-export-character="${c.id}">Export</button><button data-delete-character="${c.id}" data-character-name="${esc(c.name)}">Delete</button>` : ''}${canEdit(c) && attack?.name ? `<button data-attack="${c.id}">Attack</button>` : ''}</div>`; })}</section>`;
    }
    if (view === 'messages') {
      const [{ data = [] }, { data: members = [] }] = await Promise.all([query('messages'),db.client.from('campaign_members').select('user_id,role,profiles(display_name)').eq('campaign_id',campaignId)]);
      const recipients = currentRole === 'gm' ? members.filter(m=>m.user_id !== session.user.id) : members.filter(m=>m.role === 'gm');
      return `<section><div class="live-title"><h2>Table messages</h2><button id="roll-d20">Roll d20</button></div><form id="message-form" class="live-form"><input id="message-text" placeholder="Say something to the table" required><select id="message-recipient"><option value="">Everyone at the table</option>${recipients.map(m=>`<option value="${m.user_id}">Whisper to ${esc(m.profiles?.display_name || (m.role === 'gm' ? 'GM' : 'player'))}</option>`).join('')}</select><button>Send</button></form>${cards(data, m => `<b>${esc(m.kind === 'roll' ? `d20 · ${m.body?.total}` : m.kind)}${m.recipient_id ? ' · private' : ''}</b><small>${esc(m.body && m.body.text || '')}</small>`)}</section>`;
    }
    if (view === 'session') {
      const { data = [] } = await query('sessions');
      const active = data.find(s => s.status === 'active');
      const isGm = currentRole === 'gm';
      if (!active) return `<section><div class="live-title"><h2>Live session</h2>${isGm ? '<button id="choose-scene">Choose a scene</button>' : ''}</div><p>No session is running. ${isGm ? 'Choose a prepared scene to start one.' : 'Your GM will start one when the table is ready.'}</p></section>`;
      localStorage.setItem('roll30.sessionId', active.id);
      const { data: activeScene } = active.scene_id ? await db.client.from('scenes').select('*').eq('id',active.scene_id).single() : { data:null };
      let backgroundUrl = ''; if (activeScene?.background_asset_id) { const { data: asset } = await db.client.from('campaign_assets').select('storage_path').eq('id',activeScene.background_asset_id).single(); if (asset?.storage_path) { const { data: signed } = await db.client.storage.from('campaign-media').createSignedUrl(asset.storage_path, 3600); backgroundUrl = signed?.signedUrl || ''; } }
      const { data: sceneObjects = [] } = activeScene ? await db.client.from('scene_objects').select('*').eq('scene_id',activeScene.id) : { data:[] };
      const [{ data: characters = [] }, { data: snapshots = [] }] = await Promise.all([
        query('characters'),
        db.client.from('session_snapshots').select('*').eq('session_id', active.id).order('created_at', { ascending:false })
      ]);
      const state = active.state || { tokens:[] };
      const { data: visibleTokenData, error: tokenViewError } = await db.client.rpc('get_visible_roll30_tokens',{target_session:active.id});
      if (tokenViewError) throw tokenViewError;
      const liveTokens = visibleTokenData || [];
      const tokenByCharacter = new Set(liveTokens.map(t => t.character_id));
      const objects = sceneObjects.filter(o=>o.object_type !== 'wall').map(o => `<button class="map-object ${o.state?.active ? 'active' : ''}" data-object="${o.id}" style="left:${o.x}%;top:${o.y}%" title="${esc(o.name)}">${esc(o.object_type.slice(0,1).toUpperCase())}</button>`).join('');
      const walls = sceneObjects.filter(o=>o.object_type === 'wall' && o.config?.x2 != null && o.config?.y2 != null).map(o => { const dx=Number(o.config.x2)-o.x, dy=Number(o.config.y2)-o.y; const length=Math.hypot(dx,dy); const angle=Math.atan2(dy,dx)*180/Math.PI; return `<span class="map-wall" style="left:${o.x}%;top:${o.y}%;width:${length}%;transform:rotate(${angle}deg)"></span>`; }).join('');
      const visibleTokens = liveTokens;
      const board = visibleTokens.map(t => `<button class="map-token" data-token="${t.id}" style="left:${t.x}%;top:${t.y}%" title="${esc(t.name)}">${esc(t.name.slice(0,2).toUpperCase())}</button>`).join('');
      const available = characters.filter(c => !tokenByCharacter.has(c.id));
      const initiative = state.initiative || [];
      const initiativePanel = `<h3>Initiative</h3>${initiative.length ? `<div class="live-cards">${initiative.map((entry,index) => `<article><b>${index === active.active_turn ? '▶ ' : ''}${esc(entry.name)}</b><small>${esc(entry.score)}</small>${isGm && entry.token_id ? `<button data-remove-initiative="${entry.token_id}">Remove</button>` : ''}</article>`).join('')}</div>` : '<p class="muted">No initiative order yet.</p>'}${isGm && liveTokens.length ? `<form id="initiative-form" class="live-form"><select id="initiative-token">${liveTokens.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select><input id="initiative-score" type="number" placeholder="Initiative roll" required><button>Add to initiative</button></form>` : ''}`;
      const tokenControls = isGm && liveTokens.length ? `<div class="token-tray"><strong>Tokens on board</strong>${liveTokens.map(t=>`<button data-remove-token="${t.id}">Remove ${esc(t.name)}</button>`).join('')}</div>` : '';
      const boardStyle = backgroundUrl ? ` style="background-image:url('${esc(backgroundUrl)}');background-size:cover;background-position:center"` : '';
      return `<section><div class="live-title"><h2>Live session</h2>${isGm ? '<button id="end-session">End session</button>' : ''}</div><p>${activeScene ? esc(activeScene.name) + ' · ' : ''}Round ${active.round}. Select your token, then click the board to move it. Movement is synchronized to the table and limited by speed.</p><div class="session-board${activeScene?.config?.show_grid === false ? ' no-grid' : ''}" id="session-board"${boardStyle}>${board || '<span class="board-empty">Add a character to begin.</span>'}${objects}${walls}${state.fog === true && !isGm ? '<div class="board-fog">Server-filtered vision · concealed tokens are not sent to this view</div>' : ''}</div>${isGm && activeScene ? '<button data-add-object="' + activeScene.id + '">Add interactive object</button>' : ''}${tokenControls}${initiativePanel}${isGm ? `<div class="token-tray">${available.map(c => `<button data-add-token="${c.id}">Add ${esc(c.name)}</button>`).join('')}</div><div class="session-controls"><button id="advance-turn">Advance turn</button><button id="save-snapshot">Save snapshot</button></div>` : ''}<h3>Recovery snapshots</h3>${snapshots.length ? `<div class="live-cards">${snapshots.map(s => `<article><b>${esc(s.label || 'Snapshot')}</b><small>${new Date(s.created_at).toLocaleString()}</small>${isGm ? `<button data-restore-snapshot="${s.id}">Restore this snapshot</button>` : ''}</article>`).join('')}</div>` : '<p class="muted">No snapshots saved yet.</p>'}</section>`;
    }
    if (view === 'prompts') {
      const { data = [] } = await query('prompts');
      const isGm = currentRole === 'gm';
      const responseResult = isGm ? await db.client.from('prompt_responses').select('prompt_id, response, prompts!inner(campaign_id), profiles(display_name)').eq('prompts.campaign_id',campaignId) : {data:[]};
      const responses = responseResult.data || [];
      return `<section><div class="live-title"><h2>Player prompts</h2>${isGm ? '<button data-dialog="prompt">New prompt</button>' : ''}</div>${cards(data, p => { const promptResponses = responses.filter(r=>r.prompt_id === p.id); return `<b>${esc(p.title)}</b><small>${esc(p.body || '')} · ${esc(p.status)}</small>${isGm ? (promptResponses.length ? `<p>${promptResponses.map(r=>`${esc(r.profiles?.display_name || 'Player')}: ${esc(r.response?.text || '')}`).join('<br>')}</p>` : '<p class="muted">No responses yet.</p>') : `<form class="prompt-response" data-prompt="${p.id}"><input placeholder="Your response" required><button>Respond</button></form>`}` })}</section>`;
    }
    if (view === 'shops') {
      const [{ data: shops = [] }, { data: items = [] }, { data: characters = [] }] = await Promise.all([query('shops'),query('items'),query('characters')]);
      const stockResult = await db.client.from('shop_stock').select('*, items(name), shops!inner(campaign_id)').eq('shops.campaign_id',campaignId);
      const stock = stockResult.data || [];
      const isGm = currentRole === 'gm';
      return `<section><div class="live-title"><h2>Shops</h2>${isGm ? '<button data-dialog="shop">New shop</button>' : ''}</div>${shops.length ? shops.map(s => `<article><b>${esc(s.name)}</b><small>${esc(s.settings?.mode || 'approval')} purchases</small>${isGm ? `<form class="shop-mode" data-shop="${s.id}"><select><option value="approval" ${(s.settings?.mode || 'approval') === 'approval' ? 'selected' : ''}>Approval</option><option value="automatic" ${s.settings?.mode === 'automatic' ? 'selected' : ''}>Automatic</option><option value="manual" ${s.settings?.mode === 'manual' ? 'selected' : ''}>Manual</option></select><button>Save mode</button></form><form class="stock-form" data-shop="${s.id}"><select>${items.map(i => `<option value="${i.id}">${esc(i.name)}</option>`).join('')}</select><input type="number" min="0" value="1" placeholder="Price"><button>Stock item</button></form>` : ''}${stock.filter(x=>x.shop_id===s.id).map(x=>`<div class="stock-row">${esc(x.items?.name)} · ${x.price} gp ${x.quantity === null ? '' : `(${x.quantity})`}<form class="buy-form" data-shop="${s.id}" data-item="${x.item_id}"><select>${characters.filter(c=>c.kind==='pc' && (isGm || c.owner_id === session.user.id)).map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select><button>${s.settings?.mode === 'automatic' ? 'Buy' : 'Request buy'}</button></form></div>`).join('') || '<small>No stock yet.</small>'}</article>`).join('') : '<p class="muted">Create a shop to add stock.</p>'}</section>`;
    }
    if (view === 'items') {
      const { data = [] } = await query('items');
      return `<section><div class="live-title"><h2>Items</h2><button data-dialog="item">New item</button></div>${cards(data, i => `<b>${esc(i.name)}</b><small>${esc(i.item_data?.type || 'Custom item')}</small>`)}</section>`;
    }
    if (view === 'inventory') {
      const { data = [] } = await db.client.from('character_inventory').select('quantity, items(name), characters!inner(name,campaign_id)').eq('characters.campaign_id', campaignId);
      return `<section><div class="live-title"><h2>Character inventory</h2></div><p class="muted">Items appear here after a GM approves a shop request.</p>${cards(data, i => `<b>${esc(i.items?.name || 'Item')}</b><small>${esc(i.characters?.name || 'Character')} · quantity ${esc(i.quantity)}</small>`)}</section>`;
    }
    if (view === 'notes') {
      const isGm = currentRole === 'gm';
      const [activeResult, trashResult] = await Promise.all([
        db.client.from('campaign_notes').select('*').eq('campaign_id',campaignId).is('deleted_at',null).order('updated_at',{ascending:false}),
        isGm ? db.client.from('campaign_notes').select('*').eq('campaign_id',campaignId).not('deleted_at','is',null).order('deleted_at',{ascending:false}) : Promise.resolve({data:[]})
      ]);
      if(activeResult.error)throw activeResult.error;if(trashResult.error)throw trashResult.error;
      const data=activeResult.data || [], trashed=trashResult.data || [];
      const trashSection=isGm && trashed.length ? `<h3>Trash</h3>${cards(trashed,n=>`<b>${esc(n.title)}</b><small>${esc(n.kind)}</small><div class="hp-actions"><button data-restore-note="${n.id}">Restore</button><button data-delete-note="${n.id}">Delete permanently</button></div>`)}` : '';
      return `<section><div class="live-title"><div><h2>Notes & lore</h2><p class="muted">Searchable campaign knowledge, handouts, and custom rules.</p></div>${isGm ? '<button id="new-note">New entry</button>' : ''}</div>${data.length ? '<label>Search notes<input id="notes-search" type="search" placeholder="Title, body, folder, or tag"></label>' : ''}${cards(data,n=>`<div data-note-search="${esc([n.title,n.body,n.folder,...(n.tags || [])].join(' ').toLowerCase())}"><b>${esc(n.title)}</b><small>${esc(n.kind)}${n.folder ? ` · ${esc(n.folder)}` : ''}${n.tags?.length ? ` · ${esc(n.tags.join(', '))}` : ''}${n.hidden ? ' · GM only' : n.audience?.length ? ` · shared with ${n.audience.length} player${n.audience.length === 1 ? '' : 's'}` : ' · shared with table'}</small><p>${esc(n.body)}</p>${isGm ? `<div class="hp-actions"><button data-toggle-note="${n.id}" data-hidden="${n.hidden}">${n.hidden ? 'Reveal to players' : 'Hide from players'}</button><button data-edit-note="${n.id}">Edit</button><button data-trash-note="${n.id}">Move to trash</button></div>` : ''}</div>`)}${trashSection}</section>`;
    }
    if (view === 'history') {
      const { data = [] } = await db.client.from('session_events').select('*, sessions!inner(campaign_id)').eq('sessions.campaign_id',campaignId).order('created_at',{ascending:false}).limit(100);
      return `<section><div class="live-title"><h2>Session history</h2></div><p class="muted">A persisted timeline of table actions and automation.</p>${cards(data,e=>`<b>${esc(e.event_type.replaceAll('_',' '))}</b><small>${new Date(e.created_at).toLocaleString()}</small>${e.payload?.name ? `<p>${esc(e.payload.name)}</p>` : ''}`)}</section>`;
    }
    if (view === 'templates') {
      const { data = [] } = await db.client.from('scene_templates').select('*').eq('campaign_id',campaignId).order('created_at',{ascending:false});
      const isGm = currentRole === 'gm';
      return `<section><div class="live-title"><h2>Scene templates</h2></div>${cards(data,t=>`<b>${esc(t.name)}</b><small>${esc(t.scene_type)} · ${(t.objects || []).length} objects</small>${isGm ? `<button data-use-template="${t.id}" data-template-name="${esc(t.name)}">Create scene</button>` : ''}`)}</section>`;
    }
    if (view === 'purchases') {
      const { data = [] } = await db.client.from('purchase_requests').select('*, items(name), characters(name), shops!inner(campaign_id)').eq('shops.campaign_id', campaignId).order('created_at',{ascending:false});
      return `<section><h2>Purchase requests</h2>${cards(data, p => `<b>${esc(p.characters?.name)} · ${esc(p.items?.name)}</b><small>${esc(p.status)} · quantity ${p.quantity}</small>${p.status === 'pending' ? `<button data-resolve-purchase="${p.id}" data-approve="true">Approve</button><button data-resolve-purchase="${p.id}" data-approve="false">Decline</button>` : ''}`)}</section>`;
    }
    if (view === 'automation') {
      const [{ data: scenes = [] }, { data: sessions = [] }] = await Promise.all([query('scenes'),query('sessions')]);
      const triggerResult = await db.client.from('scene_triggers').select('*, scenes!inner(campaign_id,name)').eq('scenes.campaign_id',campaignId);
      const triggers = triggerResult.data || []; const active = sessions.find(s=>s.status==='active');
      const effectLabel = { show_fog:'show fog', clear_fog:'clear fog', advance_round:'advance round' };
      return `<section><div class="live-title"><h2>Automation rules</h2><button data-dialog="trigger">New rule</button></div>${cards(triggers, t => `<b>${esc(t.name)}</b><small>${esc(t.scenes?.name)} · ${esc((t.effects || []).map(e=>effectLabel[e.type] || 'custom effect').join(', ') || 'log only')} · ${t.enabled ? 'enabled' : 'disabled'}</small>${active && currentRole === 'gm' ? `<button data-execute-trigger="${t.id}">Run now</button>` : ''}`)}${scenes.length ? '' : '<p class="muted">Create a scene before adding automation.</p>'}</section>`;
    }
    if (view === 'settings') {
      const [{ data: members = [] }, { data: pcs = [] }] = await Promise.all([
        db.client.from('campaign_members').select('*, profiles(display_name), characters(name)').eq('campaign_id',campaignId),
        db.client.from('characters').select('id,name').eq('campaign_id',campaignId).eq('kind','pc').order('name')
      ]);
      const isGm = members.some(m => m.user_id === session.user.id && m.role === 'gm');
      const isOwner = campaign.owner_id === session.user.id;
      const nameControl = isOwner ? `<form id="campaign-settings" class="live-form"><label>Campaign name<input id="campaign-title" value="${esc(campaign.name)}" maxlength="120" required></label><button>Save name</button></form>` : `<p><strong>${esc(campaign.name)}</strong></p>`;
      const lifecycle = isOwner
        ? `<div class="session-controls"><button id="toggle-campaign-archive">${campaign.archived_at ? 'Restore from archive' : 'Archive campaign'}</button><button id="trash-campaign">Move campaign to trash</button></div>`
        : '<button id="leave-current-campaign">Leave this campaign</button>';
      return `<section><h2>Campaign settings</h2><p class="muted">Manage the campaign identity, invitation, and table membership.</p>${nameControl}<div><strong>Join code: ${esc(campaign.join_code)}</strong><div class="session-controls"><button id="copy-code">Copy code</button><button id="rotate-code">Create a new code</button></div></div>${lifecycle}<h3>Table members</h3>${cards(members,m=>{ const canManage = isGm && m.user_id !== campaign.owner_id; const assignment = isGm && m.role === 'player' ? `<div class="assign-character"><select aria-label="Assigned player character" data-member-character="${m.user_id}"><option value="">Choose a player character</option>${pcs.map(c=>`<option value="${c.id}" ${c.id === m.character_id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select><button data-assign-member="${m.user_id}">Assign</button></div>` : ''; const roleControl = isOwner && m.user_id !== campaign.owner_id ? `<div class="assign-character"><select aria-label="Campaign role" data-member-role="${m.user_id}"><option value="player" ${m.role === 'player' ? 'selected' : ''}>Player</option><option value="gm" ${m.role === 'gm' ? 'selected' : ''}>Game Master</option></select><button data-save-member-role="${m.user_id}">Save role</button></div>` : ''; const removal = canManage ? `<button data-remove-member="${m.user_id}">Remove from campaign</button>` : ''; return `<b>${esc(m.profiles?.display_name || 'Member')}</b><small>${esc(m.role)}${m.characters?.name ? ` · ${esc(m.characters.name)}` : ''}${m.user_id === campaign.owner_id ? ' · owner' : ''}</small>${assignment}${roleControl}${removal}`; })}</section>`;
    }
    if (view === 'compendium') {
      return compendiumView();
    }
    if (view === 'media') {
      const { data = [] } = await query('campaign_assets');
      const playable = await Promise.all(data.map(async a => { const { data: signed } = await db.client.storage.from('campaign-media').createSignedUrl(a.storage_path, 3600); return {...a, signedUrl:signed?.signedUrl}; }));
      return `<section><div class="live-title"><div><h2>Campaign media</h2><p class="muted">Private preparation files stay GM-only until you reveal them.</p></div></div><form id="upload-media" class="live-form"><label>Image, audio, or PDF<input id="media-file" type="file" accept="image/*,audio/*,.pdf" required></label><button>Upload private file</button></form>${cards(playable, a => `<b>${esc(a.label || a.storage_path.split('/').pop())}</b><small>${esc(a.kind)} · ${a.visible_to_players ? 'shared with players' : 'GM only'} · uploaded ${new Date(a.created_at).toLocaleDateString()}</small>${a.kind === 'image' && a.signedUrl ? `<img class="media-preview" src="${esc(a.signedUrl)}" alt="${esc(a.label || 'Campaign image')}">` : ''}${a.kind === 'audio' && a.signedUrl ? `<audio controls preload="none" src="${esc(a.signedUrl)}"></audio>` : ''}${a.kind === 'handout' && a.signedUrl ? `<a href="${esc(a.signedUrl)}" target="_blank" rel="noopener">Open handout</a>` : ''}<form class="rename-media" data-asset="${a.id}"><label>Display name<input value="${esc(a.label || '')}" maxlength="160" required></label><button>Rename</button></form><div class="hp-actions"><button data-toggle-media="${a.id}" data-visible="${a.visible_to_players}">${a.visible_to_players ? 'Hide from players' : 'Reveal to players'}</button><button data-delete-media="${a.id}" data-asset-path="${esc(a.storage_path)}">Delete file</button></div>`)}</section>`;
    }
    const [sceneRes, charRes, sessionRes] = await Promise.all([query('scenes'), query('characters'), query('sessions')]);
    const nextStep = currentRole === 'gm'
      ? 'Prepare a scene or character, then open the live table when your group is ready.'
      : currentCharacterId
        ? 'Your character is assigned. Open the live table when the GM starts the session.'
        : 'You have joined the campaign. Your GM can assign your character from campaign settings.';
    return `<section><h2>${esc(campaign.name)}</h2><p class="muted">${esc(campaign.system)}${currentRole === 'gm' ? ` · Join code <strong>${esc(campaign.join_code)}</strong>` : ''}</p><div class="live-stats"><div><b>${sceneRes.data?.length || 0}</b><small>scenes</small></div><div><b>${charRes.data?.length || 0}</b><small>characters</small></div><div><b>${sessionRes.data?.filter(s => s.status === 'active').length || 0}</b><small>live sessions</small></div><div><b>${onlineCount}</b><small>connected now</small></div></div><p>${esc(nextStep)}</p></section>`;
  }
  function cards(rows, renderCard) { return renderCards(rows, renderCard, currentView, currentRole); }
  async function render(view = 'overview') {
    currentView = view;
    app.innerHTML = shell({ campaign, role:currentRole, currentView:view });
    const contentElement = document.getElementById('live-content');
    try {
      contentElement.innerHTML = await content(view);
      contentElement.setAttribute('aria-busy', 'false');
    } catch (error) {
      contentElement.innerHTML = errorPanel(error.message || 'The request failed.');
      contentElement.setAttribute('aria-busy', 'false');
    }
    bind(view);
    document.querySelector('.workspace')?.focus({ preventScroll:true });
  }
  function bind(view) {
    const navigation = document.getElementById('app-navigation');
    const navToggle = document.getElementById('nav-toggle');
    if (navToggle) navToggle.onclick = () => { const open = navigation.classList.toggle('open'); navToggle.setAttribute('aria-expanded', String(open)); navToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation'); };
    app.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { navigation?.classList.remove('open'); render(b.dataset.view); });
    app.querySelector('[data-retry-view]')?.addEventListener('click', () => render(view));
    if (view === 'compendium') bindCompendium({ app, db, campaignId, role:currentRole, notice });
    document.getElementById('leave-campaign').onclick = () => { localStorage.removeItem('roll30.campaignId'); window.location.replace('./index.html'); };
    app.querySelectorAll('[data-dialog]').forEach(b => b.onclick = () => openDialog(b.dataset.dialog));
    const newNote = document.getElementById('new-note'); if (newNote) newNote.onclick = () => openNoteDialog();
    const notesSearch = document.getElementById('notes-search'); if(notesSearch) notesSearch.oninput = () => { const term=notesSearch.value.trim().toLowerCase(); app.querySelectorAll('[data-note-search]').forEach(note => { note.closest('article').hidden = term && !note.dataset.noteSearch.includes(term); }); };
    app.querySelectorAll('[data-toggle-note]').forEach(b => b.onclick = async () => { const { error } = await db.client.from('campaign_notes').update({hidden:b.dataset.hidden !== 'true'}).eq('id',b.dataset.toggleNote); if(error) notice(error.message,true); else render('notes'); });
    app.querySelectorAll('[data-edit-note]').forEach(b => b.onclick = () => openNoteDialog(b.dataset.editNote));
    app.querySelectorAll('[data-trash-note]').forEach(b => b.onclick = async () => { const { error }=await db.client.from('campaign_notes').update({deleted_at:new Date().toISOString()}).eq('id',b.dataset.trashNote); if(error)notice(error.message,true);else { notice('Note moved to trash.'); render('notes'); } });
    app.querySelectorAll('[data-restore-note]').forEach(b => b.onclick = async () => { const { error }=await db.client.from('campaign_notes').update({deleted_at:null}).eq('id',b.dataset.restoreNote); if(error)notice(error.message,true);else { notice('Note restored.'); render('notes'); } });
    app.querySelectorAll('[data-delete-note]').forEach(b => b.onclick = async () => { if(!window.confirm('Permanently delete this trashed entry? This cannot be undone.'))return; const { error }=await db.client.from('campaign_notes').delete().eq('id',b.dataset.deleteNote); if(error)notice(error.message,true);else { notice('Note permanently deleted.'); render('notes'); } });
    app.querySelectorAll('[data-run-scene]').forEach(b => b.onclick = async () => {
      const { data: running = [] } = await query('sessions');
      const active = running.find(s => s.status === 'active');
      if (active) return notice('End the current live session before running another scene.', true);
      const { data, error } = await db.client.from('sessions').insert({ campaign_id:campaignId, scene_id:b.dataset.runScene, state:{tokens:[],initiative:[],fog:false} }).select().single();
      if (error) return notice(error.message, true);
      localStorage.setItem('roll30.sessionId', data.id); render('session');
    });
    app.querySelectorAll('[data-scene-config]').forEach(b => b.onclick = () => openSceneConfig(b.dataset.sceneConfig));
    app.querySelectorAll('[data-duplicate-scene]').forEach(b => b.onclick = async () => { const { error } = await db.client.rpc('duplicate_roll30_scene',{source_scene:b.dataset.duplicateScene}); if(error)notice(error.message,true);else { notice('Scene duplicated.'); render('scenes'); } });
    app.querySelectorAll('[data-save-template]').forEach(b => b.onclick = async () => { const name = window.prompt('Template name',`${b.dataset.sceneName} template`); if(!name?.trim()) return; const { error } = await db.client.rpc('save_roll30_scene_template',{source_scene:b.dataset.saveTemplate,template_name:name.trim()}); if(error)notice(error.message,true);else notice('Scene template saved.'); });
    app.querySelectorAll('[data-use-template]').forEach(b => b.onclick = async () => { const name = window.prompt('New scene name',b.dataset.templateName); if(!name?.trim()) return; const { error } = await db.client.rpc('create_roll30_scene_from_template',{template_id:b.dataset.useTemplate,scene_name:name.trim()}); if(error)notice(error.message,true);else { notice('Scene created from template.'); render('scenes'); } });
    app.querySelectorAll('[data-trash-scene]').forEach(b => b.onclick = async () => { const { error } = await db.client.rpc('trash_roll30_scene',{target_scene:b.dataset.trashScene}); if(error)notice(error.message,true);else { notice('Scene moved to trash.'); render('scenes'); } });
    app.querySelectorAll('[data-restore-scene]').forEach(b => b.onclick = async () => { const { error } = await db.client.rpc('restore_roll30_scene',{target_scene:b.dataset.restoreScene}); if(error)notice(error.message,true);else { notice('Scene restored.'); render('scenes'); } });
    app.querySelectorAll('[data-delete-scene-permanently]').forEach(b => b.onclick = async () => { if (!window.confirm('Permanently delete this trashed scene and its objects? This cannot be undone.')) return; const { error } = await db.client.rpc('delete_roll30_scene_permanently',{target_scene:b.dataset.deleteScenePermanently}); if(error)notice(error.message,true);else { notice('Scene permanently deleted.'); render('scenes'); } });
    app.querySelectorAll('[data-hp]').forEach(b => b.onclick = async () => { const { error } = await db.client.rpc('change_roll30_hp', { target_character:b.dataset.character, delta:Number(b.dataset.hp) }); if (error) notice(error.message, true); else render('characters'); });
    app.querySelectorAll('[data-edit-sheet]').forEach(b => b.onclick = () => openCharacterSheet(b.dataset.editSheet));
    app.querySelectorAll('[data-attack]').forEach(b => b.onclick = () => openAttackDialog(b.dataset.attack));
    app.querySelectorAll('[data-delete-character]').forEach(b => b.onclick = async () => { if(!window.confirm(`Delete ${b.dataset.characterName}? Assigned players and live tokens will lose this character.`))return; const { error }=await db.client.from('characters').delete().eq('id',b.dataset.deleteCharacter); if(error)notice(error.message,true);else { notice('Character deleted.'); render('characters'); } });
    app.querySelectorAll('[data-export-character]').forEach(b => b.onclick = async () => { const { data, error }=await db.client.from('characters').select('name,kind,sheet_schema_version,sheet,hp_current,hp_max').eq('id',b.dataset.exportCharacter).single(); if(error)return notice(error.message,true); const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}); const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=`${data.name.replace(/[^a-z0-9]+/gi,'-').toLowerCase()}-roll30.json`;link.click();URL.revokeObjectURL(link.href);notice('Character exported.'); });
    const messageForm = document.getElementById('message-form');
    if (messageForm) messageForm.onsubmit = async e => { e.preventDefault(); const text = document.getElementById('message-text').value.trim(); if (!text) return; const recipient = document.getElementById('message-recipient').value || null; const { error } = await db.client.from('messages').insert({ campaign_id:campaignId, sender_id:session.user.id, recipient_id:recipient, kind:recipient ? 'whisper' : 'message', body:{ text } }); if (error) return notice(error.message, true); render('messages'); };
    const rollD20 = document.getElementById('roll-d20');
    if (rollD20) rollD20.onclick = async () => { const roll = crypto.getRandomValues(new Uint32Array(1))[0] % 20 + 1; const roller = session.user.email?.split('@')[0] || 'A player'; const text = `${roller} rolled a ${roll}${roll === 20 ? ' — natural 20!' : roll === 1 ? ' — natural 1!' : ''}`; const { error } = await db.client.from('messages').insert({campaign_id:campaignId,sender_id:session.user.id,kind:'roll',body:{dice:'d20',total:roll,text}}); if(error) notice(error.message,true); else render('messages'); };
    const mediaForm = document.getElementById('upload-media');
    if (mediaForm) mediaForm.onsubmit = async e => { e.preventDefault(); const file = document.getElementById('media-file').files[0]; if (!file) return; const allowed = file.type.startsWith('image/') || file.type.startsWith('audio/') || file.type === 'application/pdf'; if(!allowed)return notice('Choose an image, audio file, or PDF.',true); if(file.size > 25 * 1024 * 1024)return notice('That file is larger than the 25 MB campaign limit.',true); const path = `${campaignId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`; notice('Uploading media…'); const submit=mediaForm.querySelector('button');submit.disabled=true; const { error: uploadError } = await db.client.storage.from('campaign-media').upload(path, file); if (uploadError){submit.disabled=false;return notice(uploadError.message, true);} const kind = file.type.startsWith('audio/') ? 'audio' : file.type === 'application/pdf' ? 'handout' : 'image'; const { error } = await db.client.from('campaign_assets').insert({ campaign_id:campaignId, uploaded_by:session.user.id, kind, storage_path:path, label:file.name,visible_to_players:false }); if (error){await db.client.storage.from('campaign-media').remove([path]);submit.disabled=false;return notice(error.message, true);} notice('Private media uploaded.'); render('media'); };
    app.querySelectorAll('.rename-media').forEach(form => form.onsubmit = async e => { e.preventDefault(); const label=form.querySelector('input').value.trim(); const { error }=await db.client.from('campaign_assets').update({label}).eq('id',form.dataset.asset); if(error)notice(error.message,true);else { notice('Media renamed.'); render('media'); } });
    app.querySelectorAll('[data-toggle-media]').forEach(b => b.onclick = async () => { const { error }=await db.client.from('campaign_assets').update({visible_to_players:b.dataset.visible !== 'true'}).eq('id',b.dataset.toggleMedia); if(error)notice(error.message,true);else { notice(b.dataset.visible === 'true' ? 'Media hidden from players.' : 'Media revealed to players.'); render('media'); } });
    app.querySelectorAll('[data-delete-media]').forEach(b => b.onclick = async () => { if(!window.confirm('Delete this media file? Scenes using it will return to the grid background.'))return; const { error:storageError }=await db.client.storage.from('campaign-media').remove([b.dataset.assetPath]); if(storageError)return notice(storageError.message,true); const { error }=await db.client.from('campaign_assets').delete().eq('id',b.dataset.deleteMedia); if(error)return notice('The file was removed, but its database record could not be cleaned up: '+error.message,true); notice('Media deleted.'); render('media'); });
    const settingsForm = document.getElementById('campaign-settings');
    if (settingsForm) settingsForm.onsubmit = async e => { e.preventDefault(); const { error } = await db.client.from('campaigns').update({name:document.getElementById('campaign-title').value.trim()}).eq('id',campaignId); if(error)notice(error.message,true);else load(); };
    const copyCode = document.getElementById('copy-code'); if(copyCode) copyCode.onclick = async () => { await navigator.clipboard.writeText(campaign.join_code); notice('Join code copied.'); };
    const rotateCode = document.getElementById('rotate-code'); if (rotateCode) rotateCode.onclick = async () => { if (!window.confirm('Create a new join code? The old code will stop working immediately.')) return; const { error } = await db.client.rpc('regenerate_roll30_join_code',{target_campaign:campaignId}); if(error)notice(error.message,true);else { notice('A new join code is ready.'); load(); } };
    const archiveCampaign = document.getElementById('toggle-campaign-archive'); if (archiveCampaign) archiveCampaign.onclick = async () => { const { error } = await db.client.rpc('set_roll30_campaign_archived',{target_campaign:campaignId,should_archive:!campaign.archived_at}); if(error)notice(error.message,true);else { notice(campaign.archived_at ? 'Campaign restored from the archive.' : 'Campaign archived.'); load(); } };
    const trashCampaign = document.getElementById('trash-campaign'); if (trashCampaign) trashCampaign.onclick = async () => { if (!window.confirm('Move this campaign to trash? Members will immediately lose access until you restore it.')) return; const { error } = await db.client.rpc('trash_roll30_campaign',{target_campaign:campaignId}); if(error)return notice(error.message,true); localStorage.removeItem('roll30.campaignId'); window.location.replace('./index.html'); };
    const leaveCampaign = document.getElementById('leave-current-campaign'); if (leaveCampaign) leaveCampaign.onclick = async () => { if (!window.confirm('Leave this campaign? You will need a current join code to return.')) return; const { error } = await db.client.rpc('leave_roll30_campaign',{target_campaign:campaignId}); if(error)return notice(error.message,true); localStorage.removeItem('roll30.campaignId'); window.location.replace('./index.html'); };
    app.querySelectorAll('[data-assign-member]').forEach(b => b.onclick = async () => { const character = app.querySelector(`[data-member-character="${b.dataset.assignMember}"]`).value; if (!character) return notice('Choose a player character first.', true); const { error } = await db.client.rpc('assign_roll30_character',{ target_member:b.dataset.assignMember, target_character:character }); if (error) notice(error.message,true); else { notice('Character assigned to player.'); render('settings'); } });
    app.querySelectorAll('[data-save-member-role]').forEach(b => b.onclick = async () => { const role = app.querySelector(`[data-member-role="${b.dataset.saveMemberRole}"]`).value; const { error } = await db.client.rpc('set_roll30_member_role',{target_campaign:campaignId,target_user:b.dataset.saveMemberRole,target_role:role}); if(error)notice(error.message,true);else { notice('Member role updated.'); render('settings'); } });
    app.querySelectorAll('[data-remove-member]').forEach(b => b.onclick = async () => { if (!window.confirm('Remove this person from the campaign? They can rejoin later with a valid code.')) return; const { error } = await db.client.rpc('remove_roll30_campaign_member',{target_campaign:campaignId,target_user:b.dataset.removeMember}); if(error)notice(error.message,true);else { notice('Member removed from the campaign.'); render('settings'); } });
    app.querySelectorAll('.prompt-response').forEach(form => form.onsubmit = async e => { e.preventDefault(); const text = form.querySelector('input').value.trim(); const { error } = await db.client.from('prompt_responses').upsert({ prompt_id:form.dataset.prompt, user_id:session.user.id, response:{ text } }); if (error) notice(error.message, true); else notice('Response sent to the GM.'); });
    app.querySelectorAll('.stock-form').forEach(form => form.onsubmit = async e => { e.preventDefault(); const item_id = form.querySelector('select').value; const price = Number(form.querySelector('input').value); const { error } = await db.client.from('shop_stock').upsert({ shop_id:form.dataset.shop,item_id,price,quantity:null }); if (error) notice(error.message,true); else render('shops'); });
    app.querySelectorAll('.shop-mode').forEach(form => form.onsubmit = async e => { e.preventDefault(); const { data: shop, error:getError } = await db.client.from('shops').select('settings').eq('id',form.dataset.shop).single(); if(getError)return notice(getError.message,true); const { error }=await db.client.from('shops').update({settings:{...(shop.settings || {}),mode:form.querySelector('select').value}}).eq('id',form.dataset.shop); if(error)notice(error.message,true);else render('shops'); });
    app.querySelectorAll('.buy-form').forEach(form => form.onsubmit = async e => { e.preventDefault(); const character_id=form.querySelector('select').value; if(!character_id)return notice('Choose your character first.',true); const { data, error } = await db.client.rpc('request_roll30_purchase',{target_shop:form.dataset.shop,target_item:form.dataset.item,target_character:character_id,requested_quantity:1}); if(error)notice(error.message,true);else notice(data.status === 'completed' ? 'Purchase completed and added to inventory.' : 'Purchase request sent to the GM.'); });
    app.querySelectorAll('[data-resolve-purchase]').forEach(b => b.onclick = async () => { const { error } = await db.client.rpc('resolve_roll30_purchase',{target_request:b.dataset.resolvePurchase,approve:b.dataset.approve === 'true'}); if(error) notice(error.message,true); else render('purchases'); });
    app.querySelectorAll('[data-execute-trigger]').forEach(b => b.onclick = async () => { const id=localStorage.getItem('roll30.sessionId'); const { error } = await db.client.rpc('execute_roll30_trigger',{target_trigger:b.dataset.executeTrigger,target_session:id}); if(error) notice(error.message,true); else { notice('Automation rule applied to the live session.'); render('automation'); } });
    const chooseScene = document.getElementById('choose-scene'); if (chooseScene) chooseScene.onclick = () => render('scenes');
    const advance = document.getElementById('advance-turn');
    if (advance) advance.onclick = async () => { const id = localStorage.getItem('roll30.sessionId'); if (!id) return; const { error } = await db.client.rpc('advance_roll30_turn', { target_session:id }); if (error) notice(error.message, true); else notice('Turn advanced for everyone at the table.'); };
    const initiativeForm = document.getElementById('initiative-form');
    if (initiativeForm) initiativeForm.onsubmit = async e => { e.preventDefault(); const id = localStorage.getItem('roll30.sessionId'); const { error } = await db.client.rpc('add_roll30_initiative_entry',{target_session:id,target_token:document.getElementById('initiative-token').value,target_score:Number(document.getElementById('initiative-score').value)}); if(error) notice(error.message,true); else render('session'); };
    app.querySelectorAll('[data-remove-initiative]').forEach(b => b.onclick = async () => { const id=localStorage.getItem('roll30.sessionId'); const { error }=await db.client.rpc('remove_roll30_initiative_entry',{target_session:id,target_token:b.dataset.removeInitiative}); if(error)notice(error.message,true);else render('session'); });
    const end = document.getElementById('end-session');
    if (end) end.onclick = async () => { const id = localStorage.getItem('roll30.sessionId'); const { error } = await db.client.from('sessions').update({ status:'ended' }).eq('id', id); if (error) notice(error.message, true); else { localStorage.removeItem('roll30.sessionId'); render('session'); } };
    const snapshot = document.getElementById('save-snapshot');
    if (snapshot) snapshot.onclick = async () => { const id = localStorage.getItem('roll30.sessionId'); const { error } = await db.client.rpc('snapshot_roll30_session', { target_session:id, snapshot_label:'Manual snapshot' }); if (error) notice(error.message, true); else notice('Snapshot saved.'); };
    app.querySelectorAll('[data-restore-snapshot]').forEach(b => b.onclick = async () => {
      if (!window.confirm('Restore this snapshot? The current board state will be replaced.')) return;
      const { error } = await db.client.rpc('restore_roll30_snapshot', { target_snapshot:b.dataset.restoreSnapshot });
      if (error) notice(error.message, true); else { notice('Snapshot restored for everyone at the table.'); render('session'); }
    });
    app.querySelectorAll('[data-add-token]').forEach(b => b.onclick = async () => { const id = localStorage.getItem('roll30.sessionId'); const { error } = await db.client.rpc('add_roll30_session_token',{target_session:id,target_character:b.dataset.addToken}); if (error) notice(error.message,true); else render('session'); });
    app.querySelectorAll('[data-remove-token]').forEach(b => b.onclick = async () => { if (!window.confirm('Remove this token from the live board?')) return; const id=localStorage.getItem('roll30.sessionId'); const { error }=await db.client.rpc('remove_roll30_session_token',{target_session:id,target_token:b.dataset.removeToken}); if(error)notice(error.message,true);else render('session'); });
    app.querySelectorAll('[data-add-object]').forEach(b => b.onclick = () => openObjectDialog(b.dataset.addObject));
    app.querySelectorAll('[data-object]').forEach(b => b.onclick = async () => { if (currentRole !== 'gm') return; const { data: object, error:getError } = await db.client.from('scene_objects').select('*').eq('id',b.dataset.object).single(); if(getError) return notice(getError.message,true); const { error } = await db.client.from('scene_objects').update({state:{...object.state,active:!object.state?.active}}).eq('id',object.id); if(error)notice(error.message,true);else { notice(object.name + ' state changed.'); render('session'); } });
    let selectedToken = null;
    app.querySelectorAll('[data-token]').forEach(b => b.onclick = () => { selectedToken = b.dataset.token; app.querySelectorAll('[data-token]').forEach(x => x.classList.toggle('selected', x.dataset.token === selectedToken)); });
    const board = document.getElementById('session-board');
    if (board) board.onclick = async event => {
      if (!selectedToken || event.target !== board) return;
      const id = localStorage.getItem('roll30.sessionId'); const rect = board.getBoundingClientRect(); const x = Math.max(2, Math.min(98, Math.round((event.clientX - rect.left) / rect.width * 100))); const y = Math.max(2, Math.min(98, Math.round((event.clientY - rect.top) / rect.height * 100)));
      const { error } = await db.client.rpc('move_roll30_token', { target_session:id, target_token:selectedToken, target_x:x, target_y:y }); if (error) notice(error.message, true); else render('session');
    };
  }
  async function openDialog(kind) {
    const dialog = document.getElementById('live-dialog');
    dialog.classList.remove('sheet-dialog');
    dialog.innerHTML = kind === 'scene'
      ? `<form method="dialog" id="create-record"><h3>New scene</h3><label>Scene name<input id="record-name" required></label><label>Scene type<select id="record-type"><option value="playing">Playing field</option><option value="battle">Battle field</option></select></label><label>Folder<input id="record-folder" placeholder="Optional, such as Chapter 1"></label><button>Create scene</button></form>`
        : kind === 'prompt'
        ? `<form method="dialog" id="create-record"><h3>New prompt</h3><input id="record-name" placeholder="Prompt title" required><input id="record-body" placeholder="Question or instructions"><button>Send prompt</button></form>`
        : kind === 'shop'
          ? `<form method="dialog" id="create-record"><h3>New shop</h3><input id="record-name" placeholder="Shop name" required><button>Create shop</button></form>`
          : kind === 'item'
            ? `<form method="dialog" id="create-record"><h3>New item</h3><input id="record-name" placeholder="Item name" required><input id="record-body" placeholder="Item type or description"><button>Create item</button></form>`
            : kind === 'trigger'
              ? `<form method="dialog" id="create-record"><h3>New automation rule</h3><input id="record-name" placeholder="Rule name" required><select id="record-type">${(await query('scenes')).data.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select><select id="record-effect"><option value="show_fog">Show fog</option><option value="clear_fog">Clear fog</option><option value="advance_round">Advance round</option></select><input id="record-body" placeholder="When should this run?"><button>Save rule</button></form>`
          : `<form method="dialog" id="create-record"><h3>New character</h3><label>Name<input id="record-name" placeholder="Character name" required></label><label>Type<select id="record-type"><option value="pc">Player character</option>${currentRole === 'gm' ? '<option value="npc">NPC</option><option value="monster">Monster</option>' : ''}</select></label><label>Import a Roll30 JSON file (optional)<input id="character-import" type="file" accept="application/json,.json"></label><button>Create character</button></form>`;
    showModal(dialog);
    dialog.querySelector('#create-record').onsubmit = async e => {
      e.preventDefault();
      const name=dialog.querySelector('#record-name').value.trim(), type=dialog.querySelector('#record-type')?.value, body=dialog.querySelector('#record-body')?.value, folder=dialog.querySelector('#record-folder')?.value.trim() || null, effect=dialog.querySelector('#record-effect')?.value;
      const table=kind === 'scene' ? 'scenes' : kind === 'prompt' ? 'prompts' : kind === 'shop' ? 'shops' : kind === 'item' ? 'items' : kind === 'trigger' ? 'scene_triggers' : 'characters';
      let imported=null; const importFile=dialog.querySelector('#character-import')?.files?.[0];
      if(importFile){try{imported=JSON.parse(await importFile.text());if(!imported.sheet || typeof imported.sheet !== 'object')throw new Error('The file has no Roll30 sheet.');}catch(importError){return notice(`Character import failed: ${importError.message}`,true);}}
      const row=kind === 'scene' ? {campaign_id:campaignId,name,scene_type:type,folder,created_by:session.user.id} : kind === 'prompt' ? {campaign_id:campaignId,created_by:session.user.id,title:name,body} : kind === 'shop' ? {campaign_id:campaignId,name} : kind === 'item' ? {campaign_id:campaignId,name,item_data:{type:body || 'Custom item'}} : kind === 'trigger' ? {scene_id:type,name,trigger:{description:body||'Manual trigger'},effects:[{type:effect}]} : {campaign_id:campaignId,name,kind:type,owner_id:type === 'pc' ? session.user.id : null,hp_current:imported?.hp_current ?? 10,hp_max:imported?.hp_max ?? 10,sheet_schema_version:1,sheet:imported?.sheet || {abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},level:1,proficiency_bonus:2,armor_class:10,speed:30,vision:30,conditions:[],features:[],equipment:[],attacks:[],currency:{gp:0}}};
      const { error }=await db.client.from(table).insert(row); if(error)return notice(error.message,true); dialog.close(); render(kind === 'scene' ? 'scenes' : kind === 'prompt' ? 'prompts' : kind === 'shop' ? 'shops' : kind === 'item' ? 'items' : kind === 'trigger' ? 'automation' : 'characters');
    };
  }
  async function openCharacterSheet(characterId) {
    const [{ data: character, error }, { data: portraits = [] }] = await Promise.all([
      db.client.from('characters').select('*').eq('id', characterId).single(),
      db.client.from('campaign_assets').select('id,label,kind').eq('campaign_id',campaignId).in('kind',['image','portrait']).order('created_at',{ascending:false})
    ]);
    if (error) return notice(error.message, true);
    const sheet = character.sheet || {}; const currency = sheet.currency || {}; const abilities=sheet.abilities || {};
    const listValue = value => Array.isArray(value) ? value.join(', ') : '';
    const firstAttack = sheet.attacks?.[0] || sheet.attack || {};
    const dialog = document.getElementById('live-dialog');
    dialog.classList.add('sheet-dialog');
    dialog.innerHTML = `<form method="dialog" id="character-sheet-form"><div><h3>${esc(character.name)} sheet</h3><p class="muted">Schema v${character.sheet_schema_version || 1} · revision ${character.sheet_revision || 0}</p></div><fieldset><legend>Identity</legend><div class="sheet-grid"><label>Class<input id="sheet-class" value="${esc(sheet.class || '')}"></label><label>Race<input id="sheet-race" value="${esc(sheet.race || '')}"></label><label>Level<input id="sheet-level" type="number" min="1" max="20" value="${esc(sheet.level || 1)}"></label><label>Proficiency bonus<input id="sheet-prof" type="number" min="0" value="${esc(sheet.proficiency_bonus ?? 2)}"></label><label>Portrait<select id="sheet-portrait"><option value="">No portrait</option>${portraits.map(asset=>`<option value="${asset.id}" ${asset.id === character.portrait_asset_id ? 'selected' : ''}>${esc(asset.label)}</option>`).join('')}</select></label></div></fieldset><fieldset><legend>Abilities</legend><div class="ability-editor">${[['str','Strength'],['dex','Dexterity'],['con','Constitution'],['int','Intelligence'],['wis','Wisdom'],['cha','Charisma']].map(([key,label])=>`<label>${label}<input data-ability="${key}" type="number" min="1" max="30" value="${esc(abilities[key] ?? 10)}"><small>${abilityModifier(abilities[key] ?? 10) >= 0 ? '+' : ''}${abilityModifier(abilities[key] ?? 10)}</small></label>`).join('')}</div></fieldset><fieldset><legend>Defence & movement</legend><div class="sheet-grid"><label>Current HP<input id="sheet-hp-current" type="number" min="0" value="${esc(character.hp_current ?? 0)}"></label><label>Maximum HP<input id="sheet-hp-max" type="number" min="0" value="${esc(character.hp_max ?? 0)}"></label><label>Armour class<input id="sheet-ac" type="number" min="0" value="${esc(sheet.armor_class ?? 10)}"></label><label>Speed (ft.)<input id="sheet-speed" type="number" min="1" value="${esc(sheet.speed ?? 30)}"></label><label>Senses / vision (ft.)<input id="sheet-vision" type="number" min="1" value="${esc(sheet.vision ?? 30)}"></label><label>Hit dice<input id="sheet-hit-dice" value="${esc(sheet.hit_dice || '')}" placeholder="3d10"></label></div></fieldset><fieldset><legend>Proficiencies & features</legend><div class="sheet-grid"><label>Saving throw proficiencies<input id="sheet-saves" value="${esc(listValue(sheet.saves))}" placeholder="str, con"></label><label>Skill proficiencies<input id="sheet-skills" value="${esc(listValue(sheet.skills))}" placeholder="Athletics, Perception"></label><label>Other proficiencies<textarea id="sheet-proficiencies" rows="3">${esc(listValue(sheet.proficiencies))}</textarea></label><label>Features<textarea id="sheet-features" rows="3">${esc(listValue(sheet.features))}</textarea></label></div></fieldset><fieldset><legend>Primary attack & spellcasting</legend><div class="sheet-grid"><label>Attack name<input id="sheet-attack-name" value="${esc(firstAttack.name || '')}" placeholder="Longsword"></label><label>Attack bonus<input id="sheet-attack-bonus" type="number" value="${esc(firstAttack.bonus ?? 0)}"></label><label>Damage dice<input id="sheet-attack-damage" value="${esc(firstAttack.damage_dice || firstAttack.damage || '1d6')}" placeholder="1d8+3"></label><label>Damage type<input id="sheet-attack-type" value="${esc(firstAttack.damage_type || '')}" placeholder="slashing"></label><label>Spellcasting ability<select id="sheet-spell-ability"><option value="">None</option>${['int','wis','cha'].map(key=>`<option value="${key}" ${sheet.spellcasting?.ability === key ? 'selected' : ''}>${key.toUpperCase()}</option>`).join('')}</select></label><label>Spell slots<input id="sheet-slots" value="${esc(listValue(sheet.spellcasting?.slots))}" placeholder="4, 2, 0"></label></div></fieldset><fieldset><legend>Equipment & resources</legend><div class="sheet-grid"><label>Equipment<textarea id="sheet-equipment" rows="3">${esc(listValue(sheet.equipment))}</textarea></label><label>Limited resources<textarea id="sheet-resources" rows="3">${esc(listValue(sheet.resources))}</textarea></label><label>Gold pieces<input id="sheet-gp" type="number" min="0" step="0.01" value="${esc(currency.gp ?? 0)}"></label><label>Conditions<input id="sheet-conditions" value="${esc(listValue(sheet.conditions))}" placeholder="Poisoned, Prone"></label></div></fieldset><fieldset><legend>Roleplay & notes</legend><label>Personality<textarea id="sheet-personality" rows="3">${esc(sheet.personality || '')}</textarea></label><label>Notes<textarea id="sheet-notes" rows="5" placeholder="Appearance, goals, reminders…">${esc(sheet.notes || '')}</textarea></label></fieldset><button>Save sheet</button></form>`;
    showModal(dialog);
    dialog.querySelector('#character-sheet-form').onsubmit = async e => {
      e.preventDefault();
      const list = selector => dialog.querySelector(selector).value.split(',').map(value=>value.trim()).filter(Boolean);
      const nextAbilities = Object.fromEntries([...dialog.querySelectorAll('[data-ability]')].map(input=>[input.dataset.ability,Number(input.value)]));
      const nextSheet = { ...sheet, class:dialog.querySelector('#sheet-class').value.trim(),race:dialog.querySelector('#sheet-race').value.trim(),level:Number(dialog.querySelector('#sheet-level').value) || 1,proficiency_bonus:Number(dialog.querySelector('#sheet-prof').value) || 0,abilities:nextAbilities,armor_class:Number(dialog.querySelector('#sheet-ac').value) || 0,speed:Math.max(1,Number(dialog.querySelector('#sheet-speed').value) || 30),vision:Math.max(1,Number(dialog.querySelector('#sheet-vision').value) || 30),hit_dice:dialog.querySelector('#sheet-hit-dice').value.trim(),saves:list('#sheet-saves'),skills:list('#sheet-skills'),proficiencies:list('#sheet-proficiencies'),features:list('#sheet-features'),equipment:list('#sheet-equipment'),resources:list('#sheet-resources'),currency:{...currency,gp:Number(dialog.querySelector('#sheet-gp').value) || 0},conditions:list('#sheet-conditions'),personality:dialog.querySelector('#sheet-personality').value.trim(),notes:dialog.querySelector('#sheet-notes').value.trim(),spellcasting:{...(sheet.spellcasting || {}),ability:dialog.querySelector('#sheet-spell-ability').value || null,slots:list('#sheet-slots').map(Number)}};
      const attackName=dialog.querySelector('#sheet-attack-name').value.trim(); nextSheet.attacks=attackName ? [{name:attackName,bonus:Number(dialog.querySelector('#sheet-attack-bonus').value) || 0,damage_dice:dialog.querySelector('#sheet-attack-damage').value.trim() || '1',damage_type:dialog.querySelector('#sheet-attack-type').value.trim()}] : []; nextSheet.attack=attackName ? {name:attackName,bonus:nextSheet.attacks[0].bonus,damage:Math.max(1,Number.parseInt(nextSheet.attacks[0].damage_dice,10) || 1)} : null;
      const { error: updateError } = await db.client.rpc('update_roll30_character_sheet',{target_character:character.id,expected_revision:character.sheet_revision || 0,next_sheet:nextSheet,target_hp_current:Number(dialog.querySelector('#sheet-hp-current').value),target_hp_max:Number(dialog.querySelector('#sheet-hp-max').value),target_portrait:dialog.querySelector('#sheet-portrait').value || null});
      if (updateError) return notice(updateError.message, true);
      dialog.close(); dialog.classList.remove('sheet-dialog'); notice('Character sheet saved.'); render('characters');
    };
  }
  async function openNoteDialog(noteId = null) {
    const [{ data: members = [] }, noteResult] = await Promise.all([
      db.client.from('campaign_members').select('user_id,role,profiles(display_name)').eq('campaign_id',campaignId).eq('role','player'),
      noteId ? db.client.from('campaign_notes').select('*').eq('id',noteId).single() : Promise.resolve({data:null})
    ]);
    if (noteResult.error) return notice(noteResult.error.message,true);
    const note = noteResult.data || {kind:'note',title:'',body:'',folder:'',tags:[],audience:[],hidden:true};
    const dialog = document.getElementById('live-dialog');
    dialog.innerHTML = `<form method="dialog" id="note-form"><h3>${noteId ? 'Edit' : 'New'} campaign entry</h3><label>Title<input id="note-title" value="${esc(note.title)}" required></label><label>Type<select id="note-kind"><option value="note" ${note.kind === 'note' ? 'selected' : ''}>Note</option><option value="handout" ${note.kind === 'handout' ? 'selected' : ''}>Handout</option><option value="lore" ${note.kind === 'lore' ? 'selected' : ''}>Lore</option><option value="rule" ${note.kind === 'rule' ? 'selected' : ''}>Custom rule</option></select></label><label>Folder<input id="note-folder" value="${esc(note.folder || '')}" placeholder="Optional"></label><label>Tags<input id="note-tags" value="${esc((note.tags || []).join(', '))}" placeholder="places, factions, rules"></label><label>Entry<textarea id="note-body" rows="7">${esc(note.body)}</textarea></label><label>Audience<select id="note-audience" multiple size="${Math.min(5,Math.max(2,members.length))}"><option value="">Everyone at the table</option>${members.map(member=>`<option value="${member.user_id}" ${(note.audience || []).includes(member.user_id) ? 'selected' : ''}>${esc(member.profiles?.display_name || 'Player')}</option>`).join('')}</select></label><label><input id="note-hidden" type="checkbox" ${note.hidden ? 'checked' : ''}> Keep GM-only until revealed</label><button>Save entry</button></form>`;
    showModal(dialog);
    dialog.querySelector('#note-form').onsubmit = async e => {
      e.preventDefault();
      const audience = [...dialog.querySelector('#note-audience').selectedOptions].map(option=>option.value).filter(Boolean);
      const row = {title:dialog.querySelector('#note-title').value.trim(),kind:dialog.querySelector('#note-kind').value,folder:dialog.querySelector('#note-folder').value.trim() || null,tags:dialog.querySelector('#note-tags').value.split(',').map(tag=>tag.trim()).filter(Boolean),audience,body:dialog.querySelector('#note-body').value.trim(),hidden:dialog.querySelector('#note-hidden').checked};
      const result = noteId ? await db.client.from('campaign_notes').update(row).eq('id',noteId) : await db.client.from('campaign_notes').insert({...row,campaign_id:campaignId,created_by:session.user.id});
      const { error } = result;
      if (error) return notice(error.message,true);
      dialog.close(); notice(noteId ? 'Campaign entry updated.' : 'Campaign entry saved.'); render('notes');
    };
  }
  async function openSceneConfig(sceneId) {
    const [{ data: scene, error }, { data: assets = [] }] = await Promise.all([
      db.client.from('scenes').select('*').eq('id',sceneId).single(),
      db.client.from('campaign_assets').select('id,label,kind').eq('campaign_id',campaignId).eq('kind','image').order('created_at',{ascending:false})
    ]);
    if (error) return notice(error.message,true);
    const dialog = document.getElementById('live-dialog'); const config = scene.config || {};
    dialog.innerHTML = `<form method="dialog" id="scene-config-form"><h3>Configure scene</h3><label>Scene name<input id="scene-name" value="${esc(scene.name)}" maxlength="120" required></label><label>Scene type<select id="scene-type"><option value="playing" ${scene.scene_type === 'playing' ? 'selected' : ''}>Playing field</option><option value="battle" ${scene.scene_type === 'battle' ? 'selected' : ''}>Battle field</option></select></label><label>Folder<input id="scene-folder" value="${esc(scene.folder || '')}" placeholder="Optional"></label><label>Background image<select id="scene-background"><option value="">Grid only</option>${assets.map(a=>`<option value="${a.id}" ${a.id === scene.background_asset_id ? 'selected' : ''}>${esc(a.label || 'Image')}</option>`).join('')}</select></label><label><input id="scene-grid" type="checkbox" ${config.show_grid !== false ? 'checked' : ''}> Show grid</label><button>Save scene</button></form>`;
    showModal(dialog);
    dialog.querySelector('#scene-config-form').onsubmit = async e => { e.preventDefault(); const background = dialog.querySelector('#scene-background').value || null; const { error:updateError } = await db.client.from('scenes').update({name:dialog.querySelector('#scene-name').value.trim(),scene_type:dialog.querySelector('#scene-type').value,folder:dialog.querySelector('#scene-folder').value.trim() || null,background_asset_id:background,config:{...config,show_grid:dialog.querySelector('#scene-grid').checked}}).eq('id',scene.id); if(updateError) return notice(updateError.message,true); dialog.close(); notice('Scene settings saved.'); render('scenes'); };
  }
  function openObjectDialog(sceneId) {
    const dialog = document.getElementById('live-dialog');
    dialog.innerHTML = `<form method="dialog" id="object-form"><h3>Interactive object</h3><input id="object-name" placeholder="Name" required><select id="object-type"><option value="object">Object</option><option value="door">Door</option><option value="lever">Lever</option><option value="trap">Trap</option><option value="light">Light</option><option value="wall">Wall</option></select><label>X position<input id="object-x" type="number" min="0" max="100" value="50"></label><label>Y position<input id="object-y" type="number" min="0" max="100" value="50"></label><label>Light radius<input id="object-radius" type="number" min="1" max="100" value="20"></label><label>Wall end X<input id="object-x2" type="number" min="0" max="100" value="60"></label><label>Wall end Y<input id="object-y2" type="number" min="0" max="100" value="50"></label><button>Add object</button></form>`;
    showModal(dialog);
    dialog.querySelector('#object-form').onsubmit = async e => { e.preventDefault(); const type=dialog.querySelector('#object-type').value; const config=type === 'wall' ? {x2:Number(dialog.querySelector('#object-x2').value),y2:Number(dialog.querySelector('#object-y2').value)} : type === 'light' ? {radius:Number(dialog.querySelector('#object-radius').value) || 20} : {}; const { error } = await db.client.from('scene_objects').insert({scene_id:sceneId,name:dialog.querySelector('#object-name').value.trim(),object_type:type,x:Number(dialog.querySelector('#object-x').value),y:Number(dialog.querySelector('#object-y').value),config}); if(error) return notice(error.message,true); dialog.close(); render('session'); };
  }
  async function openAttackDialog(attackerId) {
    const { data: targets = [], error } = await db.client.from('characters').select('id,name,hp_current,hp_max').eq('campaign_id',campaignId).neq('id',attackerId).order('name');
    if (error) return notice(error.message,true);
    const dialog = document.getElementById('live-dialog');
    dialog.innerHTML = `<form method="dialog" id="attack-form"><h3>Choose attack target</h3><select id="attack-target">${targets.map(t=>`<option value="${t.id}">${esc(t.name)} (${esc(t.hp_current)} HP)</option>`).join('')}</select><button ${targets.length ? '' : 'disabled'}>Roll attack</button></form>`;
    showModal(dialog);
    dialog.querySelector('#attack-form').onsubmit = async e => { e.preventDefault(); const { data, error:attackError } = await db.client.rpc('resolve_roll30_attack',{attacker_id:attackerId,target_id:dialog.querySelector('#attack-target').value}); if(attackError) return notice(attackError.message,true); dialog.close(); notice(data.hit ? `${data.attack} hit ${data.target} for ${data.damage} damage (${data.total}).` : `${data.attack} missed ${data.target} (${data.total}).`); render('characters'); };
  }
  function startRealtime() {
    if (realtimeStarted) return; realtimeStarted = true;
    const channel = db.client.channel(`roll30-live-${campaignId}`, {config:{presence:{key:session.user.id}}})
      .on('presence',{event:'sync'},() => { onlineCount = Object.keys(channel.presenceState()).length; if (currentView === 'overview') render('overview'); })
      .on('postgres_changes',{event:'*',schema:'public',table:'sessions',filter:`campaign_id=eq.${campaignId}`},() => currentView === 'session' ? render('session') : notice('Live session updated.'))
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:`campaign_id=eq.${campaignId}`},() => currentView === 'messages' ? render('messages') : notice('New table message.'))
      .on('postgres_changes',{event:'*',schema:'public',table:'characters',filter:`campaign_id=eq.${campaignId}`},() => ['characters','session','inventory'].includes(currentView) ? render(currentView) : notice('Character state updated.'))
      .on('postgres_changes',{event:'*',schema:'public',table:'prompts',filter:`campaign_id=eq.${campaignId}`},() => currentView === 'prompts' ? render('prompts') : notice('Player prompts updated.'))
      .on('postgres_changes',{event:'*',schema:'public',table:'prompt_responses'},() => { if (currentView === 'prompts') render('prompts'); })
      .on('postgres_changes',{event:'*',schema:'public',table:'scene_objects'},() => { if (currentView === 'session') render('session'); })
      .on('postgres_changes',{event:'*',schema:'public',table:'purchase_requests'},() => { if (['shops','purchases','inventory'].includes(currentView)) render(currentView); });
    channel.subscribe(status => { if (status === 'SUBSCRIBED') channel.track({user_id:session.user.id}); });
  }
  document.addEventListener('DOMContentLoaded', () => { ensurePrivateAccess().then(load).catch(error => { app.innerHTML = `<main class="startup-state"><section class="error-panel" role="alert"><h2>Roll30 could not load</h2><p>${esc(error.message)}</p><a class="button primary" href="./index.html">Return to campaigns</a></section></main>`; }); });
})();
