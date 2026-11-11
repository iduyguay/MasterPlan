# MasterPlan

MasterPlan is a self-hosted, intentionally vulnerable web security challenge. Players use a terminal-style interface to discover clues and complete five stages covering reconnaissance, authentication, cryptography, timing, and a final vault.

This is a training target, not a secure application or a production authentication example. The weak signing setup, exposed clues, sample secrets, and challenge bypasses are deliberate parts of the exercise. Run it only in an environment you control and do not expose it to the public internet.

## Run with Docker Compose

Requirements: Docker with the Compose plugin.

```sh
docker compose up --build
```

Open [http://localhost:8080](http://localhost:8080). The frontend, backend, and Nginx edge proxy run as separate services. Compose keeps the SQLite database in a named volume.

Stop the services with:

```sh
docker compose down
```

To reset local player progress and the database volume:

```sh
docker compose down --volumes
```

The checked-in Compose file contains challenge-only credentials and a fixed AES key. Treat them as public test fixtures. Do not reuse them in another project or for any real service.

## Challenge stages

1. **Recon** — inspect API responses and headers for the first fragment.
2. **Elevation** — examine the challenge token and the deliberately weak signing flow.
3. **Cipher** — derive the stage key and decrypt the supplied message.
4. **Race window** — submit the collected fragments during the short time window.
5. **Vault** — assemble the fragments and unlock the final stage.

The frontend includes the command list; enter `help` in the terminal for in-app guidance. Progress is stored in the backend SQLite database.

## Project structure

- `frontend/`: React and Vite terminal interface.
- `backend/`: Express API, authentication flow, puzzle stages, and SQLite persistence.
- `nginx/`: edge proxy configuration.
- `docker-compose.yml`: local multi-container setup.

## Stack

React, Vite, Node.js, Express, SQLite, Docker Compose, and Nginx.

## Security boundary

The challenge intentionally demonstrates patterns that are unsafe outside a lab, including weak JWT signing, predictable fixture secrets, and puzzle routes that reward bypassing the intended controls. The container setup is for local learning; it does not make the application safe to deploy publicly.
