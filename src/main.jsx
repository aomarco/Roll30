import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { CircleHelp, Crosshair, Grid3X3, ImageUp, Maximize2, Minus, MousePointer2, Plus, Search, Settings2, Shield, Sparkles, Swords, Trash2, Upload, Users, X } from 'lucide-react'
import './styles.css'

const initialTokens = [
  { id: 1, name: 'Ari Thorne', initials: 'AT', color: '#d7825e', x: 28, y: 60, hp: 24, maxHp: 28, ac: 16, speed: 30, kind: 'ally' },
  { id: 2, name: 'Moss', initials: 'M', color: '#84ad7a', x: 50, y: 38, hp: 18, maxHp: 18, ac: 14, speed: 30, kind: 'ally' },
  { id: 3, name: 'Goblin scout', initials: 'G', color: '#836a55', x: 72, y: 48, hp: 7, maxHp: 7, ac: 13, speed: 30, kind: 'enemy' },
]

function App() {
  const [tokens, setTokens] = useState(initialTokens)
  const [selectedId, setSelectedId] = useState(1)
  const [gridSize, setGridSize] = useState(48)
  const [gridVisible, setGridVisible] = useState(true)
  const [zoom, setZoom] = useState(100)
  const [mapImage, setMapImage] = useState(null)
  const [dragging, setDragging] = useState(null)
  const boardRef = useRef(null)
  const selected = tokens.find(t => t.id === selectedId)

  useEffect(() => {
    const move = (event) => {
      if (!dragging || !boardRef.current) return
      const rect = boardRef.current.getBoundingClientRect()
      const x = Math.max(2, Math.min(98, ((event.clientX - rect.left) / rect.width) * 100))
      const y = Math.max(3, Math.min(97, ((event.clientY - rect.top) / rect.height) * 100))
      setTokens(current => current.map(t => t.id === dragging ? { ...t, x, y } : t))
    }
    const up = () => setDragging(null)
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [dragging])

  const updateToken = (key, value) => setTokens(current => current.map(t => t.id === selectedId ? { ...t, [key]: key === 'name' ? value : Number(value) } : t))
  const addToken = () => {
    const id = Date.now()
    setTokens(t => [...t, { id, name: 'New adventurer', initials: 'NA', color: '#9578d0', x: 45, y: 53, hp: 12, maxHp: 12, ac: 12, speed: 30, kind: 'ally' }])
    setSelectedId(id)
  }
  const handleUpload = (e) => { const file = e.target.files?.[0]; if (file) setMapImage(URL.createObjectURL(file)) }

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><Swords size={19}/></div><span>ROLL<span>30</span></span></div>
      <div className="campaign"><span className="status-dot"></span><div><strong>The Sunken Vale</strong><small>Friday night campaign</small></div><Chevron /></div>
      <div className="top-actions"><button className="icon-button"><CircleHelp size={18}/></button><button className="avatar">MC</button></div>
    </header>

    <section className="workspace">
      <aside className="left-rail">
        <div className="rail-title"><span>SCENE</span><button className="icon-button tiny"><Settings2 size={16}/></button></div>
        <div className="scene-card active"><div className="scene-thumb"><div className="mini-grid"></div></div><div><strong>Ruined chapel</strong><small>Battle map</small></div><span className="live-dot"></span></div>
        <button className="new-scene"><Plus size={16}/> New scene</button>
        <div className="rail-title tokens-title"><span>TOKENS</span><button onClick={addToken} className="add-token"><Plus size={16}/></button></div>
        <div className="token-list">{tokens.map(t => <button key={t.id} onClick={() => setSelectedId(t.id)} className={'token-row ' + (t.id === selectedId ? 'selected' : '')}><TokenFace token={t} small/><span><strong>{t.name}</strong><small>{t.kind === 'enemy' ? 'Enemy' : 'Player'}</small></span><span className="token-hp">{t.hp}</span></button>)}</div>
        <div className="rail-foot"><button><Users size={16}/> Party roster</button><button><Sparkles size={16}/> Notes & handouts</button></div>
      </aside>

      <section className="table-area">
        <div className="scene-header"><div><p>RUINED CHAPEL</p><h1>Ambush at the broken altar</h1></div><div className="scene-tools"><label className="upload-button"><ImageUp size={16}/> Change map<input type="file" accept="image/*" onChange={handleUpload}/></label><button className="share"><Users size={16}/> Invite</button></div></div>
        <div className="board-wrap">
          <div ref={boardRef} className="board" style={{ '--grid': `${gridSize}px`, backgroundImage: mapImage ? `url(${mapImage})` : undefined, backgroundSize: mapImage ? 'cover' : undefined }}>
            {!mapImage && <div className="illustrated-map"><div className="river"></div><div className="stone-path"></div><div className="altar"><span>✦</span></div><div className="tree t1"></div><div className="tree t2"></div><div className="tree t3"></div><div className="tree t4"></div></div>}
            {gridVisible && <div className="grid-overlay"></div>}
            <div className="map-label">BROKEN CHAPEL</div><div className="compass">N<em>✦</em></div>
            {tokens.map(t => <button key={t.id} onPointerDown={(e) => { e.preventDefault(); setSelectedId(t.id); setDragging(t.id) }} onClick={() => setSelectedId(t.id)} className={'map-token ' + (t.id === selectedId ? 'active' : '')} style={{ left: `${t.x}%`, top: `${t.y}%`, '--token': t.color }} aria-label={t.name}><TokenFace token={t}/><span>{t.name}</span></button>)}
            <div className="board-toolbar"><button className="active"><MousePointer2 size={17}/></button><button><Crosshair size={17}/></button><i></i><button onClick={() => setZoom(z => Math.max(50, z - 10))}><Minus size={17}/></button><b>{zoom}%</b><button onClick={() => setZoom(z => Math.min(200, z + 10))}><Plus size={17}/></button><button><Maximize2 size={16}/></button></div>
          </div>
        </div>
      </section>

      <aside className="inspector">
        {selected ? <><div className="inspector-head"><div><p>SELECTED TOKEN</p><h2>{selected.name}</h2></div><button className="icon-button"><X size={18}/></button></div><div className="portrait"><TokenFace token={selected}/><button className="edit-portrait">Edit portrait</button></div><div className="form-section"><label>Name<input value={selected.name} onChange={e => updateToken('name', e.target.value)}/></label><div className="stat-grid"><label><span>HIT POINTS</span><input value={selected.hp} type="number" onChange={e => updateToken('hp', e.target.value)}/></label><label><span>MAX HP</span><input value={selected.maxHp} type="number" onChange={e => updateToken('maxHp', e.target.value)}/></label><label><span>ARMOUR CLASS</span><div className="input-icon"><Shield size={15}/><input value={selected.ac} type="number" onChange={e => updateToken('ac', e.target.value)}/></div></label><label><span>SPEED</span><div className="input-suffix"><input value={selected.speed} type="number" onChange={e => updateToken('speed', e.target.value)}/><b>ft</b></div></label></div></div><div className="health"><div><span>HEALTH</span><strong>{selected.hp} <small>/ {selected.maxHp}</small></strong></div><div className="healthbar"><i style={{width: `${Math.min(100, selected.hp / selected.maxHp * 100)}%`}}></i></div></div><div className="form-section conditions"><span>CONDITIONS</span><button><Plus size={15}/> Add condition</button></div><button className="delete" onClick={() => {setTokens(t => t.filter(x => x.id !== selectedId)); setSelectedId(tokens.find(t => t.id !== selectedId)?.id)}}><Trash2 size={16}/> Remove token</button></> : <div className="empty-inspector"><p>No token selected</p><button onClick={addToken}>Add a token</button></div>}
        <div className="grid-panel"><div><Grid3X3 size={17}/><span>Map grid</span></div><button onClick={() => setGridVisible(!gridVisible)} className={'toggle ' + (gridVisible ? 'on' : '')}><i></i></button><label>Grid size <input type="range" min="24" max="72" value={gridSize} onChange={e => setGridSize(e.target.value)}/></label></div>
      </aside>
    </section>
  </main>
}

function TokenFace({ token, small }) { return <span className={'token-face ' + (small ? 'small' : '')} style={{ '--token': token.color }}><b>{token.initials}</b></span> }
function Chevron() { return <span className="chevron">⌄</span> }
createRoot(document.getElementById('root')).render(<App />)
