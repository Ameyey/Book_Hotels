import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const { user, roles, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-40">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-2xl font-serif font-semibold tracking-tight text-primary">
            Aurelia
          </span>
          <span className="hidden sm:inline text-xs uppercase tracking-[0.2em] text-accent">
            Hotels
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm">
          <Link to="/" className="hover:text-accent transition-colors" activeProps={{ className: "text-accent" }}>
            Home
          </Link>
          <Link to="/hotels" className="hover:text-accent transition-colors" activeProps={{ className: "text-accent" }}>
            Hotels
          </Link>
          {roles.includes("vendor") && (
            <Link to="/vendor" className="hover:text-accent transition-colors">
              Vendor
            </Link>
          )}
          {roles.includes("admin") && (
            <Link to="/admin" className="hover:text-accent transition-colors">
              Admin
            </Link>
          )}
          {user && (
            <Link to="/my-bookings" className="hover:text-accent transition-colors">
              My Bookings
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await signOut();
                navigate({ to: "/" });
              }}
            >
              Sign out
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/auth">Sign in</Link>
              </Button>
              <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90" asChild>
                <Link to="/auth" search={{ mode: "signup" } as never}>
                  Join
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-primary text-primary-foreground mt-20">
      <div className="container mx-auto px-4 py-12 grid gap-8 md:grid-cols-3">
        <div>
          <h3 className="font-serif text-2xl mb-2">Aurelia Hotels</h3>
          <p className="text-sm opacity-80">
            Curated stays in the world's most distinguished destinations.
          </p>
        </div>
        <div className="text-sm opacity-80">
          <h4 className="font-serif text-lg mb-2 text-accent">Explore</h4>
          <ul className="space-y-1">
            <li><Link to="/hotels">Browse hotels</Link></li>
            <li><Link to="/auth">Vendor portal</Link></li>
          </ul>
        </div>
        <div className="text-sm opacity-80">
          <h4 className="font-serif text-lg mb-2 text-accent">Contact</h4>
          <p>concierge@aurelia.example</p>
          <p>+1 (555) 010-2024</p>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs opacity-60">
        © {new Date().getFullYear()} Aurelia Hotels. All rights reserved.
      </div>
    </footer>
  );
}
