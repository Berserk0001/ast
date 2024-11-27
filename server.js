"use strict";

import fastify from "fastify";
import axios from "axios";
import sharp from "sharp";
import { availableParallelism } from "os";
import pick from "./pick.js";

const app = fastify();
const DEFAULT_QUALITY = 40;
const MIN_COMPRESS_LENGTH = 1024;
const MIN_TRANSPARENT_COMPRESS_LENGTH = MIN_COMPRESS_LENGTH * 100;

// Helper: Should compress
function shouldCompress(req) {
  const { originType, originSize, webp } = req.params;

  if (!originType.startsWith("image")) return false;
  if (originSize === 0) return false;
  if (req.headers.range) return false;
  if (webp && originSize < MIN_COMPRESS_LENGTH) return false;
  if (
    !webp &&
    (originType.endsWith("png") || originType.endsWith("gif")) &&
    originSize < MIN_TRANSPARENT_COMPRESS_LENGTH
  ) {
    return false;
  }

  return true;
}

// Helper: Copy headers
function copyHeaders(source, target) {
  for (const [key, value] of Object.entries(source.headers)) {
    try {
      target.setHeader(key, value);
    } catch (e) {
      console.log(e.message);
    }
  }
}

// Helper: Redirect
function redirect(req, reply) {
  const { res } = reply.raw;
  if (res.headersSent) return;

  res.setHeader("content-length", 0);
  res.removeHeader("cache-control");
  res.removeHeader("expires");
  res.removeHeader("date");
  res.removeHeader("etag");
  res.setHeader("location", encodeURI(req.params.url));
  reply.code(302).send();
}

// Helper: Compress
function compress(req, reply, input) {
  const { res } = reply.raw;
  const format = "jpeg";

  sharp.cache(false);
  sharp.simd(true);
  sharp.concurrency(availableParallelism());

  const sharpInstance = sharp({
    unlimited: true,
    failOn: "none",
    limitInputPixels: false,
  });

  input.data
    .pipe(
      sharpInstance
        .resize(null, 16383, {
          withoutEnlargement: true,
        })
        .grayscale(req.params.grayscale)
        .toFormat(format, {
          quality: req.params.quality,
          chromaSubsampling: "4:4:4",
        })
        .on("error", () => redirect(req, reply))
        .on("info", (info) => {
          res.setHeader("content-type", "image/" + format);
          res.setHeader("content-length", info.size);
          res.setHeader("x-original-size", req.params.originSize);
          res.setHeader("x-bytes-saved", req.params.originSize - info.size);
          reply.code(200);
        })
    )
    .pipe(res);
}

// Main: Proxy
app.get("/proxy", async (req, reply) => {
  let url = req.query.url;
  if (!url) return reply.send("bandwidth-hero-proxy");

  req.params = {};
  req.params.url = decodeURIComponent(url);
  req.params.webp = !req.query.jpeg;
  req.params.grayscale = req.query.bw != 0;
  req.params.quality = parseInt(req.query.l, 10) || DEFAULT_QUALITY;

  // Avoid loopback that could cause server hang.
  if (
    req.headers["via"] === "1.1 bandwidth-hero" &&
    ["127.0.0.1", "::1"].includes(req.headers["x-forwarded-for"] || req.ip)
  ) {
    return redirect(req, reply);
  }

  try {
    const origin = await axios.get(req.params.url, {
      headers: {
        ...pick(req.headers, ["cookie", "dnt", "referer", "range"]),
        "user-agent": "Bandwidth-Hero Compressor",
        "x-forwarded-for": req.headers["x-forwarded-for"] || req.ip,
        via: "1.1 bandwidth-hero",
      },
      responseType: "stream",
      maxRedirections: 4,
    });

    if (
      origin.status >= 400 ||
      (origin.status >= 300 && origin.headers.location)
    ) {
      return redirect(req, reply);
    }

    copyHeaders(origin, reply.raw);
    reply.header("content-encoding", "identity");
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Cross-Origin-Resource-Policy", "cross-origin");
    reply.header("Cross-Origin-Embedder-Policy", "unsafe-none");

    req.params.originType = origin.headers["content-type"] || "";
    req.params.originSize = parseInt(origin.headers["content-length"], 10) || 0;

    if (shouldCompress(req)) {
      compress(req, reply, origin);
    } else {
      reply.header("x-proxy-bypass", 1);
      ["accept-ranges", "content-type", "content-length", "content-range"].forEach((header) => {
        if (origin.headers[header]) {
          reply.header(header, origin.headers[header]);
        }
      });
      origin.data.pipe(reply.raw);
    }
  } catch (err) {
    if (err.code === "ERR_INVALID_URL") {
      return reply.code(400).send("Invalid URL");
    }
    redirect(req, reply);
    console.error(err);
  }
});
app.get("/proxy", async (req, reply) => {
  // Route logic here
});
// Start the server
app.listen({ port: 3000 }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Server running at ${address}`);
});
