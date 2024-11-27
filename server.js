import fastify from 'fastify';
import proxyImage from './proxy.js';  // Assuming you have your proxy logic in proxy.js

const app = fastify({ logger: false });

// Route to handle image proxying at root path ("/")
app.get('/', proxyImage);

// Route to handle favicon.ico request
app.get('/favicon.ico', (req, reply) => {
  reply.status(204).send(); // Respond with no content (204 No Content)
});

// Start Fastify server
const start = async () => {
  try {
    await app.listen({ port: 3000 });
    console.log('Server running at http://localhost:3000');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
