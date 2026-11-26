export function Plans() {
  return (
    <section className="wrap plans" id="plans">
      <h2>Free to build. Pay when it’s your business.</h2>
      <p className="sub">Free is live today. Pro arrives with Razorpay billing in a later release.</p>
      <div className="tiers">
        <div className="tier"><h3>Free</h3><div className="price">₹0</div><ul><li>Three sites</li><li>Six templates, ten section types</li><li>Your own Pagecraft address</li><li>Small “Made with Pagecraft” badge</li></ul><a className="btn btn-line" href="/sign-up">Start free</a></div>
        <div className="tier pro"><h3>Pro</h3><div className="price">₹299 <small>/ month</small></div><ul><li>Twenty sites and collaborators</li><li>No badge</li><li>Premium templates</li><li>Your own domain</li></ul><p className="later">Coming soon — start free today and upgrade when it lands.</p></div>
      </div>
    </section>
  );
}
