# Panel de Presupuesto — versión con Docker + Base de Datos

Esta es la misma app de presupuesto que ya conocés, pero ahora corre en Docker y
guarda todos los datos en una base de datos PostgreSQL en lugar de solo en el
navegador. Importar y exportar a Excel sigue funcionando exactamente igual.

## Estructura del proyecto

```
presupuesto-app/
├── docker-compose.yml     # Levanta la app + la base de datos
├── .env.example           # Variables de entorno (copiar a .env)
├── server/
│   ├── server.js          # Backend Node/Express (API + sirve el frontend)
│   ├── package.json
│   └── Dockerfile
└── public/
    └── index.html         # El panel de presupuesto (frontend)
```

## Cómo levantarlo

1. Necesitás tener Docker y Docker Compose instalados.
2. (Opcional) Copiá `.env.example` a `.env` si querés cambiar el puerto o las
   credenciales de la base de datos:
   ```bash
   cp .env.example .env
   ```
3. Desde la carpeta `presupuesto-app/`, ejecutá:
   ```bash
   docker compose up -d --build
   ```
4. Abrí el navegador en:
   ```
   http://localhost:3000
   ```

La primera vez que arranca, la base de datos está vacía y el servidor la
"siembra" automáticamente con los mismos datos de ejemplo que traía la app
originalmente. A partir de ahí, cada cambio que hagas (agregar línea, editar
un gasto, un ingreso, etc.) se guarda tanto en la base de datos como en un
respaldo local del navegador (por si se cae la conexión un instante).

## Cómo funciona el guardado

- Cada vez que la app modifica datos, los envía al backend (`PUT /api/state`)
  medio segundo después del último cambio, para no saturar de peticiones
  mientras escribís.
- Al cargar la página, la app pide el estado actual al backend
  (`GET /api/state`). Si el servidor no responde (por ejemplo, mientras
  arranca Docker), usa el último respaldo guardado en este navegador para que
  nunca te quedes sin ver tus datos.
- Abajo a la derecha del panel vas a ver el texto **"guardado en servidor"**
  o, si por algún motivo no hay conexión, **"sin conexión, respaldo local"**.

## Importar / Exportar Excel

No cambió nada: los botones de "Exportar" e "Importar" siguen generando y
leyendo archivos `.xlsx` directamente en el navegador (usando la librería
SheetJS), y lo que importes se guarda automáticamente en la base de datos.

## Respaldar o mover la base de datos

Los datos viven en un volumen de Docker llamado `pgdata`. Para hacer un
respaldo manual de la base de datos:

```bash
docker exec presupuesto_db pg_dump -U presupuesto presupuesto > respaldo.sql
```

Para restaurarlo en otro entorno:

```bash
cat respaldo.sql | docker exec -i presupuesto_db psql -U presupuesto presupuesto
```

## Apagar todo

```bash
docker compose down
```

Esto detiene los contenedores pero conserva el volumen `pgdata`, así que tus
datos siguen ahí la próxima vez que hagas `docker compose up`. Si además
querés borrar los datos guardados, usá:

```bash
docker compose down -v
```
