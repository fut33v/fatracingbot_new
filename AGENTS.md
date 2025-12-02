# Repository Guidelines

## Project Structure & Module Organization
- `src/bot` Telegram bot entrypoint (`index.js`) plus Telegraf scenes/actions. Keep new commands modular and reuse helpers from `src/utils`.
- `src/admin` Express admin panel (`server.js`); UI hooks live here.
- `src/models` DB access layer, schema (`schema.sql`), seed and init scripts. Add queries here rather than inside handlers.
- `src/controllers` and `src/services` hold business logic; prefer thin bot/admin handlers that call these.
- `src/utils` shared helpers; `examples/` contains request/response samples; `logs/` is mountpoint for runtime logs.
- Root: `Dockerfile*`, `docker-compose*.yml`, `init.sql`, `SETUP.md`, `README.md` for environment and deployment notes.

## Build, Test, and Development Commands
- `npm install` install dependencies (CommonJS).
- `npm run dev` start bot with nodemon; `npm start` production bot.
- `npm run start:admin` run admin panel; `npm run start-all` boot bot and admin orchestrator.
- `npm run init-db` create schema/tables; `npm run seed` load demo data; `npm run test:db` quick connectivity check.
- `npm run health` service health probe; `npm run check-env` validate required env vars; `npm run setup` one-time env/bootstrap helper.
- Docker: `npm run docker:build`, `npm run docker:dev` (local compose), `npm run docker:prod` (prod compose), `npm run docker:logs`, `npm run docker:down`.

## Coding Style & Naming Conventions
- JavaScript, CommonJS modules; prefer async/await, 2-space indent, trailing semicolons, single quotes.
- Name files and exports by feature (`userModel.js`, `orderController.js`); Telegraf actions use snake-cased callback IDs for clarity.
- Keep DB code in models; sanitize user input before DB use. Reuse config via `process.env` and `dotenv`.

## Testing Guidelines
- No full test suite yet; add Jest or similar for new logic. Minimum: run `npm run test:db` after schema changes.
- Place tests near the code they cover (`src/<area>/__tests__`); name files `<module>.test.js`.
- For bot flows, add mock context tests or record sample payloads in `examples/`; verify `npm run health` before deploy.

## Commit & Pull Request Guidelines
- Write imperative, focused commits; if adding a feature, prefer `feat: …`; for fixes, `fix: …`; group DB migrations with relevant code.
- PRs should state scope, risk, and rollout plan; link issues/tasks and include screenshots or bot transcripts for UI/UX or command changes.
- Call out env var additions, DB migrations (`src/models/schema.sql`), and new scripts so deployers can update infra and `.env`.

## Environment & Security Notes
- Required env vars live in `.env.example` (e.g., `BOT_TOKEN`, `FATRACING_CHANNEL_ID`, DB creds). Never commit real secrets.
- Keep tokens/IDs out of logs; rotate credentials if exposed. Use Docker env files instead of baking secrets into images.
