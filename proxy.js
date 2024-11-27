import axios from 'axios';
import sharp from 'sharp';
import { availableParallelism } from 'os';

// Helper: Should Compress
function shouldCompress(headers, query) {
  const contentType = headers['content-type'] || '';
  const contentLength = parseInt(headers['content-length'], 10) || 0;

  if (!contentType.startsWith('image')) return false;
  if (contentLength === 0) return false;
  if (query.webp && contentLength < 1024) return false;

  return true;
}

// Helper: Compress Image
function compressImage(inputStream, options) {
  const { quality, grayscale } = options;
  const format = 'jpeg';

  sharp.cache(false);
  sharp.simd(true);
  sharp.concurrency(availableParallelism());

  return sharp()
    .resize(null, 16383, { withoutEnlargement: true })
    .grayscale(grayscale)
    .toFormat(format, { quality, chromaSubsampling: '4:4:4' });
}

// Proxy Logic
async function proxyImage(req, reply) {
  const url = decodeURIComponent(req.query.url || '');
  const grayscale = req.query.bw != 0;
  const quality = parseInt(req.query.l, 10) || 40;

  if (!url) reply.send('bandwidth-hero-proxy);

  try {
    // Fetch the image from the URL
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Fastify-Image-Proxy' },
      responseType: 'stream',
    });

    const { headers } = response;

    // Check if the image should be compressed
    if (shouldCompress(headers, req.query)) {
      const transformer = compressImage(response.data, { quality, grayscale });
      reply.headers({
        'Content-Type': 'image/jpeg',
        'Access-Control-Allow-Origin': '*',
      });
      return response.data.pipe(transformer).pipe(reply.raw);
    } else {
      reply.headers(headers);
      return response.data.pipe(reply.raw);
    }
  } catch (error) {
    console.error(error);
    return reply.status(500).send('Error fetching or processing image.');
  }
}

export default proxyImage;
