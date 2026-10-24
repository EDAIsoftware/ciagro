# EDAI · Actualización completa (para subir cuando se libere la cuenta)

Este paquete trae TODO lo nuevo junto. Solo cambia o agrega archivos; no borra nada.

## Qué incluye
- Hojas de ruta de servicio: app/rutas (tablero semanal, rutas, solicitudes, técnicos, hoja imprimible, historial)
- Preparación de tractores e implementos: app/preparacion (dos áreas independientes)
- Panel general: app/resumen (alertas de hoy y resumen de cada módulo) y components/salidas.tsx
- Usuarios y permisos por módulo: app/usuarios
- Inspecciones y taller: app/inspecciones (Panel de flota con ingresos a taller y ronda de 15 días)
- Control de combustible: components/fuelops-dashboard.tsx y lib/store.ts (saldo acumulado, destinos, editar salidas, menú)
- Cambio de nombre de usuario: components/profile-name.tsx

## Paso 1 · Supabase (primero)
SQL Editor > New query > pega TODO el archivo supabase/actualizacion-completa.sql > Run.
Se puede repetir sin problema. Los usuarios que ya existen conservan su acceso a combustible e inspecciones.

## Paso 2 · GitHub
Add file > Upload files > arrastra las carpetas: lib, components, app y supabase. Commit changes.
Vercel despliega solo. Recarga con Ctrl+F5.

## Paso 3 · Personas
1. Crea las cuentas en Supabase: Authentication > Users > Add user (con "Auto confirm").
2. Entra a la plataforma > Usuarios y permisos y marca los módulos de cada persona.
   Combustible, Inspecciones y taller, Rutas de servicio, Preparación de tractores, Preparación de implementos.
3. Cada persona toca el lápiz junto a su nombre para poner su nombre en vez del correo.

Si alguna pantalla muestra "¿Ya ejecutaste ... .sql?", falta ejecutar el Paso 1.

## Impresora de la oficina (estación de impresión)
1. En la computadora de la oficina, inicia sesión en la plataforma con una cuenta que tenga "Rutas de servicio".
2. Crea un acceso directo de Chrome con este destino (cambia la dirección por la tuya):
   chrome.exe --kiosk-printing https://TU-DIRECCION.vercel.app/rutas/impresion
3. Deja la impresora láser como predeterminada de Windows, desactiva la suspensión automática y deja esa ventana abierta.
4. Desde cualquier teléfono: Rutas > abrir una ruta > "Enviar a la impresora de la oficina". Sale sola.

## Excel de la semana
Rutas > pestaña Semana > "Descargar Excel de esta semana". Se abre en Excel con las hojas RRHH, Camionetas y una por ruta.
