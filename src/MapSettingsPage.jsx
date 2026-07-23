import { ArrowLeft, Grid3X3, ImageUp, Map, Settings2 } from "lucide-react";

export default function MapSettingsPage({
  name,
  setName,
  mode,
  setMode,
  map,
  noMap,
  gridSize,
  setGridSize,
  onUpload,
  onNoMap,
  onBack,
}) {
  const readImage = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onUpload(reader.result);
    reader.readAsDataURL(file);
  };

  return (
    <div className="settings-page">
      <header>
        <button className="brand-button" onClick={onBack}>
          Roll30
        </button>
        <span>Map settings</span>
        <button className="button home-button" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
      </header>
      <main className="settings-main">
        <section className="settings-intro">
          <span className="settings-icon">
            <Settings2 size={22} />
          </span>
          <p>MAP WORKSPACE</p>
          <h1>{name || "Untitled map"}</h1>
          <span>Changes save automatically to this browser.</span>
        </section>

        <section className="settings-card">
          <div className="settings-section-heading">
            <div>
              <p>IDENTITY</p>
              <h2>Name and purpose</h2>
            </div>
          </div>
          <label className="settings-field">
            Map name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Untitled map"
            />
          </label>
          <div className="settings-field">
            <span>Map type</span>
            <div className="settings-choice">
              <button
                className={mode === "play" ? "active" : ""}
                onClick={() => setMode("play")}
              >
                Play
              </button>
              <button
                className={mode === "battle" ? "active" : ""}
                onClick={() => setMode("battle")}
              >
                Battle
              </button>
            </div>
            <small>
              Battle maps include a grid, initiative, movement, and attacks.
            </small>
          </div>
        </section>

        <section className="settings-card map-source-card">
          <div className="settings-section-heading">
            <div>
              <p>BACKGROUND</p>
              <h2>Map artwork</h2>
            </div>
            <span>
              {map ? "Image map" : noMap ? "White canvas" : "Not set"}
            </span>
          </div>
          <div
            className={`map-preview ${!map ? "blank" : ""}`}
            style={{ backgroundImage: map ? `url(${map})` : undefined }}
          >
            {!map && (
              <>
                <Map size={28} />
                <strong>{noMap ? "White canvas" : "No background yet"}</strong>
              </>
            )}
          </div>
          <div className="settings-actions">
            <label className="button settings-upload">
              <ImageUp size={17} /> Upload image
              <input
                type="file"
                accept="image/*"
                onChange={(event) => readImage(event.target.files?.[0])}
              />
            </label>
            <button className="button" onClick={onNoMap}>
              Use white canvas
            </button>
          </div>
        </section>

        {mode === "battle" && (
          <section className="settings-card grid-settings-card">
            <div className="settings-section-heading">
              <div>
                <p>GRID</p>
                <h2>Battle scale</h2>
              </div>
              <span>
                <Grid3X3 size={15} /> 5 ft squares
              </span>
            </div>
            <label className="grid-setting-control">
              <span>Cell size</span>
              <input
                type="range"
                min="24"
                max="80"
                value={gridSize}
                onChange={(event) => setGridSize(+event.target.value)}
              />
              <strong>{gridSize}px</strong>
            </label>
          </section>
        )}
      </main>
    </div>
  );
}
