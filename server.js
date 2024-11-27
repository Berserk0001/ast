import Fastify from 'fastify';
import proxy from './proxy.js'; // Assuming proxy.js is in the same directory

const fastify = Fastify({ logger: true });

// Fastify route using the proxy handler at the root path
fastify.get('/', async (req, reply) => {
  return new Promise((resolve, reject) => {
    // Call the proxy function with raw request and response objects
    proxy(req.raw, reply.raw);

    // Handle the response lifecycle
    reply.raw.on('finish', resolve); // Resolve the promise on successful response
    reply.raw.on('error', reject);  // Reject the promise on error
  });
});

// Start the server
const start = async () => {
  try {
    await fastify.listen({ port: 3000 });
    fastify.log.info('Server running at http://localhost:3000');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
