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
4. Algunas políticas evaluaban `auth.jwt()` por cada fila.
5. Tres funciones no fijaban `search_path`.
6. La función administrativa podía invocarse con el rol anónimo.
7. Cuatro claves foráneas no tenían índice de apoyo.
8. Existían dos índices equivalentes para el slug de artistas.
9. El repositorio no contaba con validación automática de sintaxis JavaScript ni detección básica de secretos privados.

## Cambios incluidos

- Migración SQL repetible para endurecer funciones y permisos.
- Consolidación de políticas administrativas del catálogo.
- Uso de una única fuente de autorización: `jhd_admin_users`.
- Índices para claves foráneas usadas en relaciones.
- Eliminación de un índice duplicado.
- Workflow de GitHub Actions para validar JavaScript y archivos públicos esenciales.
- Comprobación para evitar publicar claves `service_role` o `sb_secret_`.

## Aplicación

La migración se encuentra en:

`supabase/migrations/20260713_01_harden_and_optimize.sql`

Debe probarse primero contra el proyecto de desarrollo y volver a ejecutar los asesores de seguridad y rendimiento antes de trasladarla a un proyecto productivo.

## Pendiente fuera del código

La protección contra contraseñas filtradas debe habilitarse desde la configuración de Supabase Auth. No se modifica mediante esta migración.
