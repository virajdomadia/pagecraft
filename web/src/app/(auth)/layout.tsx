import { Logo } from "@/components/studio/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="studio bp-grid flex min-h-dvh flex-col">
      <header className="px-5 py-4 sm:px-8">
        <Logo />
      </header>
      <main id="main" className="flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:pt-12">
        {children}
      </main>
    </div>
  );
}
