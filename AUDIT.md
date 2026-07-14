# Auditoría técnica — Juntos Hacia Dios

Fecha: 2026-07-13

## Alcance revisado

- Sitio estático publicado desde GitHub Pages.
- Cliente de Supabase cargado desde CDN.
- Autenticación del panel administrativo.
- Tablas públicas, RLS, funciones y políticas.
- Índices y advertencias de rendimiento.
- Controles automáticos en GitHub Actions.

## Hallazgos principales

1. El sitio apunta al proyecto Supabase `bmtgfbtoyxwrrnygsqcj`.
2. Todas las tablas de `public` tienen RLS activo.
3. Varias políticas públicas y administrativas estaban duplicadas.
4. Algunas políticas evaluaban autorización por cada fila.
5. Tres funciones no fijaban `search_path`.
6. La función administrativa utilizaba privilegios de propietario innecesarios.
7. Cuatro claves foráneas no tenían índice de apoyo.
8. Existían dos índices equivalentes para el slug de artistas.
9. El repositorio no contaba con validación automática de sintaxis JavaScript ni detección básica de secretos privados.

## Cambios aplicados en Supabase

Se aplicaron estas migraciones al proyecto de desarrollo:

- `harden_and_optimize_jhd`
- `remove_admin_definer_and_duplicate_home_policy`

Los cambios:

- fijan el `search_path` de funciones SQL;
- convierten `jhd_is_admin()` en `SECURITY INVOKER`;
- permiten que cada usuario autenticado consulte únicamente su propia pertenencia administrativa;
- consolidan políticas RLS duplicadas;
- restringen escrituras a cuentas presentes en `jhd_admin_users`;
- eliminan evaluaciones de autorización repetidas por fila;
- añaden índices para claves foráneas sin cobertura;
- eliminan un índice duplicado de artistas;
- conservan la lectura pública del catálogo.

## Verificación realizada

Después de aplicar las migraciones:

- el asesor de seguridad ya no reporta funciones con `search_path` mutable;
- ya no reporta funciones `SECURITY DEFINER` expuestas;
- el asesor de rendimiento ya no reporta políticas RLS duplicadas ni claves foráneas sin índice;
- una prueba con el rol `anon` confirmó acceso a 12 canciones, 11 artistas, 152 categorías y 3 recomendaciones de inicio;
- todos los archivos JavaScript pasaron `node --check` en GitHub Actions.

## Archivos de migración

- `supabase/migrations/20260713_01_harden_and_optimize.sql`
- `supabase/migrations/20260713_02_admin_membership_and_home_policy.sql`

## Controles de GitHub

El workflow `.github/workflows/static-quality.yml` comprueba:

- sintaxis de todos los archivos JavaScript;
- existencia de archivos públicos esenciales;
- existencia de `sitemap` o `sitemap.xml`;
- ausencia de claves privadas `service_role` y `sb_secret_`.

## Pendiente fuera del código

Supabase todavía señala **Leaked Password Protection Disabled**. Esta opción debe habilitarse en el panel de Supabase, dentro de Auth y configuración de contraseñas.

Antes de fusionar el pull request también debe realizarse una entrada real al panel administrativo mediante el enlace enviado por correo.
