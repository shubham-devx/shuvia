import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: { root: process.cwd() },
  async redirects() {
    return [{ source: '/:path*', has: [{ type: 'host', value: 'www.shuvia.com' }], destination: 'https://shuvia.com/:path*', permanent: true }]
  },
}

export default nextConfig
