FROM oven/bun:latest
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install
COPY vite.config.ts .
CMD ["bun", "run", "dev", "--host"]
