-- =========================================
-- ESQUEMA DE BASE DE DATOS PARA SUPABASE
-- Pega este código en el "SQL Editor" de tu proyecto de Supabase
-- =========================================

-- Tabla de Perfiles
CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name text NOT NULL,
  last_name text,
  email text NOT NULL,
  role text DEFAULT 'employee'::text,
  birth_date date,
  team text,
  is_profile_complete boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar Row Level Security para Perfiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Los usuarios pueden ver su propio perfil" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Los usuarios pueden actualizar su propio perfil" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Supervisores pueden ver todos los perfiles" ON public.profiles
  FOR SELECT USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'supervisor'
  );

-- =========================================
-- Tabla de Registros de Checkin
CREATE TABLE public.checkin_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  check_in_time timestamp with time zone NOT NULL DEFAULT now(),
  check_out_time timestamp with time zone,
  lat double precision,
  lng double precision,
  address text,
  total_duration_minutes integer,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS para Checkins
ALTER TABLE public.checkin_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios insertan sus propios logs" ON public.checkin_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios ven sus propios logs" ON public.checkin_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Usuarios actualizan sus propios logs (checkout)" ON public.checkin_logs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Supervisores pueden ver todos los logs" ON public.checkin_logs
  FOR SELECT USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'supervisor'
  );

-- =========================================
-- Trigger para crear un perfil vacío cada que se registra un nuevo usuario en Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    new.id,
    split_part(new.email, '@', 1), -- Nombre por defecto basado en email
    new.email
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
