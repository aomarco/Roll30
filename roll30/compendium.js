import { addDialogActions, escapeHtml } from './ui.js';

const categories = {
  monsters: { label:'Monsters', file:'5e-SRD-Monsters.json' },
  spells: { label:'Spells', file:'5e-SRD-Spells.json' },
  equipment: { label:'Equipment', file:'5e-SRD-Equipment.json' },
  classes: { label:'Classes', file:'5e-SRD-Classes.json' },
  races: { label:'Races', file:'5e-SRD-Races.json' },
  conditions: { label:'Conditions', file:'5e-SRD-Conditions.json' }
};

const cache = new Map();

async function loadCategory(category) {
  if (cache.has(category)) return cache.get(category);
  const response = await fetch(`./DND%205E%20Data/${categories[category].file}`);
  if (!response.ok) throw new Error(`Could not load ${categories[category].label.toLowerCase()} (${response.status}).`);
  const records = await response.json();
  cache.set(category, records);
  return records;
}

function armorClass(monster) {
  const value = Array.isArray(monster.armor_class) ? monster.armor_class[0]?.value : monster.armor_class;
  return value ?? '—';
}

function summary(category, record) {
  if (category === 'monsters') return `CR ${record.challenge_rating ?? '—'} · AC ${armorClass(record)} · ${record.hit_points ?? '—'} HP · ${record.type || 'creature'}`;
  if (category === 'spells') return `Level ${record.level ?? 0} · ${record.school?.name || 'magic'} · ${record.casting_time || 'casting time unknown'}`;
  if (category === 'equipment') return `${record.equipment_category?.name || 'Equipment'}${record.cost ? ` · ${record.cost.quantity} ${record.cost.unit}` : ''}`;
  if (category === 'classes') return `Hit die d${record.hit_die || '—'} · ${(record.proficiencies || []).length} proficiencies`;
  if (category === 'races') return `Speed ${record.speed || '—'} ft. · ${record.size || 'size unknown'}`;
  return (record.desc || []).join(' ').slice(0, 150) || 'Rules reference';
}

function filterValue(category, record) {
  if (category === 'monsters') return record.type || '';
  if (category === 'spells') return `Level ${record.level ?? 0}`;
  if (category === 'equipment') return record.equipment_category?.name || '';
  return '';
}

function description(record) {
  const fields = [record.desc, record.higher_level, record.traits?.map(item => `${item.name}: ${(item.desc || []).join(' ')}`), record.actions?.map(item => `${item.name}: ${item.desc || ''}`)];
  return fields.flat(2).filter(Boolean).join('\n\n') || 'No extended description is included in this SRD record.';
}

function monsterSheet(record) {
  const action = (record.actions || []).find(item => item.attack_bonus != null) || record.actions?.[0];
  const damage = action?.damage?.[0];
  return {
    source:'SRD 5.1', srd_index:record.index, race:record.type || 'creature', class:record.subtype || '', level:1,
    proficiency_bonus:record.proficiency_bonus || 2,
    abilities:{str:record.strength || 10,dex:record.dexterity || 10,con:record.constitution || 10,int:record.intelligence || 10,wis:record.wisdom || 10,cha:record.charisma || 10},
    armor_class:armorClass(record), speed:Number.parseInt(record.speed?.walk,10) || 30, vision:60,
    saves:[], skills:(record.proficiencies || []).map(entry=>entry.proficiency?.name || entry.name).filter(Boolean), proficiencies:(record.languages || '').split(',').map(value=>value.trim()).filter(Boolean),
    features:(record.special_abilities || []).map(item=>`${item.name}: ${item.desc}`), conditions:[], equipment:[], resources:[], currency:{gp:0},
    attacks:action ? [{name:action.name,bonus:action.attack_bonus || 0,damage_dice:damage?.damage_dice || '1',damage_type:damage?.damage_type?.name || ''}] : [],
    attack:action ? {name:action.name,bonus:action.attack_bonus || 0,damage:Math.max(1,Number.parseInt(damage?.damage_dice,10) || 1)} : null,
    notes:description(record)
  };
}

export function compendiumView() {
  const options = Object.entries(categories).map(([value, category]) => `<option value="${value}">${escapeHtml(category.label)}</option>`).join('');
  return `<section><div class="live-title"><div><h2>5e compendium</h2><p class="muted">Search the bundled SRD one category at a time. Open a record for details or copy it into this campaign.</p></div></div><div class="compendium-controls"><label>Category<select id="compendium-category">${options}</select></label><label>Search<input id="compendium-search" type="search" placeholder="Search by name"></label><label>Filter<select id="compendium-filter"><option value="">All</option></select></label></div><p id="compendium-count" class="muted" role="status"></p><div id="compendium-results" class="live-cards" aria-busy="true"></div><button id="compendium-more" class="button quiet" type="button" hidden>Show more</button><p class="attribution">SRD 5.1 reference data · see <a href="./SRD_ATTRIBUTION.md" target="_blank" rel="noopener">source and attribution</a>.</p></section>`;
}

export function bindCompendium({ app, db, campaignId, role, notice }) {
  const categorySelect = app.querySelector('#compendium-category');
  const searchInput = app.querySelector('#compendium-search');
  const filterSelect = app.querySelector('#compendium-filter');
  const results = app.querySelector('#compendium-results');
  const count = app.querySelector('#compendium-count');
  const more = app.querySelector('#compendium-more');
  if (!categorySelect || !results) return;
  let records = [];
  let shown = 0;

  const openDetails = record => {
    const dialog = app.querySelector('#live-dialog');
    const importable = role === 'gm' && ['monsters','spells','equipment'].includes(categorySelect.value);
    dialog.innerHTML = `<form method="dialog" id="compendium-detail"><h3>${escapeHtml(record.name)}</h3><p class="muted">${escapeHtml(summary(categorySelect.value,record))}</p><div class="compendium-description">${escapeHtml(description(record)).replaceAll('\n','<br>')}</div>${importable ? '<button>Copy to campaign</button>' : '<button>Close</button>'}</form>`;
    if (importable) addDialogActions(dialog, 'Copy to campaign');
    else dialog.querySelector('button').classList.add('primary');
    dialog.showModal();
    dialog.querySelector('#compendium-detail').onsubmit = async event => {
      event.preventDefault();
      if (!importable) { dialog.close(); return; }
      const category = categorySelect.value;
      const operation = category === 'monsters'
        ? db.client.from('characters').insert({campaign_id:campaignId,name:record.name,kind:'monster',hp_current:record.hit_points,hp_max:record.hit_points,sheet_schema_version:1,sheet:monsterSheet(record)})
        : db.client.from('items').insert({campaign_id:campaignId,name:record.name,item_data:{type:category === 'spells' ? 'spell' : 'equipment',srd:record}});
      const { error } = await operation;
      if (error) return notice(error.message,true);
      dialog.close(); notice(`${record.name} copied into this campaign.`);
    };
  };

  const renderRecords = reset => {
    const term = searchInput.value.trim().toLowerCase();
    const filter = filterSelect.value;
    const matches = records.filter(record => (!term || record.name.toLowerCase().includes(term)) && (!filter || filterValue(categorySelect.value,record) === filter));
    if (reset) { shown = 0; results.replaceChildren(); }
    const next = matches.slice(shown, shown + 48);
    for (const record of next) {
      const article = document.createElement('article');
      const name = document.createElement('b'); name.textContent = record.name;
      const detail = document.createElement('small'); detail.textContent = summary(categorySelect.value, record);
      const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Open details'; button.addEventListener('click', () => openDetails(record));
      article.append(name, detail, button); results.append(article);
    }
    shown += next.length;
    count.textContent = `${matches.length} ${categories[categorySelect.value].label.toLowerCase()} found${shown < matches.length ? ` · showing ${shown}` : ''}`;
    more.hidden = shown >= matches.length;
    results.setAttribute('aria-busy','false');
    if (!matches.length) results.innerHTML = '<div class="empty-state"><h3>No matching SRD records</h3><p>Try a broader name or clear the category filter.</p></div>';
  };

  const refresh = async () => {
    results.setAttribute('aria-busy','true'); results.innerHTML = '<div class="loading-panel"><span class="loading-line"></span><span class="loading-line"></span><span class="loading-line"></span></div>';
    try {
      records = await loadCategory(categorySelect.value);
      const filters = [...new Set(records.map(record => filterValue(categorySelect.value,record)).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
      filterSelect.innerHTML = `<option value="">All</option>${filters.map(value=>`<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('')}`;
      renderRecords(true);
    } catch (error) {
      results.setAttribute('aria-busy','false'); results.innerHTML = `<section class="error-panel" role="alert"><h3>Compendium could not load</h3><p>${escapeHtml(error.message)}</p></section>`;
    }
  };
  categorySelect.addEventListener('change', refresh);
  searchInput.addEventListener('input', () => renderRecords(true));
  filterSelect.addEventListener('change', () => renderRecords(true));
  more.addEventListener('click', () => renderRecords(false));
  refresh();
}
