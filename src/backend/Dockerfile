FROM oven/bun:1.1 as base
WORKDIR /app
COPY package.json ./
COPY . /app

FROM base as dev
RUN bun install
EXPOSE 3000
CMD [ "bun", "run", "dev"]

FROM base as prod
RUN bun install --production
ENV NODE_ENV production
EXPOSE 3000
CMD ["bun", "src/index.ts"]
