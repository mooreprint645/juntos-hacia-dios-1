# Arquitectura de Juntos Hacia Dios

## Estado analizado

Esta descripción parte del código existente antes de la auditoría iniciada el 13 de julio de 2026, cuyo último commit era `7a3a49294bd204c6838fa249d6c38751390e9138`.

El proyecto es una aplicación web estática multipágina publicada con GitHub Pages. No existe un proceso de compilación: cada HTML carga directamente sus hojas de estilo y scripts, y el navegador consulta Supabase mediante la clave pública `anon`.

## Contrato de arranque

El orden correcto es:

1. cargar `@supabase/supabase-js` desde CDN;
2. ejecutar `supabase-bootstrap.js` de forma síncrona;
3. crear `window.supabaseClient`;
4. ejecutar los scripts de página marcados con `defer`.

Los scripts históricos suelen guardar el cliente al evaluarse, por ejemplo:

```js
const client = window.supabaseClient;
```

Por ese motivo el cliente debe existir antes de ejecutar esos archivos. Convertir el bootstrap en una operación asíncrona sin modificar todos los consumidores rompe el contrato y deja los estados visuales en “Cargando”.

`Supabase.js` se conserva únicamente como shim de compatibilidad para versiones antiguas de las páginas. Las páginas actuales deben cargar `supabase-bootstrap.js` directamente.

## Superficie pública

La aplicación pública utiliza una combinación de:

- `public-core.js`, con utilidades compartidas, tarjetas y relaciones del catálogo;
- un script principal por página, como `home.js`, `canciones.js`, `artistas.js`, `categorias.js`, `albumes.js`, `cancion.js` o `artist-page.js`;
- extensiones de una página concreta, como SEO, modo lectura, recomendaciones de inicio o preferencias de canción.

Cada página debe tener un único responsable principal de retirar su estado de carga. Las extensiones pueden mejorar el resultado, pero no deben volver a consultar y renderizar todo el catálogo como mecanismo de recuperación.

## Panel administrativo

`admin-pro.js` es el núcleo del panel. Mantiene el estado global `AP`, consulta las tablas principales, genera las vistas y contiene las operaciones CRUD originales.

Los demás archivos cargados por `admin.html` nacieron durante una evolución incremental de más de 500 commits. No todos son simples correcciones; varios agregan funciones que nunca se integraron al núcleo:

- `admin-access-guard.js`: validación previa de acceso administrativo;
- `admin-donations-plus.js`: edición ampliada de formas de apoyo;
- `admin-messages.js` y `admin-request-page.js`: bandejas de mensajes y solicitudes;
- `admin-main-artist-search.js`: buscador para seleccionar artista principal y carga del gestor de versiones;
- `admin-artist-profile-storage.js` y `admin-artist-bio-fallback.js`: datos ampliados de perfiles;
- `admin-search-fix.js`: presentación colapsable y conservación del foco durante renderizados;
- `admin-category-browser-v2.js`: navegación jerárquica y orden de categorías;
- `admin-category-save-fix.js`: validación de duplicados y guardado compatible con el navegador jerárquico;
- `admin-song-category-picker.js`: selección especializada de categorías para canciones;
- `admin-history.js`, `admin-backup.js` y `admin-backup-import.js`: historial, respaldo e importación;
- `admin-catalog-check.js`: comprobaciones de integridad;
- `admin-home-section.js`: administración de recomendaciones de inicio;
- `admin-public-pages.js`: contenido editable de páginas públicas.

## Por qué existen “parches”

El patrón histórico consistió en preservar `admin-pro.js` y añadir scripts posteriores que:

- sustituyen una función global, como `apRenderView`;
- interceptan un formulario en fase de captura;
- usan `stopImmediatePropagation()` para cancelar el manejador original;
- observan cambios del DOM con `MutationObserver`;
- cargan otra extensión dinámicamente.

Este enfoque permitió agregar funciones rápidamente sin reescribir un archivo central grande, pero creó dependencias implícitas de orden. Un archivo puede requerir que `AP`, `apRenderView`, `apSlug` o un formulario generado por otro archivo ya existan.

## Regla para futuras modificaciones

1. No agregar otro archivo llamado `*-fix.js` para una función nueva.
2. Identificar primero el responsable actual del estado o formulario.
3. Integrar la mejora en el responsable principal o en un módulo con una interfaz explícita.
4. Mantener un único manejador de escritura por formulario.
5. Probar carga pública, sesión anónima, sesión administrativa y sesión autenticada sin permisos.
6. Eliminar el parche anterior solamente después de verificar que todas sus funciones fueron migradas.

## Refactor recomendado

El panel debe refactorizarse gradualmente, no mediante una sustitución completa:

1. **Arranque y acceso**: bootstrap síncrono y guardia administrativa.
2. **Categorías**: unir navegador, selector y guardado en un solo módulo.
3. **Canciones**: unir formulario, relaciones y versiones en una única operación transaccional.
4. **Artistas**: integrar perfil ampliado y búsqueda en el núcleo.
5. **Herramientas**: separar mensajes, solicitudes, respaldos e historial como módulos independientes.
6. **Contenido público**: mantener un script principal por página y extensiones sin renderizado duplicado.

Cada fase debe conservar el comportamiento existente antes de eliminar archivos históricos.
