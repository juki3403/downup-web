/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    "/api/fetch-info": ["./node_modules/youtube-dl-exec/bin/**"],
    "/api/resolve": ["./node_modules/youtube-dl-exec/bin/**"],
  },
};

module.exports = nextConfig;
