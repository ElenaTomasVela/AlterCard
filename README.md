# tfg-card-game

A card game with multiplayer support with WebSockets, made with
Bun, React and Elysia.

# Run instructions

## Locally

Before anything else, make sure you have (Bun)[https://bun.sh/] installed.

### Backend

Navigate to the `src/backend` folder and install the dependencies with:

```bash
bun install
```

Afterwards, configure your `.env` file with the correct parameters for your
MongoDB database. An `.env.example` file is provided for reference.

Additionally, you can populate the database with example data by running:

```bash
bun run populate
```

Finally run the development server with:

```bash
bun run dev
```

By default, it will run on port 3000.

#### Testing

Make sure you create a `.env.test` file in the `src/backend` folder, with valid MongoDB credentials.
An `.env.test.example` file is provided for reference, with a different database by default.

You can run tests with:

```bash
bun test
```

Keep in mind that the database needs to be running in order for the tests to pass.

### Frontend

Similarly as before, install the dependencies first:

```bash
bun install
```

You can then run the frontend server with:

```bash
bun run dev
```

By default, it will run on port 5173.

## With Docker

The backend can receive a `.env.docker` file to separate the local execution environment from the Docker container's.
A working example is provided in `.env.docker.example`.
Keep in mind that the backend can't simply get "localhost" as the host for the MongoDB database.

Inside the main `src` folder, you can use docker compose to run the frontend, backend, and a MongoDB database.

```bash
docker compose up -d
```

You can also choose to only run the database service and access it locally.

```bash
docker compose up -d db
```

By default, it will run on port 27017.

