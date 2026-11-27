export function Features() {
  return (
    <section className="wrap feat" id="features">
      <h2>Everything a one-page site needs, nothing you’d have to explain</h2>
      <div className="bento">
        <div className="b wide">
          <div><h3>Edit right on the page</h3><p>Click any text and type. Drag sections to reorder them, switch a section’s layout, swap a photo. Every change saves as you go.</p></div>
          <div className="viz cur-list"><span>Click to type</span><span>Drag to reorder</span><span>Saved</span></div>
        </div>
        <div className="b">
          <div><h3>Live on its own address</h3><p>Publish and it’s served fast, with proper titles and previews for sharing.</p></div>
          <div className="viz urlbox"><span>/s/<b>kaapi-corner</b></span><span>Live</span></div>
        </div>
        <div className="b">
          <div><h3>Undo anything</h3><p>Every edit autosaves and undoes with ⌘Z, so trying an idea costs nothing.</p></div>
          <div className="viz urlbox"><span>⌘Z</span><span>Undone</span></div>
        </div>
        <div className="b wide">
          <div><h3>Start from a template, keep your own look</h3><p>Six templates (café, salon, freelancer, gym, product launch, restaurant) and ten section types. Pick one of eight palettes and six font pairs; every section follows.</p></div>
          <div className="viz tmpl"><i></i><i></i><i></i><i></i></div>
        </div>
      </div>
      <p className="roadmap"><span className="soon">Next</span> Real-time co-editing with presence, and version history with one-click restore. Not built yet.</p>
    </section>
  );
}
