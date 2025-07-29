"use client";

import { useEffect, useState, FormEvent } from 'react';
import { useRequireAuth } from '@/contexts/AuthContext';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { httpsCallable } from "firebase/functions";
import { db, functions } from '@/lib/firebase';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import Markdown from 'react-markdown';

// --- 型定義 ---
interface ProductElements { features: string; benefits: string; results: string; authority: string; offer: string; }
interface Stage1Item { id: string; title: string; content: string; }
interface Stage1Data {
  productInfo: Stage1Item[]; customerInfo: Stage1Item[]; competitorInfo: Stage1Item[];
  marketInfo: Stage1Item[]; brandInfo: Stage1Item[]; pastData: Stage1Item[];
  useDeepResearch?: boolean;
}
interface Stage2Data { productElements: ProductElements; }
interface Stage3Data { creativeParts: string; }
interface Stage4Data { catchCopy: string; subCopy: string; visualImageDescription: string; ctaButtonText: string; }

// 【修正点】 stageLinksのための型定義を追加
interface StageLink {
  num: number;
  path: string;
  label: string;
}

export default function ProjectStagePage() {
  const { user } = useRequireAuth();
  const params = useParams();
  const router = useRouter();

  const projectId = params.projectId as string;
  const stageSlug = Array.isArray(params.stage) ? params.stage[0] : 'stage1';
  const currentViewStage = parseInt(stageSlug.replace('stage', ''), 10) || 1;

  const [projectData, setProjectData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  // ... (他のState定義は変更なし) ...

  useEffect(() => {
    // ... (useEffectの中身は変更なし) ...
  }, [user, projectId, router, currentViewStage]);

  // --- (全てのハンドラ関数は変更なし) ---

  if (loading) { return <div className="flex items-center justify-center min-h-screen"><p>プロジェクトを読み込み中...</p></div>; }

  const renderStageContent = () => {
    // ... (renderStageContentの中身は変更なし) ...
  };

  const currentStage = projectData?.currentStage || 1;
  // 【修正点】 作成した型を適用
  const stageLinks: StageLink[] = [
    { num: 1, path: `/stage1`, label: "1. 情報基盤" },
    { num: 2, path: `/stage2`, label: "2. 商品要素抽出" },
    { num: 3, path: `/stage3`, label: "3. クリエイティブパーツ" },
    { num: 4, path: `/stage4`, label: "4. 戦略仮説" },
    { num: 5, path: `/stage5`, label: "5. アウトプット" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        {/* ... (HeaderのJSXは変更なし) ... */}
      </header>

      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="mb-8 p-2 bg-white rounded-lg shadow-md flex justify-around border border-gray-200">
          {stageLinks.map(link => {
            const isActive = stageSlug === `stage${link.num}`;
            const isEnabled = link.num <= currentStage;
            return (
              <Link 
                key={link.num}
                href={isEnabled ? `/dashboard/projects/${projectId}/stage${link.num}` : '#'}
                className={`flex-1 text-center px-4 py-2 text-sm font-medium rounded-md transition-colors
                  ${isActive ? 'bg-indigo-600 text-white shadow' : 'text-gray-700 hover:bg-gray-100'}
                  ${!isEnabled ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                onClick={(e) => { if (!isEnabled) e.preventDefault(); }}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
        {error && <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-md text-sm">{error}</div>}
        {renderStageContent()}
      </main>
    </div>
  );
}