import Fastify from 'fastify';
import proxy from './proxy.js'; // Import the proxy function

const fastify = Fastify({ logger: true });

// Use `/` as the route to handle requests
fastify.get('/', (req, reply) => {
  // Adapt Fastify's `req` and `reply` objects for the proxy.js handler
  const resAdapter = {
    setHeader: (name, value) => reply.header(name, value),
    removeHeader: (name) => reply.removeHeader(name),
    status: (statusCode) => {
      reply.code(statusCode);
      return resAdapter;
    },
    end: (body) => reply.send(body),
    pipe: (stream) => {
      stream.pipe(reply.raw);
    },
    headersSent: false, // Fastify handles this internally
  };

  proxy(req.raw, resAdapter); // Pass the raw request and the adapted response
});

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
