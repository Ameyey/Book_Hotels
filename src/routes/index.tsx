import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { MapPin, Star, Search } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Aurelia Hotels — Curated Luxury Stays" },
      { name: "description", content: "Discover and book exceptional hotels across the world's most coveted destinations." },
      { property: "og:title", content: "Aurelia Hotels — Curated Luxury Stays" },
      { property: "og:description", content: "Discover and book exceptional hotels across the world's most coveted destinations." },
    ],
  }),
  component: HomePage,
});

interface FeaturedHotel {
  id: string;
  name: string;
  city: string;
  country: string;
  rating: number | null;
  cover_image_url: string | null;
}

function HomePage() {
  const navigate = useNavigate();
  const [city, setCity] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [featured, setFeatured] = useState<FeaturedHotel[]>([]);

  useEffect(() => {
    supabase
      .from("hotels")
      .select("id,name,city,country,rating,cover_image_url")
      .eq("is_active", true)
      .order("rating", { ascending: false })
      .limit(6)
      .then(({ data }) => setFeatured(data ?? []));
  }, []);

  function search(e: React.FormEvent) {
    e.preventDefault();
    navigate({
      to: "/hotels",
      search: { city, checkIn, checkOut } as never,
    });
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      {/* Hero */}
      <section className="relative bg-primary text-primary-foreground overflow-hidden">
        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_30%_20%,_oklch(0.78_0.13_80)_0%,_transparent_50%)]" />
        <div className="container mx-auto px-4 py-24 md:py-32 relative">
          <p className="text-accent uppercase tracking-[0.3em] text-xs mb-4">Curated since 2024</p>
          <h1 className="text-5xl md:text-7xl font-serif font-medium max-w-3xl leading-[1.05]">
            Stay where the world's most discerning travelers go.
          </h1>
          <p className="mt-6 max-w-xl text-lg opacity-80">
            From private island retreats to grand metropolitan hotels — every Aurelia property is hand-selected for character, service, and craft.
          </p>

          <form
            onSubmit={search}
            className="mt-12 grid gap-3 md:grid-cols-[1.5fr_1fr_1fr_auto] bg-card text-foreground p-4 rounded-lg shadow-2xl max-w-4xl"
          >
            <div className="flex items-center gap-2 px-3 border-r border-border">
              <MapPin className="h-4 w-4 text-accent" />
              <Input
                placeholder="City or destination"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="border-0 shadow-none focus-visible:ring-0"
              />
            </div>
            <Input
              type="date"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              className="border-0 shadow-none focus-visible:ring-0"
            />
            <Input
              type="date"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              className="border-0 shadow-none focus-visible:ring-0"
            />
            <Button type="submit" className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Search className="h-4 w-4" /> Search
            </Button>
          </form>
        </div>
      </section>

      {/* Featured */}
      <section className="container mx-auto px-4 py-20">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-accent uppercase tracking-[0.25em] text-xs mb-2">Featured</p>
            <h2 className="text-4xl font-serif">Distinguished properties</h2>
          </div>
          <Link to="/hotels" className="text-sm hover:text-accent">View all →</Link>
        </div>

        {featured.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="font-serif text-2xl mb-2">No properties yet</p>
            <p className="text-sm">Vendor accounts can list hotels from the Vendor portal.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featured.map((h) => (
              <Link key={h.id} to="/hotels/$id" params={{ id: h.id }}>
                <Card className="overflow-hidden h-full hover:shadow-xl transition-shadow group">
                  <div className="aspect-[4/3] bg-muted overflow-hidden">
                    {h.cover_image_url ? (
                      <img
                        src={h.cover_image_url}
                        alt={h.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-muted-foreground text-sm">No image</div>
                    )}
                  </div>
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-serif text-xl">{h.name}</h3>
                      {h.rating ? (
                        <span className="flex items-center gap-1 text-sm text-accent">
                          <Star className="h-3.5 w-3.5 fill-accent" /> {h.rating}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {h.city}, {h.country}
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <SiteFooter />
    </div>
  );
}
