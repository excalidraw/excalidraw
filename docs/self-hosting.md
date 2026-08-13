# Internal whiteboard deployment

The production stack runs the Excalidraw frontend, the collaboration API and Socket.IO relay, and PostgreSQL. Encrypted file blobs remain in Google Cloud Storage. Scene and file contents are encrypted in the browser; the room key is kept in the invite URL hash and is never sent to the backend.

## Prerequisites

- Docker Engine with Docker Compose
- A Google Cloud Storage bucket
- A service-account JSON key that can read and create objects in that bucket
- A reverse proxy or firewall policy appropriate for the VPS if port 80 is not exposed directly

## Configure and start

1. Copy `.env.prod.example` to `.env.prod` and set a strong URL-safe `POSTGRES_PASSWORD`, the existing `GCS_BUCKET`, and optionally `HTTP_PORT`.
2. Put the service-account key at `gcs-key.json` in the repository root. This path and `*-key.json` are gitignored. Do not commit the key or bake it into an image.
3. Start the stack:

   ```sh
   docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
   ```

4. Verify the backend through nginx:

   ```sh
   curl http://localhost:80/health
   ```

   Replace `80` with the value of `HTTP_PORT` if you changed it.

   It should return `{"status":"ok"}`.

PostgreSQL data is retained in the `postgres-data` named volume. The backend runs `prisma migrate deploy` each time its container starts. Only nginx exposes a host port; PostgreSQL and the Node backend stay on the Compose network.

## Update and operate

After pulling or applying code changes, rebuild with the same `docker compose ... up -d --build` command. View service logs with:

```sh
docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f
```

Back up both the PostgreSQL volume/database and the GCS bucket. There is no automatic retention or deletion policy in this application.
