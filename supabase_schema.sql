-- =========================================================================
-- ESQUEMA DE BASE DE DATOS Y POLÍTICAS RBAC (POSTGRESQL / SUPABASE)
-- Roles del Sistema: 'TI' | 'Supervisor' | 'Empleado' | 'RH'
-- =========================================================================

-- 1. Tabla de Usuarios / Perfiles con Jerarquía Organizacional
CREATE TABLE IF NOT EXISTS public.users (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name text NOT NULL,
  last_name text,
  email text UNIQUE NOT NULL,
  role text NOT NULL DEFAULT 'Empleado' CHECK (role IN ('TI', 'Supervisor', 'Empleado', 'RH')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  supervisor_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_by_ti_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_team_members uuid[] DEFAULT '{}',
  birth_date date,
  team text,
  is_profile_complete boolean DEFAULT false,
  -- Vector biométrico facial sin imágenes (solo array de floats, lastUpdated y model)
  biometrics jsonb DEFAULT NULL CHECK (
    biometrics IS NULL OR (
      biometrics ? 'faceDescriptor'
      AND jsonb_typeof(biometrics->'faceDescriptor') = 'array'
      AND biometrics->>'model' = 'face_recognition_v1'
      AND NOT (biometrics ? 'photo')
      AND NOT (biometrics ? 'image')
      AND NOT (biometrics ? 'enrolledFacePhoto')
      AND NOT (biometrics ? 'facePhotoUrl')
    )
  ),
  -- Matriz de permisos granulares por usuario gestionada por TI
  modules jsonb NOT NULL DEFAULT '{
    "checkIn": true,
    "facialCheckIn": true,
    "tasks": true,
    "reports": false,
    "clients": false
  }'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Alias de compatibilidad con profiles
CREATE OR REPLACE VIEW public.profiles AS SELECT * FROM public.users;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Función auxiliar para obtener el rol del usuario actual en SQL
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Función auxiliar para validar una bandera del objeto modules del usuario actual
CREATE OR REPLACE FUNCTION public.has_user_module(module_key text)
RETURNS boolean AS $$
  SELECT COALESCE((modules->>module_key)::boolean, false)
  FROM public.users
  WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Políticas RBAC para users:
-- TI: Total | Supervisor: Su equipo | Empleado: Solo su perfil | RH: Lista básica
CREATE POLICY "TI acceso total a usuarios" ON public.users
  FOR ALL USING (public.get_current_user_role() = 'TI');

CREATE POLICY "Supervisor consulta su propio equipo" ON public.users
  FOR SELECT USING (
    public.get_current_user_role() = 'Supervisor'
    AND (id = auth.uid() OR supervisor_id = auth.uid())
  );

CREATE POLICY "Empleado consulta y actualiza solo su perfil" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Empleado actualiza su propio perfil" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "RH consulta lista basica de usuarios" ON public.users
  FOR SELECT USING (public.get_current_user_role() = 'RH');

-- =========================================================================
-- 2. Tabla de Registros de Tiempo de Trabajo (time_logs)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.time_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  check_in timestamp with time zone NOT NULL DEFAULT now(),
  check_out timestamp with time zone,
  hours_worked numeric(6, 2) DEFAULT 0.00,
  lat double precision,
  lng double precision,
  address text,
  total_duration_minutes integer,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.time_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "TI y RH leen todos los time_logs" ON public.time_logs
  FOR SELECT USING (public.get_current_user_role() IN ('TI', 'RH'));

CREATE POLICY "Supervisor lee time_logs de su equipo" ON public.time_logs
  FOR SELECT USING (
    public.get_current_user_role() = 'Supervisor'
    AND user_id IN (SELECT id FROM public.users WHERE supervisor_id = auth.uid() OR id = auth.uid())
  );

CREATE POLICY "Empleado gestiona sus propios time_logs" ON public.time_logs
  FOR ALL USING (auth.uid() = user_id AND public.get_current_user_role() != 'RH');

-- =========================================================================
-- 3. Vista Limpia Específica para RH (Excluye tareas, clientes y proyectos)
-- =========================================================================
CREATE OR REPLACE VIEW public.rh_work_time_view AS
SELECT 
    u.id AS user_id,
    u.name AS user_name,
    u.status,
    tl.date,
    tl.hours_worked,
    tl.check_in,
    tl.check_out
FROM public.users u
JOIN public.time_logs tl ON u.id = tl.user_id;
-- Nota: no se realiza JOIN con tablas de tasks ni clients

-- =========================================================================
-- 4. Clientes / Empresas y Proyectos (BLOQUEADO PARA RH - 403)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.client_groups (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  is_internal boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.clients (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid REFERENCES public.client_groups(id) ON DELETE SET NULL,
  name text NOT NULL,
  tax_id text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  code text UNIQUE,
  lead_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  deadline date,
  budget_type text DEFAULT 'fixed_project' CHECK (budget_type IN ('fixed_project', 'by_tasks', 'by_person')),
  total_budget_hours numeric(10, 2) DEFAULT 0.00,
  hourly_rate numeric(10, 2) DEFAULT 0.00,
  currency text DEFAULT 'MXN',
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.client_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Bloqueo explícito a RH en clients y projects
CREATE POLICY "Acceso a clientes prohibido para RH" ON public.clients
  FOR ALL USING (public.get_current_user_role() IN ('TI', 'Supervisor', 'Empleado'));

CREATE POLICY "Acceso a proyectos prohibido para RH" ON public.projects
  FOR ALL USING (public.get_current_user_role() IN ('TI', 'Supervisor', 'Empleado'));

-- =========================================================================
-- 5. Módulo de Tareas (tasks) con Persistencia y Vinculación Real
--    BLOQUEADO EXPLICITAMENTE PARA RH
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  name text GENERATED ALWAYS AS (title) STORED,
  description text,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  parent_task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES public.users(id) ON DELETE SET NULL NOT NULL,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  planned_hours numeric(10, 2) DEFAULT 0.00,
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  is_billable boolean DEFAULT true,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  completed_at timestamp with time zone DEFAULT NULL
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "TI acceso total a tareas" ON public.tasks
  FOR ALL USING (public.get_current_user_role() = 'TI');

CREATE POLICY "Supervisor gestiona tareas de su equipo" ON public.tasks
  FOR ALL USING (
    public.get_current_user_role() = 'Supervisor'
    AND (
      created_by = auth.uid()
      OR assigned_to IN (SELECT id FROM public.users WHERE supervisor_id = auth.uid())
    )
  );

CREATE POLICY "Empleado visualiza y actualiza solo tareas asignadas a el" ON public.tasks
  FOR SELECT USING (
    public.get_current_user_role() = 'Empleado'
    AND assigned_to = auth.uid()
  );

CREATE POLICY "Empleado actualiza estado de sus tareas asignadas" ON public.tasks
  FOR UPDATE USING (
    public.get_current_user_role() = 'Empleado'
    AND assigned_to = auth.uid()
  );

-- =========================================================================
-- 6. Entidad de Notificaciones Bidireccionales (notifications) y Triggers
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  message text NOT NULL,
  type text NOT NULL CHECK (type IN ('task_assigned', 'task_completed', 'new_task', 'task_review', 'task_comment', 'system')),
  read boolean NOT NULL DEFAULT false,
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios leen y actualizan sus notificaciones" ON public.notifications
  FOR ALL USING (
    public.get_current_user_role() != 'RH'
    AND (recipient_id = auth.uid() OR sender_id = auth.uid() OR public.get_current_user_role() = 'TI')
  );

-- Trigger Evento 1: Asignación de Tarea (Supervisor -> Empleado)
CREATE OR REPLACE FUNCTION public.fn_notify_on_task_assigned()
RETURNS trigger AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.assigned_to IS NOT NULL) OR
     (TG_OP = 'UPDATE' AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND NEW.assigned_to IS NOT NULL) THEN
    INSERT INTO public.notifications (recipient_id, sender_id, message, type, read, task_id, created_at)
    VALUES (
      NEW.assigned_to,
      NEW.created_by,
      'Se te ha asignado una nueva tarea: "' || NEW.title || '".',
      'task_assigned',
      false,
      NEW.id,
      timezone('utc'::text, now())
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_task_assigned ON public.tasks;
CREATE TRIGGER trg_notify_task_assigned
  AFTER INSERT OR UPDATE OF assigned_to ON public.tasks
  FOR EACH ROW EXECUTE PROCEDURE public.fn_notify_on_task_assigned();

-- Trigger Evento 2: Finalización de Tarea (Empleado -> Supervisor)
CREATE OR REPLACE FUNCTION public.fn_notify_on_task_completed()
RETURNS trigger AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed') THEN
    NEW.completed_at := COALESCE(NEW.completed_at, timezone('utc'::text, now()));
    INSERT INTO public.notifications (recipient_id, sender_id, message, type, read, task_id, created_at)
    VALUES (
      NEW.created_by,
      NEW.assigned_to,
      'El colaborador ha finalizado la tarea: "' || NEW.title || '".',
      'task_completed',
      false,
      NEW.id,
      timezone('utc'::text, now())
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_task_completed ON public.tasks;
CREATE TRIGGER trg_notify_task_completed
  BEFORE UPDATE OF status ON public.tasks
  FOR EACH ROW EXECUTE PROCEDURE public.fn_notify_on_task_completed();
