import { DemoButtons } from "@/components/auth/DemoButtons";

export function Hero() {
  return (
    <section className="wrap hero">
      <h1>Pick a template. Publish it in one click.</h1>
      <p className="lede">Edit every section right on the page, change the palette and fonts, and publish a fast, SEO-clean site to its own address.</p>
      <DemoButtons tone="landing" />
      <p className="hero-note">
        No sign-up: you get your own copy of the demo café for 24 hours. Or <a href="/sign-up">create an account</a>.
      </p>

      <div className="editor" role="img" aria-label="Preview of the Pagecraft editor: the Kaapi Corner café page with its hero section selected">
        <div className="topbar" aria-hidden="true">
          <div className="dots"><i></i><i></i><i></i></div>
          <div className="url">pagecraft.virajdomadia.com/s/kaapi-corner</div>
          <div className="who"><span className="av m">D</span></div>
          <span className="pub">Publish<span className="toast">Published to /s/kaapi-corner</span></span>
        </div>
        <div className="body" aria-hidden="true">
          <aside className="side">
            <div className="lbl">Layers</div>
            <ul><li><i></i>Navigation</li><li className="on"><i></i>Hero</li><li><i></i>Features</li><li><i></i>Gallery</li><li><i></i>Testimonials</li><li><i></i>Contact</li><li><i></i>Footer</li></ul>
          </aside>
          <div className="canvas">
            <div className="page">
              <div className="pnav"><span>Kaapi Corner</span><span>See the menu</span></div>
              <div className="ph">Filter coffee, done properly.<span className="caret"></span><span className="sel" aria-hidden="true"></span></div>
              <p className="sub">Filter coffee, idli and fresh bakes on 12th Main, Indiranagar. Open 7 am to 10 pm, every day.</p>
              <div className="row3"><div></div><div></div><div></div></div>
            </div>
          </div>
          <aside className="props">
            <div className="lbl">Hero</div>
            <div className="prop"><span>Palette</span><span className="sw"><i style={{background: '#2B1B12'} as React.CSSProperties}></i><i style={{background: '#2F5D45'} as React.CSSProperties}></i><i style={{background: '#F7F1E8'} as React.CSSProperties}></i></span></div>
            <div className="prop"><span>Fonts</span><span>Fraunces / Inter</span></div>
            <div className="prop"><span>Layout</span><span>Split</span></div>
            <div className="prop"><span>Button</span><span>See the menu</span></div>
          </aside>
        </div>
      </div>
    </section>
  );
}
