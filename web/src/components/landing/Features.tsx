export function Features() {
  return (
    <section className="wrap feat" id="features">
      <h2>Everything a one-page site needs, nothing you'd have to explain</h2>
      <div className="bento">
        <div className="b wide">
          <div><h3>Edit at the same time, without stepping on each other</h3><p>Every change merges instantly. You'll see who's editing what, and nobody's work gets overwritten — even on a bad connection.</p></div>
          <div className="viz cur-list"><span><i style={{background: '#2EC4B6'} as React.CSSProperties}></i>Viraj editing Gallery</span><span><i style={{background: '#FF6B6B'} as React.CSSProperties}></i>Meera editing Hero</span><span><i style={{background: '#F4B183'} as React.CSSProperties}></i>Arjun viewing</span></div>
        </div>
        <div className="b">
          <div><h3>Live on its own address</h3><p>Publish and it's served fast, with proper titles and previews for sharing.</p></div>
          <div className="viz urlbox"><span><b>chai-house</b>.pagecraft…</span><span>Live</span></div>
        </div>
        <div className="b">
          <div><h3>Undo anything</h3><p>Autosave plus the last ten versions, restorable in a click.</p></div>
          <div className="viz hist"><div><span>Now</span><span>Meera</span></div><div><span>12 min ago</span><span>Viraj</span></div><div><span>Yesterday</span><span>Meera</span></div></div>
        </div>
        <div className="b wide">
          <div><h3>Start from a template, keep your own look</h3><p>Sections for cafés, clinics, freelancers and studios. Pick a theme colour and a font pair; every section follows.</p></div>
          <div className="viz tmpl"><i></i><i></i><i></i><i></i></div>
        </div>
      </div>
    </section>
  );
}
