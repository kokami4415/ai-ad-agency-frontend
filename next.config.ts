// next.config.ts (Vercel最適化版)
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // Vercelに最適化された出力形式
  images: {
    unoptimized: true, // Vercelでのデフォルト最適化を避けるため
  },
  // App Routerを有効にする（デフォルトで有効なはずですが念のため）
  experimental: {
    appDir: true,
  },
};
export default nextConfig;