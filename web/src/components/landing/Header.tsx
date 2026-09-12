export function Header() {
  return (
    <header className="wrap">
      <nav className="nav" aria-label="Main">
        <a className="logo" href="#"><svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#4338CA"/><path d="M18 14 h20 l8 8 v28 h-28 z" fill="#FFFFFF"/><path d="M38 14 v8 h8" fill="#C7D2FE"/><path d="M30 30 l14 6 l-6 2 l-2 6 z" fill="#FF6B6B" stroke="#4338CA" strokeWidth="1.5" strokeLinejoin="round"/></svg>Pagecraft</a>
        <ul><li><a href="#features">Features</a></li><li><a href="#plans">Plans</a></li><li><a href="#">Templates</a></li></ul>
        <a className="btn btn-line" href="#">Sign in</a>
      </nav>
    </header>
  );
}
