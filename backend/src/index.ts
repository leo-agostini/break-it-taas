import jwt from "jsonwebtoken";
import { redisClient } from "./cache/redis";
import { env } from "./config/env";
import { db } from "./db/knex";
import { mapErrorToHttp } from '@/application/errors/http-error-mapper';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

function errorResponse(error: unknown): Response {
  const mapped = mapErrorToHttp(error);
  return Response.json(
    mapped.body,
    {
      status: mapped.status,
      headers: corsHeaders,
    },
  );
}

try {
  await redisClient.connect();
} catch (error) {
  console.error("Redis connection failed", error);
}

const server = Bun.serve({
  port: env.PORT,
  async fetch(request) {
    try {
      const url = new URL(request.url);

      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: corsHeaders,
        });
      }

      if (url.pathname === "/api/health" && request.method === "GET") {
        let postgres = "down";
        let redis = "down";

        try {
          await db.raw("select 1");
          postgres = "up";
        } catch (error) {
          console.error("Postgres check failed", error);
        }

        try {
          if (!redisClient.isOpen) {
            await redisClient.connect();
          }
          await redisClient.ping();
          redis = "up";
        } catch (error) {
          console.error("Redis check failed", error);
        }

        const allHealthy = postgres === "up" && redis === "up";

        return Response.json(
          {
            status: allHealthy ? "ok" : "degraded",
            services: {
              postgres,
              redis,
            },
          },
          {
            status: allHealthy ? 200 : 503,
            headers: corsHeaders,
          },
        );
      }

      if (url.pathname === "/api/token" && request.method === "POST") {
        const body = (await request.json().catch(() => ({}))) as {
          subject?: string;
        };

        const token = jwt.sign(
          {
            sub: body.subject ?? "demo-user",
          },
          env.JWT_SECRET,
          {
            expiresIn: "1h",
          },
        );

        return Response.json(
          {
            token,
          },
          {
            headers: corsHeaders,
          },
        );
      }

      return Response.json(
        {
          status: "not_found",
        },
        {
          status: 404,
          headers: corsHeaders,
        },
      );
    } catch (error) {
      return errorResponse(error);
    }
  },
});

console.info(`Backend listening on http://${server.hostname}:${server.port}`);

const shutdown = async () => {
  server.stop();
  if (redisClient.isOpen) {
    await redisClient.quit();
  }
  await db.destroy();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
