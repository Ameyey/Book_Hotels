import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Star, MapPin } from "lucide-react";

interface SearchParams {
  city?: string;
  checkIn?: string;
  checkOut?: string;
}

export const Route = createFileRoute("/hotels")({
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    city: typeof s.city === "string" ? s.city : "",
    checkIn: typeof s.checkIn === "string" ? s.checkIn : "",
    checkOut: typeof s.checkOut === "string" ? s.checkOut : "",
  }),
  head: () => ({
    meta: [
      { title: "Browse Hotels — Aurelia" },
      { name: "description", content: "Search and browse our curated portfolio of luxury hotels worldwide." },
      { property: "og:title", content: "Browse Hotels — Aurelia" },
      { property: "og:description", content: "Search and browse our curated portfolio of luxury hotels worldwide." },
    ],
  }),
  component: HotelsListPage,
});

interface HotelRow {
  id: string;
  name: string;
  city: string;
  country: string;
  rating: number | null;
  cover_image_url: string | null;
  description: string | null;
  rooms: { price_per_night: number }[];
}

function HotelsListPage() {
  const search = Route.useSearch();
  const [filter, setFilter] = useState(search.city ?? "");
  const [hotels, setHotels] = useState<HotelRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    let q = supabase
      .from("hotels")
      .select("id,name,city,country,rating,cover_image_url,description,rooms(price_per_night)")
      .eq("is_active", true);
    if (filter) q = q.ilike("city", `%${filter}%`);
    q.order("rating", { ascending: false }).then(({ data }) => {
      setHotels((data as HotelRow[] | null) ?? []);
      setLoading(false);
    });
  }, [filter]);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <section className="container mx-auto px-4 py-12 flex-1">
        <h1 className="font-serif text-4xl mb-2">Hotels</h1>
        <p className="text-muted-foreground mb-8">
          {filter ? `Showing results in “${filter}”` : "All curated properties"}
        </p>

        <Input
          placeholder="Filter by city…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-sm mb-8"
        />

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : hotels.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            <p className="font-serif text-2xl mb-2">No hotels found</p>
            <p className="text-sm">Try a different city.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {hotels.map((h) => {
              const minPrice = h.rooms.length
                ? Math.min(...h.rooms.map((r) => Number(r.price_per_night)))
                : null;
              return (
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
                        <div className="w-full h-full grid place-items-center text-muted-foreground text-sm">
                          No image
                        </div>
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
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mb-3">
                        <MapPin className="h-3 w-3" /> {h.city}, {h.country}
                      </p>
                      {minPrice !== null && (
                        <p className="text-sm">
                          From <span className="font-serif text-lg text-primary">${minPrice}</span>{" "}
                          <span className="text-muted-foreground">/ night</span>
                        </p>
                      )}
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>
      <SiteFooter />
    </div>
  );
}
