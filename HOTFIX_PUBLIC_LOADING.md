# Hotfix de carga pública

Este cambio evita que las páginas públicas permanezcan indefinidamente en “Cargando…”.

## Comportamiento

- Inicializa Supabase de forma segura.
- Intenta un CDN alternativo cuando el cliente no está disponible.
- Expone una promesa global de preparación.
- Instala un cargador de respaldo para Inicio, Canciones, Artistas, Categorías, Álbumes y Donaciones.
- Mantiene los cargadores principales actuales y solo interviene si siguen sin responder.
- Muestra un error claro en lugar de dejar esqueletos de carga permanentes.

## Datos

El registro de donación de prueba se desactivó directamente en Supabase. No se eliminó.
