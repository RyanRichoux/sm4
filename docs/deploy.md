# Deploying to the home server

The app runs as three containers (app, Postgres, nightly backup) and listens on `127.0.0.1:8080` only. Staff reach it through Tailscale, so nothing is exposed to the internet and no router ports are opened.

## One-time setup

1. **Push the code to GitHub** (a private repo is fine). Every push to `main` runs the checks and, if they pass, publishes `ghcr.io/<owner>/smoker-matchmaker:latest`.
2. **Let the server pull the image.** For a private package, create a GitHub token with `read:packages` and run on the server:
   ```bash
   echo <token> | docker login ghcr.io -u <github-username> --password-stdin
   ```
3. **On the server**, make a folder with `docker-compose.yml` and a `.env` copied from `.env.example`. Set `GITHUB_OWNER`, a long random `POSTGRES_PASSWORD` (`openssl rand -base64 32`), and the `BOOTSTRAP_*` values for your organization and first admin.
4. **Start it:**
   ```bash
   docker compose up -d
   docker compose logs -f app     # look for "Created organization" and "Server listening"
   ```
5. **Publish it on your tailnet with HTTPS:**
   ```bash
   sudo tailscale serve --bg 8080
   tailscale serve status         # shows https://<machine>.<tailnet>.ts.net
   ```
   Open that address on any device signed in to your tailnet (install Tailscale on the tablet too). Sign in with the bootstrap admin, choose a real password, then remove the `BOOTSTRAP_*` lines from `.env`.
6. If saving anything fails with "Cross-site request blocked", set `ALLOWED_ORIGINS=https://<machine>.<tailnet>.ts.net` in `.env` and run `docker compose up -d` again.

Public viewer links (audience screen, fighter view) arrive in Phase 1 and will be published with `tailscale funnel` on those paths only.

## Updating

```bash
docker compose pull && docker compose up -d
```

Database migrations run automatically at startup. To pin a version, set `APP_TAG=sha-<short-sha>` in `.env`.

## Backups

The `backup` container writes `backups/matchmaker-<date>.sql.gz` every 24 hours and keeps 30 days. **Copy that folder off the server** (another machine, a NAS, or cloud storage), or a disk failure takes the backups with it.

Restore into an empty database:

```bash
docker compose stop app
gunzip -c backups/matchmaker-2026-11-20_0300.sql.gz | docker compose exec -T db psql -U matchmaker -d matchmaker
docker compose start app
```

Test a restore once, before you need it.

## Admin tasks

Create another organization with its own admin (prints a temporary password):

```bash
docker compose exec app node dist/cli.js create-admin --email them@example.com --name "Their Name" --org "Their Promotions"
```
