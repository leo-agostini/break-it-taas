FROM oven/bun:1.2.13

WORKDIR /app

COPY package.json ./
COPY tsconfig.json ./
COPY knexfile.ts ./
COPY src ./src

RUN bun install

EXPOSE 3001

CMD ["bun", "run", "src/index.ts"]
