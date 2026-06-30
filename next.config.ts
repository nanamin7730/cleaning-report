import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    // Vercel の Image Optimization を無効化（無料枠を消費しないようにする）
    // 写真は事前にクライアント側で圧縮済みなので最適化不要
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  serverExternalPackages: ['puppeteer-core', '@sparticuz/chromium'],
  outputFileTracingIncludes: {
    '/api/save-pdf-to-drive': ['./node_modules/@sparticuz/chromium/**/*'],
  },
}

export default nextConfig
