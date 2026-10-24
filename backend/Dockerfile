# Build: compile TypeScript with the Adonis assembler into ./build.
FROM node:24-slim AS build

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN node ace build

# Runtime: only the compiled app and production dependencies.
FROM node:24-slim

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/build ./
RUN npm install --omit=dev

EXPOSE 3001

CMD ["node", "bin/server.js"]
