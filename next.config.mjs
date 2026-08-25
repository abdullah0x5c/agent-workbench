/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['mongoose', 'mongodb'],
  eslint: {
    ignoreDuringBuilds: true,
  },
}

export default nextConfig
