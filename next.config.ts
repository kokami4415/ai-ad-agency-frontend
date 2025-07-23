/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  // ESLint設定をここに記述
  eslint: {
    // any型の使用に関するエラー/警告を無視する
    // 開発初期段階でanyを多用する場合に便利
    ignoreDuringBuilds: true, // ビルド中にESLintのチェックを完全に無視する（推奨）
    // または、特定のルールを無効にする場合：
    // rules: {
    //   "@typescript-eslint/no-explicit-any": "off"
    // }
  },
};
export default nextConfig;
