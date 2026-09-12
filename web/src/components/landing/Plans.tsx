export function Plans() {
  return (
    <section className="wrap plans" id="plans">
      <h2>Free to build. Pay when it's your business.</h2>
      <p className="sub">Pro is billed through Razorpay, monthly, cancel any time.</p>
      <div className="tiers">
        <div className="tier"><h3>Free</h3><div className="price">₹0</div><ul><li>One page, one collaborator</li><li>Pagecraft address</li><li>Small "Made with Pagecraft" badge</li></ul><a className="btn btn-line" href="#">Start free</a></div>
        <div className="tier pro"><h3>Pro</h3><div className="price">₹299 <small>/ month</small></div><ul><li>Unlimited pages and collaborators</li><li>No badge</li><li>All templates and font pairs</li><li>Version history for 30 days</li></ul><a className="btn btn-indigo" href="#">Go Pro</a></div>
      </div>
    </section>
  );
}
