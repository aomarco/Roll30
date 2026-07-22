import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Grid3X3, ImageUp, Plus, Swords, Trash2 } from 'lucide-react'
import './styles.css'

const makeToken = (id) => ({ id, name: 'Token', x: 50, y: 50, hp: 10, maxHp: 10, ac: 10, color: ['#c96d58', '#769b79', '#7e83ba', '#bd9a52'][id % 4] })

function App() {
  const [map, setMap] = useState(null)
  const [mode, setMode] = useState('play')
  const [gridSize, setGridSize] = useState(48)
  const [tokens, setTokens] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [draggingId, setDraggingId] = useState(null)
  const [stat, setStat] = useState('hp')
  const [adjustment, setAdjustment] = useState('')
  const [battle, setBattle] = useState(null)
  const [attackMode, setAttackMode] = useState(false)
  const boardRef = useRef(null)
  const selected = tokens.find((token) => token.id === selectedId)
  const activeId = battle?.order[battle.turn]
  const activeToken = tokens.find((token) => token.id === activeId)

  useEffect(() => {
    const move = (event) => {
      if (!draggingId || !boardRef.current) return
      const rect = boardRef.current.getBoundingClientRect()
      const x = Math.max(3, Math.min(97, ((event.clientX - rect.left) / rect.width) * 100))
      const y = Math.max(3, Math.min(97, ((event.clientY - rect.top) / rect.height) * 100))
      setTokens((items) => items.map((token) => token.id === draggingId ? { ...token, x, y } : token))
    }
    const stop = () => setDraggingId(null)
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop) }
  }, [draggingId])

  const resetBattle = () => { setBattle(null); setAttackMode(false) }
  function uploadMap(event) { const file = event.target.files?.[0]; if (file) setMap(URL.createObjectURL(file)) }
  function addToken() { const token = makeToken(Date.now()); setTokens((items) => [...items, token]); setSelectedId(token.id); resetBattle() }
  function updateTokenName(value) { setTokens((items) => items.map((token) => token.id === selectedId ? { ...token, name: value } : token)) }
  function applyAdjustment(event) { event.preventDefault(); const amount = Number(adjustment); if (!selected || !Number.isFinite(amount) || adjustment.trim() === '') return; setTokens((items) => items.map((token) => token.id === selectedId ? { ...token, [stat]: Math.max(0, token[stat] + amount) } : token)); setAdjustment('') }
  function removeToken() { setTokens((items) => items.filter((token) => token.id !== selectedId)); setSelectedId(null); resetBattle() }
  function startBattle() {
    if (tokens.length < 2) return
    const order = [...tokens].map((token) => ({ ...token, initiative: Math.floor(Math.random() * 20) + 1 })).sort((a, b) => b.initiative - a.initiative || a.name.localeCompare(b.name))
    setBattle({ order: order.map((token) => token.id), initiatives: Object.fromEntries(order.map((token) => [token.id, token.initiative])), turn: 0, round: 1, log: 'Initiative rolled. Battle begins!' })
    setSelectedId(order[0].id); setAttackMode(false)
  }
  function simpleAttack(targetId) {
    const target = tokens.find((token) => token.id === targetId)
    if (!activeToken || !target || target.id === activeToken.id || target.hp <= 0 || battle?.complete) return
    const damage = 3
    const updated = tokens.map((token) => token.id === target.id ? { ...token, hp: Math.max(0, token.hp - damage) } : token)
    const alive = updated.filter((token) => token.hp > 0)
    setTokens(updated); setAttackMode(false)
    if (alive.length <= 1) { setBattle({ ...battle, complete: true, log: `${activeToken.name} hits ${target.name} for ${damage} damage. ${alive[0]?.name ?? 'No one'} wins!` }); return }
    let next = (battle.turn + 1) % battle.order.length
    while (updated.find((token) => token.id === battle.order[next])?.hp <= 0) next = (next + 1) % battle.order.length
    const nextToken = updated.find((token) => token.id === battle.order[next])
    setBattle({ ...battle, turn: next, round: next <= battle.turn ? battle.round + 1 : battle.round, log: `${activeToken.name} hits ${target.name} for ${damage} damage.` })
    setSelectedId(nextToken.id)
  }
  function tokenPointerDown(event, token) {
    event.preventDefault()
    if (attackMode && token.id !== activeId && token.hp > 0) simpleAttack(token.id)
    else { setSelectedId(token.id); setDraggingId(token.id) }
  }

  return <div className="app">
    <header><strong>Roll30</strong><span>Simple tabletop board</span><div className="mode-switch"><button className={mode === 'play' ? 'active' : ''} onClick={() => setMode('play')}>Play</button><button className={mode === 'battle' ? 'active' : ''} onClick={() => setMode('battle')}><Swords size={15}/> Battle</button></div></header>
    <main><section className="board-column"><div className="controls"><label className="button"><ImageUp size={17}/> Upload image<input type="file" accept="image/*" onChange={uploadMap}/></label><button className="button" onClick={addToken}><Plus size={17}/> Add token</button>{mode === 'battle' && <><span className="battle-grid"><Grid3X3 size={17}/> Battle grid</span><label className="grid-size">Grid size <input type="range" min="24" max="80" value={gridSize} onChange={(event) => setGridSize(event.target.value)}/></label></>}</div>
      <div ref={boardRef} className={'board ' + (!map ? 'empty' : '')} style={{ backgroundImage: map ? `url(${map})` : undefined, '--grid-size': `${gridSize}px` }}>
        {!map && <div className="empty-message"><ImageUp size={28}/><strong>Upload a map image to begin</strong><span>You can add and move tokens at any time.</span></div>}{mode === 'battle' && <div className="grid"/>}
        {battle && !battle.complete && activeToken && <button className={'map-attack ' + (attackMode ? 'armed' : '')} style={{ left: `${activeToken.x}%`, top: `${activeToken.y}%` }} onPointerDown={(event) => event.stopPropagation()} onClick={() => setAttackMode((armed) => !armed)} aria-label="Attack"><Swords size={16}/></button>}
        {attackMode && <div className="attack-prompt">Choose a token to attack · 3 damage</div>}
        {tokens.map((token) => <button key={token.id} className={'token ' + (selectedId === token.id ? 'selected ' : '') + (attackMode && token.id !== activeId && token.hp > 0 ? 'targetable' : '')} style={{ left: `${token.x}%`, top: `${token.y}%`, '--token-colour': token.color }} onPointerDown={(event) => tokenPointerDown(event, token)} aria-label={token.name}><span>{token.name.slice(0, 2).toUpperCase()}</span><small>{token.name}</small></button>)}
      </div></section>
      <aside className="inspector">{mode === 'battle' && <CombatPanel battle={battle} tokens={tokens} activeId={activeId} activeToken={activeToken} startBattle={startBattle}/>} {selected ? <><div><p>SELECTED TOKEN</p><h1>Token details</h1></div><label>Name<input value={selected.name} onChange={(event) => updateTokenName(event.target.value)} /></label>{mode === 'battle' && <><div className="stats"><div><span>HP</span><strong>{selected.hp}</strong></div><div><span>MAX HP</span><strong>{selected.maxHp}</strong></div><div><span>AC</span><strong>{selected.ac}</strong></div></div><div className="health"><span>Health</span><strong>{selected.hp} / {selected.maxHp}</strong><i><b style={{ width: `${Math.min(100, selected.maxHp ? selected.hp / selected.maxHp * 100 : 0)}%` }}/></i></div><form className="calculator" onSubmit={applyAdjustment}><label>Adjust stat<select value={stat} onChange={(event) => setStat(event.target.value)}><option value="hp">HP</option><option value="maxHp">Max HP</option><option value="ac">AC</option></select></label><label>Amount<input value={adjustment} onChange={(event) => setAdjustment(event.target.value)} placeholder="e.g. +3 or -4" /></label><button className="button" type="submit">Apply</button></form></>}<button className="remove" onClick={removeToken}><Trash2 size={16}/> Remove token</button></> : <div className="no-selection"><p>NO TOKEN SELECTED</p><h1>Add a token</h1><span>Select a token on the board to edit its name{mode === 'battle' ? ' and battle stats' : ''}.</span><button className="button" onClick={addToken}><Plus size={17}/> Add token</button></div>}</aside></main>
  </div>
}

function CombatPanel({ battle, tokens, activeId, activeToken, startBattle }) {
  if (!battle) return <section className="combat-panel"><p>COMBAT</p><h1>Ready to battle</h1><span>Roll initiative and begin turn order.</span><button className="start-battle" onClick={startBattle} disabled={tokens.length < 2}><Swords size={16}/> Start battle</button>{tokens.length < 2 && <small>Add at least two tokens first.</small>}</section>
  return <section className="combat-panel"><div className="combat-heading"><div><p>{battle.complete ? 'BATTLE COMPLETE' : `ROUND ${battle.round}`}</p><h1>{battle.complete ? 'Battle finished' : `${activeToken?.name}'s turn`}</h1></div>{!battle.complete && <span className="turn-dot"/>}</div><ol className="initiative">{battle.order.map((id, index) => { const token = tokens.find((item) => item.id === id); return token && <li key={id} className={(id === activeId && !battle.complete ? 'current ' : '') + (token.hp <= 0 ? 'down' : '')}><span>{index + 1}</span><strong>{token.name}</strong><em>{battle.initiatives[id]}</em></li> })}</ol><p className="combat-log">{battle.log}</p>{!battle.complete && <span className="attack-help">Use the sword beside the active token to attack.</span>}{battle.complete && <button className="button" onClick={startBattle}>Roll initiative again</button>}</section>
}

createRoot(document.getElementById('root')).render(<App />)
