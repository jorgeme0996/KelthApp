# El Mejor Menú

App móvil (iOS + Android) que genera un menú semanal mexicano Low Carb, su lista
de compras y un asistente de IA para responder dudas sobre tu plan.

## Estructura del proyecto

```
ElMejorMenu/
  app/        App Expo (React Native + TypeScript, Expo Router)
  server/     API Express + Prisma + PostgreSQL
  docker-compose.yml   Postgres local
```

## Requisitos

- Node.js **22.13+** (Expo SDK 56 lo requiere). Si usas nvm:
  ```bash
  nvm install 22
  nvm use 22
  ```
- Docker (para Postgres local)
- Una API key de Anthropic (Claude) para el asistente de chat

## 1. Levantar la base de datos

```bash
cd ElMejorMenu
docker compose up -d
```

Esto levanta Postgres en `localhost:5432` con la base `elmejormenu`
(usuario/contraseña `elmejormenu`).

## 2. Backend (server/)

```bash
cd server
cp .env.example .env
```

Edita `server/.env`:

- `DATABASE_URL`: ya viene configurada para el Postgres de docker-compose.
- `JWT_SECRET`: cámbiala por una cadena aleatoria larga.
- `ANTHROPIC_API_KEY`: tu API key de Claude (sin esto, el chat responde 503).
- `PORT`: puerto de la API (por defecto `4000`).

Instala dependencias, corre migraciones y siembra las recetas:

```bash
npm install
npm run prisma:migrate
npm run seed
npm run dev
```

El servidor queda escuchando en `http://localhost:4000` (health check en
`/health`).

## 3. App móvil (app/)

Requiere Node 22+ (ver Requisitos).

```bash
cd app
npm install
npx expo start
```

Escanea el QR con la app **Expo Go** (Android/iOS) o presiona `i`/`a` para
abrir un simulador/emulador.

### Conectar la app al backend

La app llama a la API usando `extra.apiUrl` en `app/app.json` (por defecto
`http://localhost:4000`):

- **Simulador iOS**: `localhost` funciona tal cual.
- **Emulador Android**: usa `http://10.0.2.2:4000`.
- **Dispositivo físico con Expo Go**: usa la IP de tu computadora en la red
  local, p. ej. `http://192.168.1.50:4000`.

Cambia el valor de `extra.apiUrl` en `app/app.json` según tu caso y reinicia
Expo.

## Flujo de uso

1. Crear cuenta (nombre, correo, contraseña) y elegir cuántas veces al día
   quieres comer (3 a 5).
2. En "Hoy" genera tu menú semanal Low Carb con recetas mexicanas.
3. Revisa el "Menú" día por día, cambia (swap 🔀) alguna comida si no te
   convence.
4. Abre cualquier receta para ver ingredientes y preparación.
5. Ve a "Lista" para tu lista de compras categorizada, basada en tu menú.
6. Usa "Asistente" para preguntar sobre tu dieta, sustituciones o tu plan.
7. En "Perfil" puedes cambiar cuántas veces comes al día y ver el resumen de
   tu dieta Low Carb.

## Notas

- Por ahora solo existe la dieta **Low Carb**, basada en el semáforo
  proporcionado (`server/src/data/diets/lowcarb.json`).
- Las recetas semilla están en `server/src/data/recipes/lowcarb-mexicano.json`.
