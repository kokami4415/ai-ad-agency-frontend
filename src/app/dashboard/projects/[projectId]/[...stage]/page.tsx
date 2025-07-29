"use client";

import { useEffect, useState, FormEvent, ReactNode } from 'react'; // ReactNode をインポート
import { useRequireAuth } from '@/contexts/AuthContext';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { httpsCallable } from "firebase/functions";
import { db, functions } from '@/lib/firebase';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import Markdown from 'react-markdown';

// --- (すべての型定義は変更なし) ---
interface ProductElements { /* ... */ }
interface Stage1Item { /* ... */ }
interface Stage1Data { /* ... */ }
interface Stage2Data { /* ... */ }
interface Stage3Data { /* ... */ }
interface Stage4Data { /* ... */ }
interface StageLink { /* ... */ }

export default function ProjectStagePage() {
  const { user } = useRequireAuth();
  const params = useParams();
  const router = useRouter();

  const projectId = params.projectId as string;
  const stageSlug = Array.isArray(params.stage) ? params.stage[0] : 'stage1';
  const currentViewStage = parseInt(stageSlug.replace('stage', ''), 10) || 1;

  // --- (すべてのState定義は変更なし) ---
  const [projectData, setProjectData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState('');
  const [stage1Data, setStage1Data] = useState<Omit<Stage1Data, 'useDeepResearch'>>({ /* ... */ });
  const [stage2Data, setStage2Data] = useState<Stage2Data | null>(null);
  const [stage3Data, setStage3Data] = useState<Stage3Data | null>(null);
  const [stage4Data, setStage4Data] = useState<Stage4Data | null>(null);
  const [newInfoType, setNewInfoType] = useState<keyof Omit<Stage1Data, 'useDeepResearch'>>('productInfo');
  const [newInfoTitle, setNewInfoTitle] = useState('');
  const [newInfoContent, setNewInfoContent] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [useDeepResearch, setUseDeepResearch] = useState(false);

  // --- (useEffect と すべてのハンドラ関数は変更なし) ---

  if (loading) { return <div className="flex items-center justify-center min-h-screen"><p>プロジェクトを読み込み中...</p></div>; }

  // 【修正点】 関数の戻り値の型を : ReactNode として明示的に指定
  const renderStageContent = (): ReactNode => {
    switch (currentViewStage) {
      case 1:
        return ( <div className="bg-white p-8 rounded-lg shadow mb-8">{/* ... ステージ1のJSX ... */}</div> );
      case 2:
        return ( <div className="bg-white p-8 rounded-lg shadow mb-8">{/* ... ステージ2のJSX ... */}</div> );
      case 3:
        return ( <div className="bg-white p-8 rounded-lg shadow mb-8">{/* ... ステージ3のJSX ... */}</div> );
      case 4:
        return ( <div className="bg-white p-8 rounded-lg shadow mb-8">{/* ... ステージ4のJSX ... */}</div> );
      case 5:
        return ( <div className="bg-white p-8 rounded-lg shadow mb-8">{/* ... ステージ5のJSX ... */}</div> );
      default:
        return <p>無効なステージです。</p>;
    }
  };

  const currentStage = projectData?.currentStage || 1;
  const stageLinks: StageLink[] = [ /* ... (変更なし) ... */ ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">{/* ... (変更なし) ... */}</header>
      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="mb-8 p-2 bg-white rounded-lg shadow-md flex justify-around border border-gray-200">
          {stageLinks.map(link => { /* ... (変更なし) ... */ })}
        </div>
        {error && <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-md text-sm">{error}</div>}
        {renderStageContent()}
      </main>
    </div>
  );
}