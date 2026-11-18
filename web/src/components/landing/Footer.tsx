import { site } from "@/lib/site";

export function Footer() {
  return (
    <footer className="wrap foot">
      <span>Pagecraft · a portfolio project by <a href={site.authorUrl}>{site.author}</a></span>
      <span>pagecraft.virajdomadia.com</span>
    </footer>
  );
}
