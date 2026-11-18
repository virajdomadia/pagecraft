import { site } from "@/lib/site";

export function EarlyAccess() {
  return (
    <section className="wrap early" id="early-access" aria-labelledby="early-h">
      <p className="tag">In development</p>
      <h2 id="early-h">Pagecraft isn&apos;t open yet.</h2>
      <p>
        Pagecraft is a portfolio project by {site.author}, and it&apos;s being built right now. There are no accounts,
        sign-ups or paid plans yet &mdash; the editor, live collaboration and one-click publishing are in progress.
        Follow the build on GitHub, or get in touch if you&apos;d like to hear when it&apos;s ready.
      </p>
      <div className="actions">
        <a className="btn btn-indigo" href={site.repo}>Follow the build on GitHub</a>
        <a className="btn btn-line" href={site.contactUrl}>Get in touch</a>
      </div>
    </section>
  );
}
