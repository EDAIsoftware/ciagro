# EDAI FuelOps

Plataforma multiusuario de control de combustible y flota (Next.js + Supabase).

## Puesta en marcha
1. Crea un proyecto en https://supabase.com y ejecuta `supabase/schema.sql` en **SQL Editor**.
2. En **Authentication → Users → Add user** crea tu usuario (correo + contraseña, marca "Auto confirm"). **El primer usuario es Administrador**; los siguientes son Operadores.
3. En **Authentication → Sign In / Providers**, desactiva "Allow new users to sign up" para que solo tú invites gente.
4. En Vercel: Settings → Environment Variables, agrega `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase → Project Settings → API). Redeploy.
5. Local: copia `.env.example` a `.env.local`, `pnpm install`, `pnpm dev`.

## Roles
- **Administrador:** agrega vehículos, elimina registros, ve todo.
- **Operador:** registra cargas y salidas, ve todo. No puede borrar.

Los cambios se ven al instante en todos los dispositivos conectados.
