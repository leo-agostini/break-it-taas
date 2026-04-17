import "dotenv/config";

const required = ["JWT_SECRET"] as const;

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: Number(process.env.PORT ?? 3001),
  JWT_SECRET: process.env.JWT_SECRET as string,
  REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",
  DATABASE_URL:
    process.env.DATABASE_URL ??
    "postgres://postgres:postgres@localhost:5432/app",
};
