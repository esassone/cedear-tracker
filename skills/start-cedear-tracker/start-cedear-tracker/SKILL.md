---
name: start-cedear-tracker
description: Inicia el backend y frontend del proyecto CEDEAR Tracker usando npm run dev. Úsalo cuando el usuario pida iniciar, levantar o ejecutar el proyecto completo.
---

# Iniciar Proyecto CEDEAR Tracker

Esta skill automatiza el inicio simultáneo del backend y del frontend del proyecto CEDEAR Tracker.

## Procedimiento

Para iniciar el proyecto, sigue estos pasos:

1. **Iniciar el Backend:**
   - Directorio: `cedear-tracker/backend`
   - Comando: `npm run dev`
   - Parámetros: Ejecutar en segundo plano (`is_background: true`).
   - Log: Los logs se guardarán en `cedear-tracker/backend/backend.log`.

2. **Iniciar el Frontend:**
   - Directorio: `cedear-tracker/frontend`
   - Comando: `npm run dev`
   - Parámetros: Ejecutar en segundo plano (`is_background: true`).
   - Log: Los logs se guardarán en `cedear-tracker/frontend/frontend.log`.

3. **Verificación:**
   - Una vez iniciados, informa al usuario que el backend está corriendo (usualmente en el puerto 3001 o el configurado en `.env`) y el frontend en el puerto que indique Vite (usualmente 5173).

## Ejemplo de ejecución

```javascript
// Backend
run_shell_command({
  command: "npm run dev > backend.log 2>&1",
  dir_path: "cedear-tracker/backend",
  is_background: true,
  description: "Iniciando backend de CEDEAR Tracker"
});

// Frontend
run_shell_command({
  command: "npm run dev > frontend.log 2>&1",
  dir_path: "cedear-tracker/frontend",
  is_background: true,
  description: "Iniciando frontend de CEDEAR Tracker"
});
```
