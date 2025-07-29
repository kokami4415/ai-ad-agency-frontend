"use client";

import { useEffect, useState, FormEvent, ReactNode } from 'react';
import { useRequireAuth } from '@/contexts/AuthContext';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { httpsCallable } from "firebase/functions";
import { db, functions } from '@/lib/firebase';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import Markdown from 'react-markdown';

// --- 型定義 (変更なし) ---
interface ProductElements { features: string; benefits: string; results: string; authority: string; offer: string; }
interface Stage1Item { id: string; title: string; content: string; }
interface Stage1Data {
  productInfo: Stage1Item[]; customerInfo: Stage1Item[]; competitorInfo: Stage1Item[];
  marketInfo: Stage1Item[]; brandInfo: Stage1Item[]; pastData: Stage1Item[];
  useDeepResearch?: boolean;
}
type Stage1Key = "productInfo" | "customerInfo" | "competitorInfo" | "marketInfo" | "brandInfo" | "pastData";
interface Stage2Data { productElements: ProductElements; }
interface Stage3Data { creativeParts: string; }
interface Stage4Data { catchCopy: string; subCopy: string; visualImageDescription: string; ctaButtonText: string; }
interface StageLink { num: number; path: string; label: string; }

export default function ProjectStagePage() {
  const { user } = useRequireAuth();
  const params = useParams();
  const router = useRouter();

  const projectId = params.projectId as string;
  const stageSlug = Array.isArray(params.stage) ? params.stage[0] : 'stage1';
  const currentViewStage = parseInt(stageSlug.replace('stage', ''), 10) || 1;

  const [projectData, setProjectData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState('');

  const [stage1Data, setStage1Data] = useState<Omit<Stage1Data, 'useDeepResearch'>>({
    productInfo: [], customerInfo: [], competitorInfo: [],
    marketInfo: [], brandInfo: [], pastData: [],
  });
  const [stage2Data, setStage2Data] = useState<Stage2Data | null>(null);
  const [stage3Data, setStage3Data] = useState<Stage3Data | null>(null);
  const [stage4Data, setStage4Data] = useState<Stage4Data | null>(null);

  const [newInfoType, setNewInfoType] = useState<Stage1Key>('productInfo');
  const [newInfoTitle, setNewInfoTitle] = useState('');
  const [newInfoContent, setNewInfoContent] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [useDeepResearch, setUseDeepResearch] = useState(false);

  useEffect(() => {
    if (user && projectId) {
      const projectDocRef = doc(db, "users", user.uid, "projects", projectId);
      const unsubscribe = onSnapshot(projectDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setProjectData(data);
          const currentDbStage = data.currentStage || 1;
          if (currentViewStage > currentDbStage + 1) { 
            router.push(`/dashboard/projects/${projectId}/stage${currentDbStage}`);
          }
          setStage1Data(data.stage1 || { productInfo: [], customerInfo: [], competitorInfo: [], marketInfo: [], brandInfo: [], pastData: [] });
          setStage2Data(data.stage2 || null);
          setStage3Data(data.stage3 || null);
          setStage4Data(data.stage4 || null);
        } else { setError("プロジェクトが見つかりません。"); }
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, [user, projectId, router, currentViewStage]);

  // --- (全てのハンドラ関数は変更なし) ---
  const saveStage1DataToFirestore = async (updatedData: Omit<Stage1Data, 'useDeepResearch'>) => { /* ... */ };
  const handleAddOrUpdateInfo = async (e: FormEvent) => { /* ... */ };
  const handleEditInfo = (type: Stage1Key, item: Stage1Item) => { /* ... */ };
  const handleDeleteInfo = async (type: Stage1Key, itemId: string) => { /* ... */ };
  const handleAnalyzeStage1to2 = async () => { /* ... */ };
  const handleAnalyzeStage2to3 = async () => { /* ... */ };
  const handleAnalyzeStage3to4 = async () => { /* ... */ };
  const handleAnalyzeStage4to5 = () => { alert("ステージ5は現在開発中です。"); };

  if (loading) { return <div className="flex items-center justify-center min-h-screen"><p>プロジェクトを読み込み中...</p></div>; }

  const renderStageContent = () => { /* ... (変更なし) ... */ };

  const currentStage = projectData?.currentStage || 1;
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
        <div className="max-w-4xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <Link href="/dashboard" className="text-sm text-indigo-600 hover:underline mb-2 inline-block">← ダッシュボードに戻る</Link>
          <h1 className="text-2xl font-bold leading-tight text-gray-900">
            プロジェクト: {projectData?.name || '...'}
          </h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="mb-8 p-2 bg-white rounded-lg shadow-md flex justify-around border border-gray-200">
          {stageLinks.map(link => {
            const isActive = stageSlug === `stage${link.num}`;
            // 【修正点】 タブが有効になる条件を「現在のステージ+1」までに変更
            const isEnabled = link.num <= currentStage + 1;
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