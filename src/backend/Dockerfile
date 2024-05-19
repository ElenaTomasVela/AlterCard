FROM oven/bun:1
WORKDIR /app

COPY package.json bun.lockb ./
RUN bun install

COPY . /app

EXPOSE 3000

ENTRYPOINT [ "bun", "run", "dev"]
