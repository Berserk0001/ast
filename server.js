"use strict";

import Fastify from "fastify";
import proxy from "./proxy.js";

const fastify = Fastify({
  logger: true,
});

// Define the proxy route
fastify.get("/", proxy);

// Define the favicon route
fastify.get("/favicon.ico", async (req, reply) => {
  // Send a 204 No Content response
  reply.code(204).send();
});

// Start the server
const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: "0.0.0.0" });
    fastify.log.info(`Server running at http://localhost:3000`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
