import fastify from 'fastify';
import proxyImage from './proxy.js';  // Importing the proxy logic

const app = fastify({ logger: true });

// Route to handle image proxying at root path ("/")
app.get('/', proxyImage);

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
