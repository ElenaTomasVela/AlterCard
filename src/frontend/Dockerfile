FROM oven/bun:1.1.4-alpine as base
WORKDIR /app

COPY package.json ./
RUN bun install

COPY . /app

FROM base as dev
EXPOSE 5173
CMD [ "bun", "run", "dev", "--host"]

FROM base as build
ENV VITE_BACKEND_URL http://localhost:3000
ENV VITE_BACKEND_WS_URL ws://localhost:3000
RUN bun run vite build

FROM nginx:stable-alpine3.19 as prod
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD [ "nginx", "-g", "daemon off;"]
