
-- Roles enum + user_roles table (separate from profiles to prevent privilege escalation)
CREATE TYPE public.app_role AS ENUM ('admin', 'vendor', 'customer');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Security definer role checker (avoids recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Hotels owned by vendors
CREATE TABLE public.hotels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  address TEXT,
  rating NUMERIC(2,1) DEFAULT 0,
  amenities TEXT[] DEFAULT '{}',
  cover_image_url TEXT,
  gallery_urls TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hotels_city ON public.hotels(city);
CREATE INDEX idx_hotels_vendor ON public.hotels(vendor_id);

CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  room_type TEXT NOT NULL,
  description TEXT,
  price_per_night NUMERIC(10,2) NOT NULL,
  capacity INT NOT NULL DEFAULT 2,
  total_units INT NOT NULL DEFAULT 1,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_rooms_hotel ON public.rooms(hotel_id);

CREATE TYPE public.booking_status AS ENUM ('pending','confirmed','cancelled','completed');

CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  guest_name TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  guest_phone TEXT,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  guests INT NOT NULL DEFAULT 1,
  total_price NUMERIC(10,2) NOT NULL,
  status public.booking_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bookings_customer ON public.bookings(customer_id);
CREATE INDEX idx_bookings_hotel ON public.bookings(hotel_id);

CREATE TYPE public.payment_status AS ENUM ('pending','paid','refunded','failed');

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  method TEXT NOT NULL DEFAULT 'card',
  status public.payment_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create profile + default customer role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name) VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'customer'));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger helper
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_hotels_updated BEFORE UPDATE ON public.hotels
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Profiles: own + admin
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles FOR SELECT
USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE
USING (auth.uid() = id);

-- user_roles: user can read own; only admins manage
CREATE POLICY "roles_select_own_or_admin" ON public.user_roles FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "roles_admin_all" ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Hotels: anyone can browse active; vendor manages own; admin all
CREATE POLICY "hotels_public_read" ON public.hotels FOR SELECT
USING (is_active = true OR vendor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "hotels_vendor_insert" ON public.hotels FOR INSERT
WITH CHECK (vendor_id = auth.uid() AND public.has_role(auth.uid(), 'vendor'));
CREATE POLICY "hotels_vendor_update" ON public.hotels FOR UPDATE
USING (vendor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "hotels_vendor_delete" ON public.hotels FOR DELETE
USING (vendor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Rooms: public read, vendor of parent hotel manages
CREATE POLICY "rooms_public_read" ON public.rooms FOR SELECT USING (true);
CREATE POLICY "rooms_vendor_manage" ON public.rooms FOR ALL
USING (EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = rooms.hotel_id AND (h.vendor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
WITH CHECK (EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = rooms.hotel_id AND (h.vendor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

-- Bookings: customer owns; vendor sees bookings for own hotels; admin all
CREATE POLICY "bookings_customer_select" ON public.bookings FOR SELECT
USING (
  customer_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = bookings.hotel_id AND h.vendor_id = auth.uid())
);
CREATE POLICY "bookings_customer_insert" ON public.bookings FOR INSERT
WITH CHECK (customer_id = auth.uid());
CREATE POLICY "bookings_status_update" ON public.bookings FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = bookings.hotel_id AND h.vendor_id = auth.uid())
  OR customer_id = auth.uid()
);

-- Payments: read by booking owner / vendor / admin
CREATE POLICY "payments_select" ON public.payments FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = payments.booking_id
          AND (b.customer_id = auth.uid()
               OR public.has_role(auth.uid(), 'admin')
               OR EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = b.hotel_id AND h.vendor_id = auth.uid())))
);
CREATE POLICY "payments_insert_customer" ON public.payments FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.customer_id = auth.uid()));

-- Storage bucket for hotel images
INSERT INTO storage.buckets (id, name, public) VALUES ('hotel-images','hotel-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "hotel_images_public_read" ON storage.objects FOR SELECT
USING (bucket_id = 'hotel-images');
CREATE POLICY "hotel_images_vendor_upload" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'hotel-images' AND auth.uid() IS NOT NULL);
CREATE POLICY "hotel_images_owner_delete" ON storage.objects FOR DELETE
USING (bucket_id = 'hotel-images' AND owner = auth.uid());
