FROM oven/bun:1 as base
WORKDIR /app

COPY package.json bun.lockb ./
RUN bun install

COPY . /app

ENTRYPOINT [ "bun", "run", "dev", "--host"]
