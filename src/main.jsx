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
  const boardRef = useRef(null)
  const selected = tokens.find((token) => token.id === selectedId)

  useEffect(() => {
    const move = (event) => {
      if (!draggingId || !boardRef.current) return
      const rect = boardRef.current.getBoundingClientRect()
      const x = Math.max(3, Math.min(97, ((event.clientX - rect.left) / rect.width) * 100))
      const y = Math.max(3, Math.min(97, ((event.clientY - rect.top) / rect.height) * 100))
      setTokens((items) => items.map((token) => token.id === draggingId ? { ...token, x, y } : token))
    }
    const stop = () => setDraggingId(null)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop) }
  }, [draggingId])

  function uploadMap(event) {
    const file = event.target.files?.[0]
    if (file) setMap(URL.createObjectURL(file))
  }
  function addToken() {
    const token = makeToken(Date.now())
    setTokens((items) => [...items, token])
    setSelectedId(token.id)
  }
  function updateTokenName(value) {
    setTokens((items) => items.map((token) => token.id === selectedId ? { ...token, name: value } : token))
  }
  function applyAdjustment(event) {
    event.preventDefault()
    const amount = Number(adjustment)
    if (!selected || !Number.isFinite(amount) || adjustment.trim() === '') return
    setTokens((items) => items.map((token) => token.id === selectedId ? { ...token, [stat]: Math.max(0, token[stat] + amount) } : token))
    setAdjustment('')
  }
  function removeToken() {
    setTokens((items) => items.filter((token) => token.id !== selectedId))
    setSelectedId(null)
  }

  return <div className="app">
    <header><strong>Roll30</strong><span>Simple tabletop board</span><div className="mode-switch"><button className={mode === 'play' ? 'active' : ''} onClick={() => setMode('play')}>Play</button><button className={mode === 'battle' ? 'active' : ''} onClick={() => setMode('battle')}><Swords size={15}/> Battle</button></div></header>
    <main>
      <section className="board-column">
        <div className="controls">
          <label className="button"><ImageUp size={17}/> Upload image<input type="file" accept="image/*" onChange={uploadMap}/></label>
          <button className="button" onClick={addToken}><Plus size={17}/> Add token</button>
          {mode === 'battle' && <><span className="battle-grid"><Grid3X3 size={17}/> Battle grid</span><label className="grid-size">Grid size <input type="range" min="24" max="80" value={gridSize} onChange={(event) => setGridSize(event.target.value)}/></label></>}
        </div>
        <div ref={boardRef} className={'board ' + (!map ? 'empty' : '')} style={{ backgroundImage: map ? `url(${map})` : undefined, '--grid-size': `${gridSize}px` }}>
          {!map && <div className="empty-message"><ImageUp size={28}/><strong>Upload a map image to begin</strong><span>You can add and move tokens at any time.</span></div>}
          {mode === 'battle' && <div className="grid"/>}
          {tokens.map((token) => <button key={token.id} className={'token ' + (selectedId === token.id ? 'selected' : '')} style={{ left: `${token.x}%`, top: `${token.y}%`, '--token-colour': token.color }} onPointerDown={(event) => { event.preventDefault(); setSelectedId(token.id); setDraggingId(token.id) }} aria-label={token.name}><span>{token.name.slice(0, 2).toUpperCase()}</span><small>{token.name}</small></button>)}
        </div>
      </section>
      <aside className="inspector">
        {selected ? <>
          <div><p>SELECTED TOKEN</p><h1>Token details</h1></div>
          <label>Name<input value={selected.name} onChange={(event) => updateTokenName(event.target.value)} /></label>
          {mode === 'battle' && <><div className="stats"><div><span>HP</span><strong>{selected.hp}</strong></div><div><span>MAX HP</span><strong>{selected.maxHp}</strong></div><div><span>AC</span><strong>{selected.ac}</strong></div></div>
          <div className="health"><span>Health</span><strong>{selected.hp} / {selected.maxHp}</strong><i><b style={{ width: `${Math.min(100, selected.maxHp ? selected.hp / selected.maxHp * 100 : 0)}%` }}/></i></div>
          <form className="calculator" onSubmit={applyAdjustment}><label>Adjust stat<select value={stat} onChange={(event) => setStat(event.target.value)}><option value="hp">HP</option><option value="maxHp">Max HP</option><option value="ac">AC</option></select></label><label>Amount<input value={adjustment} onChange={(event) => setAdjustment(event.target.value)} placeholder="e.g. +3 or -4" inputMode="text" /></label><button className="button" type="submit">Apply</button></form></>}
          <button className="remove" onClick={removeToken}><Trash2 size={16}/> Remove token</button>
        </> : <div className="no-selection"><p>NO TOKEN SELECTED</p><h1>Add a token</h1><span>Select a token on the board to edit its name{mode === 'battle' ? ' and battle stats' : ''}.</span><button className="button" onClick={addToken}><Plus size={17}/> Add token</button></div>}
      </aside>
    </main>
  </div>
}

createRoot(document.getElementById('root')).render(<App />)
