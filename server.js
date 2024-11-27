"use strict";

import fastify from "fastify";
import proxy from "./proxy.js"; // Import the proxy handler

const app = fastify({
  logger: false, // Enable logging for debugging
});

// Register the proxy route
app.get("/", proxy);



// Start the server
const start = async () => {
  try {
    const PORT = process.env.PORT || 3000; // Use environment variable or default to 3000
    await app.listen({ port: PORT });
    console.log(`Server is running on http://localhost:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1); // Exit process with failure code
  }
};

start();
