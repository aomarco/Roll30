export const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[character]));

const labels = {
  overview: 'Campaign home',
  session: 'Live table',
  messages: 'Messages & dice',
  prompts: 'Player prompts',
  scenes: 'Scenes',
  builder: 'Scene builder',
  templates: 'Scene templates',
  characters: 'Characters',
  compendium: '5e compendium',
  media: 'Media & handouts',
  items: 'Items',
  inventory: 'Inventory',
  shops: 'Shops',
  purchases: 'Purchase requests',
  notes: 'Notes & lore',
  automation: 'Automation',
  history: 'Session history',
  settings: 'Campaign settings'
};

const gmNavigation = [
  ['Play', ['overview', 'session', 'messages', 'prompts']],
  ['Prepare', ['scenes', 'templates', 'characters', 'compendium', 'media']],
  ['World', ['items', 'inventory', 'shops', 'purchases', 'notes', 'automation', 'history']],
  ['Campaign', ['settings']]
];

const playerNavigation = [
  ['Play', ['overview', 'session', 'messages', 'prompts']],
  ['Your character', ['characters', 'inventory']],
  ['Reference', ['compendium', 'notes', 'shops']]
];

const emptyCopy = {
  scenes: ['No scenes prepared', 'Create the first location your table can explore or fight in.'],
  templates: ['No scene templates', 'Save a prepared scene as a reusable starting point.'],
  characters: ['No characters yet', 'Add a player character, NPC, or monster when you are ready.'],
  messages: ['The table is quiet', 'Messages, whispers, and dice results will appear here.'],
  prompts: ['No open prompts', 'Questions and requested player decisions will appear here.'],
  shops: ['No shops in this campaign', 'A GM can create a shop and stock it with campaign items.'],
  items: ['No campaign items', 'Create an item or import one from the 5e compendium.'],
  inventory: ['Nothing carried yet', 'Purchased and assigned items will appear with their character.'],
  notes: ['No shared lore yet', 'Campaign notes, handouts, lore, and custom rules live here.'],
  history: ['No recorded actions', 'Session events will build a recovery-friendly timeline here.'],
  purchases: ['No purchase requests', 'Pending and resolved player purchases will appear here.'],
  automation: ['No automation rules', 'Create a scene first, then add a constrained table rule.'],
  media: ['No campaign media', 'Upload an image, audio track, or PDF handout when you need one.']
};

export function cards(rows, renderCard, view, role) {
  if (rows.length) return `<div class="live-cards">${rows.map(row => `<article>${renderCard(row)}</article>`).join('')}</div>`;
  const [title, description] = emptyCopy[view] || ['Nothing here yet', role === 'gm' ? 'Use the primary action above when you are ready to add something.' : 'Your GM has not shared anything here yet.'];
  return `<div class="empty-state"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p></div>`;
}

export function loadingPanel() {
  return '<div class="loading-panel" aria-label="Loading view"><span class="loading-line"></span><span class="loading-line"></span><span class="loading-line"></span></div>';
}

export function errorPanel(message) {
  return `<section class="error-panel" role="alert"><h2>This part of the table could not load</h2><p>${escapeHtml(message)}</p><button class="primary" data-retry-view>Try again</button></section>`;
}

export function shell({ campaign, role, currentView }) {
  const navigation = role === 'gm' ? gmNavigation : playerNavigation;
  const groups = navigation.map(([group, views]) => `
    <section class="nav-group" aria-labelledby="nav-${group.toLowerCase().replaceAll(' ', '-')}">
      <p class="nav-label" id="nav-${group.toLowerCase().replaceAll(' ', '-')}">${escapeHtml(group)}</p>
      ${views.map(view => `<button data-view="${view}" class="${view === currentView ? 'active' : ''}" ${view === currentView ? 'aria-current="page"' : ''}>${escapeHtml(labels[view])}</button>`).join('')}
    </section>`).join('');
  return `
    <div class="app-shell">
      <header class="topbar">
        <button class="nav-toggle" id="nav-toggle" type="button" aria-controls="app-navigation" aria-expanded="false" aria-label="Open navigation">☰</button>
        <div class="brand-mark" aria-hidden="true">R</div>
        <div class="brand-copy"><strong>Roll30</strong><span>${escapeHtml(campaign.name)}</span></div>
        <div class="topbar-actions">
          <span class="role-badge">${role === 'gm' ? 'Game Master' : 'Player'}</span>
          <button class="button quiet" id="leave-campaign" type="button">Campaigns</button>
        </div>
      </header>
      <nav class="sidebar" id="app-navigation" aria-label="Campaign navigation">${groups}</nav>
      <main class="workspace" tabindex="-1">
        <div class="workspace-inner">
          <p id="live-notice" role="status"></p>
          <div id="live-content" aria-busy="true">${loadingPanel()}</div>
        </div>
      </main>
      <dialog id="live-dialog" aria-modal="true"></dialog>
    </div>`;
}

export function addDialogActions(dialog, submitLabel) {
  const form = dialog.querySelector('form');
  if (!form) return;
  const submit = form.querySelector('button:not([type="button"])');
  if (!submit) return;
  submit.textContent = submitLabel || submit.textContent;
  submit.classList.add('primary');
  const actions = document.createElement('div');
  actions.className = 'dialog-actions';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', () => dialog.close());
  submit.replaceWith(actions);
  actions.append(cancel, submit);
}
