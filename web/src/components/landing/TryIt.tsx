import { DemoButtons } from "@/components/auth/DemoButtons";
import { site } from "@/lib/site";

const EXAMPLES = [
  { slug: "kaapi-corner", name: "Kaapi Corner", kind: "Café · Indiranagar", img: "/templates/cafe/hero.jpg", alt: "Filter coffee in a steel tumbler" },
  { slug: "loop-studio", name: "Loop Studio", kind: "Salon · Koramangala", img: "/templates/salon/hero.jpg", alt: "A stylist blow-drying a client's hair" },
  { slug: "meera-rao", name: "Meera Rao", kind: "Freelancer portfolio", img: "/templates/freelancer/kaapi.jpg", alt: "A brand identity board" },
  { slug: "ironline", name: "Ironline", kind: "Gym · HSR Layout", img: "/templates/gym/hero.jpg", alt: "Squat racks in a gym" },
  { slug: "nimbus-kettle", name: "Nimbus", kind: "Product launch", img: "/templates/launch/hero.jpg", alt: "A pour-over coffee setup" },
  { slug: "bistro-nine", name: "Bistro Nine", kind: "Restaurant · Jayanagar", img: "/templates/restaurant/hero.jpg", alt: "A masala dosa on a banana leaf" },
];

/** S1: the demo box (two logins, no password) and the six live example sites. */
export function TryIt() {
  return (
    <>
      <section className="wrap examples" id="examples" aria-labelledby="examples-h">
        <h2 id="examples-h">Six templates, published and live</h2>
        <p className="sub">Every one is a real Pagecraft site rendered from its document — open them on your phone.</p>
        <ul className="ex-grid">
          {EXAMPLES.map((e) => (
            <li key={e.slug}>
              <a href={`/s/${e.slug}`} className="ex-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={e.img} alt={e.alt} loading="lazy" decoding="async" width={400} height={300} />
                <span className="ex-name">{e.name}</span>
                <span className="ex-kind">{e.kind}</span>
                <span className="ex-url">/s/{e.slug}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
      <section className="wrap try" id="try" aria-labelledby="try-h">
        <div className="try-box">
          <p className="tag">No sign-up</p>
          <h2 id="try-h">Open the editor as a demo user</h2>
          <p>
            Sign in as <b>Deepa</b>, who owns the Kaapi Corner café site, or as <b>Rohan</b>, her collaborator. Edit the
            headline, swap a photo, change the palette, publish — the live page updates in seconds. Demo accounts are shared,
            so sites you create may be recycled.
          </p>
          <DemoButtons tone="landing" />
          <p className="try-foot">
            A portfolio project by {site.author}. <a href={site.repo}>Read the code on GitHub</a>.
          </p>
        </div>
      </section>
    </>
  );
}
