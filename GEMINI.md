# CEDEAR Tracker - Estado del Proyecto

## Objetivo
Sistema web para el seguimiento de inversiones en CEDEARs, analizando evolución en ARS y USD con datos de IOL.

## Arquitecturay Tecnologías
- **Frontend:** React + TypeScript (Vite)
- **Backend:** Node.js + Express
- **Base de Datos:** SQLite
- **Estilos:** Vanilla CSS

## Hoja de Ruta

### Fase 1: Scaffolding e Infraestructura ✅
- [x] Crear estructura de carpetas.
- [x] Inicializar Frontend (Vite + React + TS).
- [x] Inicializar Backend (Express + SQLite).
- [x] Configurar scripts de inicio y conexión a DB.

### Fase 2: Motor de Precios y Scraping ✅
- [x] Crear servicio de scraping para IOL.
- [x] Crear servicio de scraping para ratios de Comafi.
- [x] Crear servicio de scraping para precios subyacentes (Yahoo Finance).
- [x] Crear servicio de scraping para precios del dólar BNA.
- [x] Implementar lógica de conversión ARS/USD (Dólar implícito).
- [x] Usar este valor para convertir los precios de ARS a USD en la base de datos.
- [x] Automatizar la ejecución del scraper (por ejemplo, diariamente).

### Fase 3: Gestión de Datos
- [x] Definir esquema de DB (Transacciones, Activos).
- [x] Crear API para transacciones.
- [x] Desarrollar importador de datos históricos.

### Fase 4: Dashboard y Visualización
- [x] Pantalla principal de cartera.
- [x] Gráficos de evolución histórica.

## Notas de la Sesión
- Fecha: 2026-02-26
- Se definió el uso de SQLite para persistencia local.
- Se definió IOL como fuente de datos primaria.
