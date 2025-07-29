"use client";

import { useProject } from '@/contexts/ProjectContext';

export default function Stage4Page() {
  const { projectData } = useProject();

  if (!projectData) {
    return <p>データを読み込み中...</p>;
  }

  return (
    <div className="bg-white p-8 rounded-lg shadow mb-8">
      <h2 className="text-xl font-semibold text-gray-800 mb-6">4. アウトプット</h2>
      <p className="text-gray-600">この機能は現在開発中です。確定した戦略仮説に基づき、ここに具体的な広告クリエイティブが一覧表示されます。</p>
    </div>
  );
}