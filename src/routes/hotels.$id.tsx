import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Star, MapPin, Users, Bed } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/hotels/$id")({
  component: HotelDetailPage,
});

interface Hotel {
  id: string;
  name: string;
  description: string | null;
  city: string;
  country: string;
  address: string | null;
  rating: number | null;
  amenities: string[];
  cover_image_url: string | null;
  gallery_urls: string[];
}
interface Room {
  id: string;
  room_type: string;
  description: string | null;
  price_per_night: number;
  capacity: number;
  image_url: string | null;
}

const bookingSchema = z.object({
  guest_name: z.string().trim().min(2).max(100),
  guest_email: z.string().trim().email().max(255),
  guest_phone: z.string().trim().max(40).optional().or(z.literal("")),
  check_in: z.string().min(1),
  check_out: z.string().min(1),
  guests: z.number().int().min(1).max(20),
});

function HotelDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [form, setForm] = useState({
    guest_name: "",
    guest_email: "",
    guest_phone: "",
    check_in: "",
    check_out: "",
    guests: 1,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.from("hotels").select("*").eq("id", id).maybeSingle().then(({ data }) => setHotel(data as Hotel | null));
    supabase.from("rooms").select("*").eq("hotel_id", id).then(({ data }) => {
      const list = (data as Room[] | null) ?? [];
      setRooms(list);
      if (list[0]) setSelectedRoom(list[0]);
    });
  }, [id]);

  function nightsBetween(a: string, b: string) {
    if (!a || !b) return 0;
    const ms = new Date(b).getTime() - new Date(a).getTime();
    return Math.max(0, Math.round(ms / 86400000));
  }
  const nights = nightsBetween(form.check_in, form.check_out);
  const total = selectedRoom ? nights * Number(selectedRoom.price_per_night) : 0;

  async function handleBook(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    if (!selectedRoom) return;
    const parsed = bookingSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }
    if (nights <= 0) {
      toast.error("Check-out must be after check-in");
      return;
    }
    setSubmitting(true);
    const { data: booking, error } = await supabase
      .from("bookings")
      .insert({
        customer_id: user.id,
        hotel_id: id,
        room_id: selectedRoom.id,
        guest_name: parsed.data.guest_name,
        guest_email: parsed.data.guest_email,
        guest_phone: parsed.data.guest_phone || null,
        check_in: parsed.data.check_in,
        check_out: parsed.data.check_out,
        guests: parsed.data.guests,
        total_price: total,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      toast.error(error.message);
    } else if (booking) {
      await supabase.from("payments").insert({
        booking_id: booking.id,
        amount: total,
        method: "card",
        status: "pending",
      });
      toast.success("Booking confirmed!");
      navigate({ to: "/my-bookings" });
    }
    setSubmitting(false);
  }

  if (!hotel) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <div className="container mx-auto px-4 py-20 flex-1">
          <p className="text-muted-foreground">Loading hotel…</p>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const gallery = [hotel.cover_image_url, ...hotel.gallery_urls].filter(Boolean) as string[];

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <section className="container mx-auto px-4 py-10 flex-1">
        <Link to="/hotels" className="text-sm text-muted-foreground hover:text-accent">← Back to hotels</Link>

        <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_400px]">
          <div>
            <div className="aspect-[16/9] bg-muted rounded-lg overflow-hidden mb-4">
              {gallery[0] ? (
                <img src={gallery[0]} alt={hotel.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full grid place-items-center text-muted-foreground">No image</div>
              )}
            </div>
            {gallery.length > 1 && (
              <div className="grid grid-cols-4 gap-2 mb-6">
                {gallery.slice(1, 5).map((src, i) => (
                  <div key={i} className="aspect-square bg-muted rounded overflow-hidden">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}

            <h1 className="font-serif text-4xl mb-2">{hotel.name}</h1>
            <p className="flex items-center gap-3 text-muted-foreground mb-6">
              <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {hotel.city}, {hotel.country}</span>
              {hotel.rating ? (
                <span className="flex items-center gap-1 text-accent"><Star className="h-4 w-4 fill-accent" /> {hotel.rating}</span>
              ) : null}
            </p>
            {hotel.description && <p className="text-base leading-relaxed mb-6">{hotel.description}</p>}

            {hotel.amenities.length > 0 && (
              <div className="mb-8">
                <h3 className="font-serif text-xl mb-3">Amenities</h3>
                <div className="flex flex-wrap gap-2">
                  {hotel.amenities.map((a) => (
                    <Badge key={a} variant="secondary">{a}</Badge>
                  ))}
                </div>
              </div>
            )}

            <h3 className="font-serif text-2xl mb-4">Rooms</h3>
            <div className="grid gap-4">
              {rooms.length === 0 && <p className="text-muted-foreground">No rooms listed yet.</p>}
              {rooms.map((r) => (
                <Card
                  key={r.id}
                  onClick={() => setSelectedRoom(r)}
                  className={`p-4 cursor-pointer transition border-2 ${selectedRoom?.id === r.id ? "border-accent" : "border-transparent"}`}
                >
                  <div className="flex justify-between gap-4">
                    <div>
                      <h4 className="font-serif text-lg flex items-center gap-2"><Bed className="h-4 w-4 text-accent" /> {r.room_type}</h4>
                      {r.description && <p className="text-sm text-muted-foreground mt-1">{r.description}</p>}
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1"><Users className="h-3 w-3" /> Up to {r.capacity} guests</p>
                    </div>
                    <div className="text-right">
                      <p className="font-serif text-2xl text-primary">${Number(r.price_per_night)}</p>
                      <p className="text-xs text-muted-foreground">per night</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Booking */}
          <Card className="p-6 h-fit sticky top-24">
            <h3 className="font-serif text-xl mb-4">Book your stay</h3>
            {selectedRoom ? (
              <form onSubmit={handleBook} className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Selected: <span className="text-foreground font-medium">{selectedRoom.room_type}</span>
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Check-in</Label>
                    <Input type="date" value={form.check_in} onChange={(e) => setForm({ ...form, check_in: e.target.value })} required />
                  </div>
                  <div>
                    <Label className="text-xs">Check-out</Label>
                    <Input type="date" value={form.check_out} onChange={(e) => setForm({ ...form, check_out: e.target.value })} required />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Guests</Label>
                  <Input type="number" min={1} max={selectedRoom.capacity} value={form.guests} onChange={(e) => setForm({ ...form, guests: Number(e.target.value) })} />
                </div>
                <div>
                  <Label className="text-xs">Full name</Label>
                  <Input value={form.guest_name} onChange={(e) => setForm({ ...form, guest_name: e.target.value })} required />
                </div>
                <div>
                  <Label className="text-xs">Email</Label>
                  <Input type="email" value={form.guest_email} onChange={(e) => setForm({ ...form, guest_email: e.target.value })} required />
                </div>
                <div>
                  <Label className="text-xs">Phone (optional)</Label>
                  <Input value={form.guest_phone} onChange={(e) => setForm({ ...form, guest_phone: e.target.value })} />
                </div>

                <div className="border-t border-border pt-3 flex justify-between">
                  <span className="text-sm text-muted-foreground">{nights} {nights === 1 ? "night" : "nights"}</span>
                  <span className="font-serif text-2xl text-primary">${total.toFixed(2)}</span>
                </div>
                <Button type="submit" disabled={submitting} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                  {submitting ? "Confirming…" : user ? "Confirm booking" : "Sign in to book"}
                </Button>
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">Select a room to begin.</p>
            )}
          </Card>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
