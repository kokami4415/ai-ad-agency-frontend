// src/app/layout.tsx

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google"; // あなたのフォント設定を活かします
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext"; // これをインポート

// あなたのフォント設定はそのまま使います
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// メタデータを私たちのアプリ用に変更します
export const metadata: Metadata = {
  title: "AI広告代理店アプリ",
  description: "AIによる広告運用支援プラットフォーム",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // 言語を日本語に設定します
    <html lang="ja">
      <body
        // あなたのフォント設定を活かします
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* AuthProviderでchildrenをラップします */}
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}