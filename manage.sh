#!/bin/bash

# Configuración de rutas
BASE_DIR=$(pwd)
BACKEND_DIR="$BASE_DIR/backend"
FRONTEND_DIR="$BASE_DIR/frontend"
PID_FILE="$BASE_DIR/.pids"

start() {
    if [ -f "$PID_FILE" ]; then
        echo "⚠️  Los servidores parecen estar ya en ejecución (archivo .pids encontrado)."
        exit 1
    fi

    echo "🚀 Iniciando CEDEAR Tracker..."

    # Iniciar Backend
    echo "  -> Iniciando Backend..."
    cd "$BACKEND_DIR" || exit
    nohup npm run dev > "$BASE_DIR/backend.log" 2>&1 &
    BACKEND_PID=$!
    echo "$BACKEND_PID" > "$PID_FILE"

    # Iniciar Frontend
    echo "  -> Iniciando Frontend..."
    cd "$FRONTEND_DIR" || exit
    nohup npm run dev > "$BASE_DIR/frontend.log" 2>&1 &
    FRONTEND_PID=$!
    echo "$FRONTEND_PID" >> "$PID_FILE"

    echo "✅ Servidores iniciados en segundo plano."
    echo "   Backend PID: $BACKEND_PID (Log: backend.log)"
    echo "   Frontend PID: $FRONTEND_PID (Log: frontend.log)"
}

stop() {
    if [ ! -f "$PID_FILE" ]; then
        echo "⚠️  No se encontró el archivo .pids. Intentando buscar procesos por nombre..."
        # Intento de limpieza manual si no hay archivo de PIDs
        pkill -f "tsx watch src/index.ts" 2>/dev/null
        pkill -f "vite" 2>/dev/null
        echo "✅ Procesos detenidos (si existían)."
        return
    fi

    echo "🛑 Deteniendo servidores..."
    while IFS= read -r pid; do
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid"
            echo "  -> Proceso $pid detenido."
        else
            echo "  -> Proceso $pid no encontrado."
        fi
    done < "$PID_FILE"

    rm "$PID_FILE"
    echo "✅ Todos los servidores han sido detenidos."
}

case "$1" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    *)
        echo "Uso: $0 {start|stop}"
        exit 1
        ;;
esac
