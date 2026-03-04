---
name: stop-cedear-tracker
description: Detiene el proyecto CEDEAR Tracker liberando los puertos 3001 (backend) y 5173 (frontend). Úsalo cuando el usuario pida detener, parar, bajar o finalizar el proyecto.
---

# Stop CEDEAR Tracker

## Overview
Este skill permite detener de forma segura los procesos del proyecto CEDEAR Tracker que están escuchando en los puertos configurados.

## Workflow
Cuando el usuario solicite detener el proyecto, sigue estos pasos:

1.  **Ejecutar Script de Parada**: Llama al script `scripts/stop_ports.sh` para matar los procesos en los puertos 3001 y 5173.
2.  **Confirmar Estado**: Informa al usuario sobre el resultado de la operación para cada puerto.

## Scripts
- `scripts/stop_ports.sh`: Script de bash que identifica y termina los procesos en los puertos 3001 y 5173 usando `lsof` y `kill`.
