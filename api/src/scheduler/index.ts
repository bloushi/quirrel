import fastify from "fastify";
import redisPlugin from "./redis";
import tokensPlugin from "./tokens";
import tokensRoute from "./routes/tokens";
import health from "./routes/health";
import jobs from "./routes/jobs";
import usageRoute from "./routes/usage";
import * as oas from "fastify-oas";
import * as pack from "../../package.json";
import basicAuthPlugin from "./basic-auth";
import type { RedisOptions } from "ioredis";
import type { AddressInfo } from "net"

export interface QuirrelServerConfig {
  port?: number;
  host?: string;
  redis?: RedisOptions | string;
  passphrases?: string[];
}

export async function createServer({
  port = 9181,
  host = "0.0.0.0",
  redis,
  passphrases,
}: QuirrelServerConfig) {
  const app = fastify({
    logger: true,
  });

  app.register(oas, {
    routePrefix: "/documentation",
    swagger: {
      info: {
        title: "Quirrel API",
        description: "The Queueing Solution for Next.js x Vercel",
        version: pack.version,
      },
      externalDocs: {
        url: "https://quirrel.dev",
        description: "Find more info here",
      },
      consumes: ["application/json"],
      produces: ["application/json"],
    },
    exposeRoute: true,
  });

  app.register(redisPlugin, { opts: redis });

  if (passphrases) {
    app.register(basicAuthPlugin, { passphrases });
    app.register(tokensPlugin);
    app.register(tokensRoute, { prefix: "/tokens" });
    app.register(usageRoute, { prefix: "/usage" });
  }

  app.register(health, { prefix: "/health" });
  app.register(jobs, { prefix: "/jobs", auth: !!passphrases?.length });

  await app.listen(port, host);

  app.ready(async () => {
    await app.oas();
  });

  return {
    server: app.server,
    port: (app.server.address() as AddressInfo).port,
    async close() {
      app.log.info("Closing.");
      await app.close();
    },
  };
}