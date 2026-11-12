import { resolve } from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages are ESM; let Next compile them for both server and client.
  transpilePackages: [
    '@orange-ui/react',
    '@orange-ui/elements',
    '@orange-ui/adapters',
    '@orange-ui/core',
  ],
  // Pin the monorepo root so Turbopack doesn't pick up unrelated lockfiles/workspaces.
  turbopack: { root: resolve(import.meta.dirname, '../../..') },
};

export default nextConfig;
