import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Grid3X3, ImageUp, Plus, Trash2 } from 'lucide-react'
import './styles.css'

const makeToken = (id) => ({ id, name: 'Token', x: 50, y: 50, hp: 10, maxHp: 10, ac: 10, color: ['#c96d58', '#769b79', '#7e83ba', '#bd9a52'][id % 4] })

function App() {
  const [map, setMap] = useState(null)
  const [showGrid, setShowGrid] = useState(true)
  const [gridSize, setGridSize] = useState(48)
  const [tokens, setTokens] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [draggingId, setDraggingId] = useState(null)
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
  function updateToken(key, value) {
    setTokens((items) => items.map((token) => token.id === selectedId ? { ...token, [key]: key === 'name' ? value : Math.max(0, Number(value)) } : token))
  }
  function removeToken() {
    setTokens((items) => items.filter((token) => token.id !== selectedId))
    setSelectedId(null)
  }

  return <div className="app">
    <header><strong>Roll30</strong><span>Simple tabletop board</span></header>
    <main>
      <section className="board-column">
        <div className="controls">
          <label className="button"><ImageUp size={17}/> Upload image<input type="file" accept="image/*" onChange={uploadMap}/></label>
          <button className="button" onClick={addToken}><Plus size={17}/> Add token</button>
          <label className="grid-toggle"><Grid3X3 size={17}/><input type="checkbox" checked={showGrid} onChange={(event) => setShowGrid(event.target.checked)}/> Show grid</label>
          <label className="grid-size">Grid size <input type="range" min="24" max="80" value={gridSize} onChange={(event) => setGridSize(event.target.value)}/></label>
        </div>
        <div ref={boardRef} className={'board ' + (!map ? 'empty' : '')} style={{ backgroundImage: map ? `url(${map})` : undefined, '--grid-size': `${gridSize}px` }}>
          {!map && <div className="empty-message"><ImageUp size={28}/><strong>Upload a map image to begin</strong><span>You can add and move tokens at any time.</span></div>}
          {showGrid && <div className="grid"/>}
          {tokens.map((token) => <button key={token.id} className={'token ' + (selectedId === token.id ? 'selected' : '')} style={{ left: `${token.x}%`, top: `${token.y}%`, '--token-colour': token.color }} onPointerDown={(event) => { event.preventDefault(); setSelectedId(token.id); setDraggingId(token.id) }} aria-label={token.name}><span>{token.name.slice(0, 2).toUpperCase()}</span><small>{token.name}</small></button>)}
        </div>
      </section>
      <aside className="inspector">
        {selected ? <>
          <div><p>SELECTED TOKEN</p><h1>Token details</h1></div>
          <label>Name<input value={selected.name} onChange={(event) => updateToken('name', event.target.value)} /></label>
          <div className="stats">
            <label>HP<input type="number" value={selected.hp} onChange={(event) => updateToken('hp', event.target.value)} /></label>
            <label>Max HP<input type="number" value={selected.maxHp} onChange={(event) => updateToken('maxHp', event.target.value)} /></label>
            <label>AC<input type="number" value={selected.ac} onChange={(event) => updateToken('ac', event.target.value)} /></label>
          </div>
          <div className="health"><span>Health</span><strong>{selected.hp} / {selected.maxHp}</strong><i><b style={{ width: `${Math.min(100, selected.maxHp ? selected.hp / selected.maxHp * 100 : 0)}%` }}/></i></div>
          <button className="remove" onClick={removeToken}><Trash2 size={16}/> Remove token</button>
        </> : <div className="no-selection"><p>NO TOKEN SELECTED</p><h1>Add a token</h1><span>Select a token on the board to edit its name and stats.</span><button className="button" onClick={addToken}><Plus size={17}/> Add token</button></div>}
      </aside>
    </main>
  </div>
}

createRoot(document.getElementById('root')).render(<App />)
