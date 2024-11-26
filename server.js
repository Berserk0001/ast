import fastify from 'fastify';
import proxy from './proxy.js';
import express from '@fastify/express';

const fastify = fastify({
  logger: false
});

  const PORT = process.env.PORT || 8080;
  
  async function start() {
    // Register the express plugin
    await fastify.register(express);
  
    // Use Express middleware for handling the proxy
    fastify.use('/', (req, res, next) => {
      if (req.path === '/') {
        return proxy(req, res);
      }
      next();
    });
  
    // Handle favicon.ico separately
    fastify.use('/favicon.ico', (req, res) => {
      res.status(204).end();
    });
  
    // Start the server
    fastify.listen({host: '0.0.0.0' , port: PORT }, function (err, address) {
    if (err) {
      fastify.log.error(err)
      process.exit(1)
    }
  });
  }
  
  start();
