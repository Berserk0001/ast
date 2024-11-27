"use strict";

/*
 * proxy.js
 * The bandwidth hero proxy handler with integrated modules.
 */
import axios from "axios";
import sharp from "sharp";
import { availableParallelism } from "os";
import pick from "./pick.js";

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
function copyHeaders(source, reply) {
  for (const [key, value] of Object.entries(source.headers)) {
    try {
      reply.header(key, value);
    } catch (e) {
      console.log(e.message);
    }
  }
}

// Helper: Redirect
function redirect(req, reply) {
  if (reply.sent) return;

  reply
    .header("content-length", 0)
    .removeHeader("cache-control")
    .removeHeader("expires")
    .removeHeader("date")
    .removeHeader("etag")
    .header("location", encodeURI(req.params.url))
    .code(302)
    .send();
}

// Helper: Compress
function compress(req, reply, input) {
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
          reply
            .header("content-type", "image/" + format)
            .header("content-length", info.size)
            .header("x-original-size", req.params.originSize)
            .header("x-bytes-saved", req.params.originSize - info.size)
            .code(200);
        })
    )
    .pipe(reply.raw);
}

// Main: Proxy
async function proxy(req, reply) {
  // Extract and validate parameters from the request
  const url = req.query.url;
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
      maxRedirects: 4,
    });

    // Handle non-2xx or redirect responses.
    if (
      origin.status >= 400 ||
      (origin.status >= 300 && origin.headers.location)
    ) {
      return redirect(req, reply);
    }

    // Set headers and stream response.
    copyHeaders(origin, reply);
    reply
      .header("content-encoding", "identity")
      .header("Access-Control-Allow-Origin", "*")
      .header("Cross-Origin-Resource-Policy", "cross-origin")
      .header("Cross-Origin-Embedder-Policy", "unsafe-none");

    req.params.originType = origin.headers["content-type"] || "";
    req.params.originSize = origin.headers["content-length"] || "0";

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
}

export default proxy;
