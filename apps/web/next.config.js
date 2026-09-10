import process from 'node:process';
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.OPSG_DEV_PROXY ? undefined : 'export',
  trailingSlash: true,
  transpilePackages: ['@repo/registry'],
  images: { unoptimized: true },
  ...(process.env.OPSG_DEV_PROXY ? { async rewrites() { return [{ source: '/api/:path*', destination: 'http://127.0.0.1:8787/api/:path*' }]; } } : {}),
};
export default nextConfig;
