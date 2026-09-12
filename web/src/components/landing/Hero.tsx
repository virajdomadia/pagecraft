export function Hero() {
  return (
    <section className="wrap hero">
      <h1>Build the page together. Publish it in one click.</h1>
      <p className="lede">A landing-page editor two people can use at the same time — you write the headline while your designer swaps the images — then it's live on its own address.</p>
      <div className="actions"><a className="btn btn-indigo" href="#">Start a page, free</a><a className="btn btn-line" href="#features">See what you can build</a></div>

      <div className="editor" aria-label="Editor preview">
        <div className="topbar">
          <div className="dots"><i></i><i></i><i></i></div>
          <div className="url">pagecraft.virajdomadia.com/edit/chai-house</div>
          <div className="who"><span className="av m">V</span><span className="av c">M</span></div>
          <span className="pub">Publish<span className="toast">Published to chai-house.pagecraft.virajdomadia.com</span></span>
        </div>
        <div className="body">
          <aside className="side">
            <div className="lbl">Sections</div>
            <ul><li className="on"><i></i>Hero</li><li><i></i>Menu highlights</li><li><i></i>Gallery</li><li><i></i>Opening hours</li><li><i></i>Find us</li><li><i></i>Footer</li></ul>
          </aside>
          <div className="canvas">
            <div className="page">
              <div className="pnav"><span>Chai House</span><span>Order ahead</span></div>
              <div className="ph">Slow chai, fast wifi<span className="caret"></span><span className="sel" aria-hidden="true"></span></div>
              <p className="sub">A neighbourhood café in Indiranagar. Open 7am to 11pm, every day.</p>
              <div className="row3"><div></div><div><span className="sel2" aria-hidden="true"></span></div><div></div></div>
            </div>
            <svg className="cursor c1" viewBox="0 0 18 18" aria-hidden="true"><path d="M2 2 L16 8 L9 10 L7 17 Z" fill="#FF6B6B" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round"/></svg>
            <svg className="cursor c2" viewBox="0 0 18 18" aria-hidden="true"><path d="M2 2 L16 8 L9 10 L7 17 Z" fill="#2EC4B6" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round"/></svg>
          </div>
          <aside className="props">
            <div className="lbl">Hero</div>
            <div className="prop"><span>Theme</span><span className="sw"><i style={{background: '#1B1B2F'} as React.CSSProperties}></i><i style={{background: '#F4B183'} as React.CSSProperties}></i><i style={{background: '#FFF'} as React.CSSProperties}></i></span></div>
            <div className="prop"><span>Font pair</span><span>Manrope / Fraunces</span></div>
            <div className="prop"><span>Align</span><span>Left</span></div>
            <div className="prop"><span>Button</span><span>Order ahead</span></div>
          </aside>
        </div>
      </div>
    </section>
  );
}
