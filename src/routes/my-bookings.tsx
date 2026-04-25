import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/my-bookings")({
  head: () => ({ meta: [{ title: "My bookings — Aurelia" }] }),
  component: MyBookingsPage,
});

interface BookingRow {
  id: string;
  check_in: string;
  check_out: string;
  guests: number;
  total_price: number;
  status: string;
  created_at: string;
  hotels: { name: string; city: string; country: string } | null;
  rooms: { room_type: string } | null;
}

function MyBookingsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<BookingRow[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("bookings")
      .select("id,check_in,check_out,guests,total_price,status,created_at,hotels(name,city,country),rooms(room_type)")
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setRows((data as BookingRow[] | null) ?? []));
  }, [user]);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <section className="container mx-auto px-4 py-12 flex-1">
        <h1 className="font-serif text-4xl mb-8">My bookings</h1>
        {rows.length === 0 ? (
          <p className="text-muted-foreground">No bookings yet. <Link to="/hotels" className="text-accent">Browse hotels →</Link></p>
        ) : (
          <div className="grid gap-4">
            {rows.map((b) => (
              <Card key={b.id} className="p-5 flex flex-wrap justify-between gap-4">
                <div>
                  <h3 className="font-serif text-xl">{b.hotels?.name ?? "Hotel"}</h3>
                  <p className="text-sm text-muted-foreground">
                    {b.hotels?.city}, {b.hotels?.country} · {b.rooms?.room_type}
                  </p>
                  <p className="text-sm mt-2">
                    {b.check_in} → {b.check_out} · {b.guests} guest{b.guests !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-serif text-2xl text-primary">${Number(b.total_price).toFixed(2)}</p>
                  <Badge variant={b.status === "confirmed" ? "default" : "secondary"} className="capitalize">
                    {b.status}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
      <SiteFooter />
    </div>
  );
}
