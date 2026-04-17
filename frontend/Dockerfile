FROM node:22-alpine AS build

WORKDIR /app

COPY package.json ./
COPY tsconfig.json ./
COPY react-router.config.ts ./
COPY vite.config.ts ./
COPY tailwind.config.ts ./
COPY postcss.config.cjs ./
COPY components.json ./
COPY src ./src

RUN npm install
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
