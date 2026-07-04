FROM node:22-alpine AS build

WORKDIR /app

ARG VITE_API_URL=/api
ARG VITE_API_SERVER_URL=http://backend.app.svc.cluster.local/api
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_API_SERVER_URL=$VITE_API_SERVER_URL

COPY tsconfig.base.json /tsconfig.base.json
COPY frontend/package.json ./
COPY frontend/tsconfig.json ./
COPY frontend/react-router.config.ts ./
COPY frontend/vite.config.ts ./
COPY frontend/tailwind.config.ts ./
COPY frontend/postcss.config.cjs ./
COPY frontend/components.json ./
COPY frontend/src ./src

RUN npm install
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
