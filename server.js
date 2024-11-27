"use strict";

import Fastify from "fastify";
import proxy from "./proxy.js";

const fastify = Fastify({
  logger: true,
});

// Define the proxy route
fastify.get("/", proxy);

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
