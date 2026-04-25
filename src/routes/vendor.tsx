import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/vendor")({
  head: () => ({ meta: [{ title: "Vendor Portal — Aurelia" }] }),
  component: VendorPage,
});

interface Hotel {
  id: string; name: string; city: string; country: string; description: string | null;
  amenities: string[]; cover_image_url: string | null; is_active: boolean;
}
interface Room {
  id: string; hotel_id: string; room_type: string; price_per_night: number; capacity: number; description: string | null;
}
interface Booking {
  id: string; check_in: string; check_out: string; guest_name: string; total_price: number; status: string;
  hotels: { name: string } | null; rooms: { room_type: string } | null;
}

function VendorPage() {
  const { user, hasRole, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (!user) navigate({ to: "/auth" });
      else if (!hasRole("vendor") && !hasRole("admin")) navigate({ to: "/" });
    }
  }, [user, loading, hasRole, navigate]);

  if (!user || !(hasRole("vendor") || hasRole("admin"))) {
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
        <h1 className="font-serif text-4xl mb-2">Vendor Portal</h1>
        <p className="text-muted-foreground mb-8">Manage your properties and reservations.</p>

        <Tabs defaultValue="hotels">
          <TabsList>
            <TabsTrigger value="hotels">Hotels & Rooms</TabsTrigger>
            <TabsTrigger value="bookings">Bookings</TabsTrigger>
          </TabsList>
          <TabsContent value="hotels" className="mt-6"><HotelsManager userId={user.id} /></TabsContent>
          <TabsContent value="bookings" className="mt-6"><VendorBookings /></TabsContent>
        </Tabs>
      </section>
      <SiteFooter />
    </div>
  );
}

function HotelsManager({ userId }: { userId: string }) {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: "", city: "", country: "", description: "", amenities: "", cover_image_url: "" });

  async function reload() {
    const { data } = await supabase.from("hotels").select("*").eq("vendor_id", userId).order("created_at", { ascending: false });
    setHotels((data as Hotel[] | null) ?? []);
  }
  useEffect(() => { reload(); }, [userId]);

  async function handleUpload(file: File): Promise<string | null> {
    const path = `${userId}/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from("hotel-images").upload(path, file);
    if (error) { toast.error(error.message); return null; }
    return supabase.storage.from("hotel-images").getPublicUrl(path).data.publicUrl;
  }

  async function createHotel(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const { error } = await supabase.from("hotels").insert({
      vendor_id: userId,
      name: draft.name.trim(),
      city: draft.city.trim(),
      country: draft.country.trim(),
      description: draft.description.trim() || null,
      amenities: draft.amenities.split(",").map((s) => s.trim()).filter(Boolean),
      cover_image_url: draft.cover_image_url || null,
    });
    setCreating(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Hotel added");
      setDraft({ name: "", city: "", country: "", description: "", amenities: "", cover_image_url: "" });
      reload();
    }
  }

  async function deleteHotel(id: string) {
    if (!confirm("Delete this hotel and all its rooms?")) return;
    const { error } = await supabase.from("hotels").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); reload(); }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
      <Card className="p-5 h-fit">
        <h3 className="font-serif text-xl mb-3">Add a hotel</h3>
        <form onSubmit={createHotel} className="space-y-2">
          <div><Label>Name</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>City</Label><Input value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} required /></div>
            <div><Label>Country</Label><Input value={draft.country} onChange={(e) => setDraft({ ...draft, country: e.target.value })} required /></div>
          </div>
          <div><Label>Description</Label><Textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={3} /></div>
          <div><Label>Amenities (comma separated)</Label><Input value={draft.amenities} onChange={(e) => setDraft({ ...draft, amenities: e.target.value })} placeholder="Pool, Spa, Wi-Fi" /></div>
          <div>
            <Label>Cover image</Label>
            <Input type="file" accept="image/*" onChange={async (e) => {
              const f = e.target.files?.[0]; if (!f) return;
              const url = await handleUpload(f);
              if (url) setDraft({ ...draft, cover_image_url: url });
            }} />
            {draft.cover_image_url && <img src={draft.cover_image_url} alt="" className="mt-2 h-24 w-full object-cover rounded" />}
          </div>
          <Button type="submit" disabled={creating} className="w-full">{creating ? "Saving…" : <><Plus className="h-4 w-4" /> Add hotel</>}</Button>
        </form>
      </Card>

      <div className="space-y-4">
        {hotels.length === 0 && <p className="text-muted-foreground">No hotels yet.</p>}
        {hotels.map((h) => <HotelRow key={h.id} hotel={h} onDelete={() => deleteHotel(h.id)} onChange={reload} />)}
      </div>
    </div>
  );
}

function HotelRow({ hotel, onDelete, onChange }: { hotel: Hotel; onDelete: () => void; onChange: () => void }) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [room, setRoom] = useState({ room_type: "", price_per_night: "", capacity: "2", description: "" });

  async function reloadRooms() {
    const { data } = await supabase.from("rooms").select("*").eq("hotel_id", hotel.id);
    setRooms((data as Room[] | null) ?? []);
  }
  useEffect(() => { reloadRooms(); }, [hotel.id]);

  async function addRoom(e: React.FormEvent) {
    e.preventDefault();
    const price = Number(room.price_per_night);
    const cap = Number(room.capacity);
    if (!room.room_type || isNaN(price) || price <= 0) return toast.error("Enter type and valid price");
    const { error } = await supabase.from("rooms").insert({
      hotel_id: hotel.id, room_type: room.room_type, price_per_night: price, capacity: cap, description: room.description || null,
    });
    if (error) toast.error(error.message);
    else { setRoom({ room_type: "", price_per_night: "", capacity: "2", description: "" }); reloadRooms(); }
  }
  async function deleteRoom(id: string) {
    await supabase.from("rooms").delete().eq("id", id);
    reloadRooms();
  }
  async function toggleActive() {
    await supabase.from("hotels").update({ is_active: !hotel.is_active }).eq("id", hotel.id);
    onChange();
  }

  return (
    <Card className="p-5">
      <div className="flex justify-between items-start gap-4 mb-4">
        <div className="flex gap-3">
          {hotel.cover_image_url && <img src={hotel.cover_image_url} alt={hotel.name} className="h-16 w-24 object-cover rounded" />}
          <div>
            <h3 className="font-serif text-xl">{hotel.name}</h3>
            <p className="text-sm text-muted-foreground">{hotel.city}, {hotel.country}</p>
            <Badge variant={hotel.is_active ? "default" : "secondary"} className="mt-1">{hotel.is_active ? "Active" : "Hidden"}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={toggleActive}>{hotel.is_active ? "Hide" : "Publish"}</Button>
          <Button size="sm" variant="outline" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <h4 className="font-serif mb-2">Rooms</h4>
        <div className="space-y-1 mb-3">
          {rooms.map((r) => (
            <div key={r.id} className="flex justify-between text-sm border-b border-border py-1">
              <span>{r.room_type} · cap {r.capacity}</span>
              <span className="flex items-center gap-3">
                <span className="text-primary">${Number(r.price_per_night)}/night</span>
                <button onClick={() => deleteRoom(r.id)}><Trash2 className="h-3 w-3 text-destructive" /></button>
              </span>
            </div>
          ))}
        </div>
        <form onSubmit={addRoom} className="grid grid-cols-[1fr_100px_80px_auto] gap-2">
          <Input placeholder="Type (e.g. Deluxe King)" value={room.room_type} onChange={(e) => setRoom({ ...room, room_type: e.target.value })} />
          <Input placeholder="Price" type="number" value={room.price_per_night} onChange={(e) => setRoom({ ...room, price_per_night: e.target.value })} />
          <Input placeholder="Cap" type="number" value={room.capacity} onChange={(e) => setRoom({ ...room, capacity: e.target.value })} />
          <Button size="sm" type="submit"><Plus className="h-3 w-3" /></Button>
        </form>
      </div>
    </Card>
  );
}

function VendorBookings() {
  const [rows, setRows] = useState<Booking[]>([]);

  async function reload() {
    const { data } = await supabase
      .from("bookings")
      .select("id,check_in,check_out,guest_name,total_price,status,hotels!inner(name),rooms(room_type)")
      .order("created_at", { ascending: false });
    setRows((data as unknown as Booking[]) ?? []);
  }
  useEffect(() => { reload(); }, []);

  async function setStatus(id: string, status: "pending" | "confirmed" | "cancelled" | "completed") {
    const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Updated"); reload(); }
  }

  return (
    <Card className="p-5">
      {rows.length === 0 ? (
        <p className="text-muted-foreground">No bookings for your hotels yet.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((b) => (
            <div key={b.id} className="flex flex-wrap justify-between items-center gap-3 border-b border-border pb-3">
              <div>
                <p className="font-medium">{b.hotels?.name} — {b.rooms?.room_type}</p>
                <p className="text-sm text-muted-foreground">{b.guest_name} · {b.check_in} → {b.check_out}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-serif text-lg text-primary">${Number(b.total_price).toFixed(2)}</span>
                <Select value={b.status} onValueChange={(v) => setStatus(b.id, v as never)}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
