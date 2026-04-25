import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Building2, Users, Calendar, DollarSign } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Aurelia" }] }),
  component: AdminPage,
});

interface Stats { hotels: number; users: number; bookings: number; revenue: number }

function AdminPage() {
  const { user, hasRole, loading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({ hotels: 0, users: 0, bookings: 0, revenue: 0 });

  useEffect(() => {
    if (!loading) {
      if (!user) navigate({ to: "/auth" });
      else if (!hasRole("admin")) navigate({ to: "/" });
    }
  }, [user, loading, hasRole, navigate]);

  useEffect(() => {
    if (!hasRole("admin")) return;
    (async () => {
      const [{ count: hotels }, { count: bookings }, { count: users }, { data: rev }] = await Promise.all([
        supabase.from("hotels").select("*", { count: "exact", head: true }),
        supabase.from("bookings").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("bookings").select("total_price"),
      ]);
      const revenue = (rev ?? []).reduce((s, r) => s + Number(r.total_price), 0);
      setStats({ hotels: hotels ?? 0, users: users ?? 0, bookings: bookings ?? 0, revenue });
    })();
  }, [hasRole]);

  if (!hasRole("admin")) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <div className="flex-1 grid place-items-center"><p className="text-muted-foreground">Loading…</p></div>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <section className="container mx-auto px-4 py-12 flex-1">
        <h1 className="font-serif text-4xl mb-8">Administrator Dashboard</h1>

        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <StatCard icon={<Building2 />} label="Hotels" value={stats.hotels} />
          <StatCard icon={<Users />} label="Users" value={stats.users} />
          <StatCard icon={<Calendar />} label="Bookings" value={stats.bookings} />
          <StatCard icon={<DollarSign />} label="Total revenue" value={`$${stats.revenue.toFixed(0)}`} />
        </div>

        <Tabs defaultValue="bookings">
          <TabsList>
            <TabsTrigger value="bookings">All bookings</TabsTrigger>
            <TabsTrigger value="hotels">Hotels</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
          </TabsList>
          <TabsContent value="bookings" className="mt-6"><AllBookings /></TabsContent>
          <TabsContent value="hotels" className="mt-6"><AllHotels /></TabsContent>
          <TabsContent value="users" className="mt-6"><AllUsers /></TabsContent>
        </Tabs>
      </section>
      <SiteFooter />
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <Card className="p-5 flex items-center gap-4">
      <div className="h-12 w-12 rounded-full bg-accent/15 text-accent grid place-items-center">{icon}</div>
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="font-serif text-2xl">{value}</p>
      </div>
    </Card>
  );
}

interface AllBooking {
  id: string; guest_name: string; check_in: string; check_out: string; total_price: number; status: string;
  hotels: { name: string } | null;
}
function AllBookings() {
  const [rows, setRows] = useState<AllBooking[]>([]);
  useEffect(() => {
    supabase.from("bookings").select("id,guest_name,check_in,check_out,total_price,status,hotels(name)").order("created_at", { ascending: false })
      .then(({ data }) => setRows((data as unknown as AllBooking[]) ?? []));
  }, []);
  return (
    <Card className="p-5">
      {rows.length === 0 ? <p className="text-muted-foreground">No bookings.</p> : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="flex justify-between border-b border-border py-2 text-sm">
              <span>{r.guest_name} · {r.hotels?.name}</span>
              <span className="flex items-center gap-3">
                <span>{r.check_in} → {r.check_out}</span>
                <span className="text-primary font-medium">${Number(r.total_price).toFixed(2)}</span>
                <Badge variant="secondary" className="capitalize">{r.status}</Badge>
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

interface AllHotel { id: string; name: string; city: string; country: string; is_active: boolean }
function AllHotels() {
  const [rows, setRows] = useState<AllHotel[]>([]);
  async function reload() {
    const { data } = await supabase.from("hotels").select("id,name,city,country,is_active").order("created_at", { ascending: false });
    setRows((data as AllHotel[] | null) ?? []);
  }
  useEffect(() => { reload(); }, []);
  async function toggle(id: string, active: boolean) {
    const { error } = await supabase.from("hotels").update({ is_active: !active }).eq("id", id);
    if (error) toast.error(error.message); else reload();
  }
  return (
    <Card className="p-5">
      {rows.length === 0 ? <p className="text-muted-foreground">No hotels.</p> : (
        <div className="space-y-2">
          {rows.map((h) => (
            <div key={h.id} className="flex justify-between border-b border-border py-2 text-sm items-center">
              <span>{h.name} · <span className="text-muted-foreground">{h.city}, {h.country}</span></span>
              <Button size="sm" variant="outline" onClick={() => toggle(h.id, h.is_active)}>
                {h.is_active ? "Hide" : "Publish"}
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

interface AllUser { id: string; full_name: string | null; created_at: string }
function AllUsers() {
  const [rows, setRows] = useState<AllUser[]>([]);
  useEffect(() => {
    supabase.from("profiles").select("id,full_name,created_at").order("created_at", { ascending: false })
      .then(({ data }) => setRows((data as AllUser[] | null) ?? []));
  }, []);
  return (
    <Card className="p-5">
      {rows.length === 0 ? <p className="text-muted-foreground">No users.</p> : (
        <div className="space-y-2">
          {rows.map((u) => (
            <div key={u.id} className="flex justify-between border-b border-border py-2 text-sm">
              <span>{u.full_name ?? "(no name)"}</span>
              <span className="text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
