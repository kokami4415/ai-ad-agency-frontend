"use client";

import { useEffect, useState, FormEvent } from 'react';
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
interface Stage2Data { productElements: ProductElements; }
interface Stage3Data { creativeParts: string; }
interface Stage4Data { catchCopy: string; subCopy: string; visualImageDescription: string; ctaButtonText: string; }

export default function ProjectStagePage() {
  const { user } = useRequireAuth();
  const params = useParams();
  const router = useRouter();

  const projectId = params.projectId as string;
  const stageSlug = Array.isArray(params.stage) ? params.stage[0] : 'stage1';
  const currentViewStage = parseInt(stageSlug.replace('stage', ''), 10) || 1;

  // --- State管理 (変更なし) ---
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
  const [newInfoType, setNewInfoType] = useState<keyof Omit<Stage1Data, 'useDeepResearch'>>('productInfo');
  const [newInfoTitle, setNewInfoTitle] = useState('');
  const [newInfoContent, setNewInfoContent] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [useDeepResearch, setUseDeepResearch] = useState(false);

  // --- データ読み込み (変更なし) ---
  useEffect(() => {
    if (user && projectId) {
      const projectDocRef = doc(db, "users", user.uid, "projects", projectId);
      const unsubscribe = onSnapshot(projectDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setProjectData(data);
          const currentDbStage = data.currentStage || 1;
          if (currentViewStage > currentDbStage) {
            router.push(`/dashboard/projects/${projectId}/stage${currentDbStage}`);
          }
          setStage1Data(data.stage1 || { productInfo: [], customerInfo: [], competitorInfo: [], marketInfo: [], brandInfo: [], pastData: [] });
          setStage2Data(data.stage2 || null);
          setStage3Data(data.stage3 || null);
          setStage4Data(data.stage4 || null);
        } else {
          setError("プロジェクトが見つかりません。");
        }
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, [user, projectId, router, currentViewStage]);

  // --- Stage1の操作関数 (変更なし) ---
  const saveStage1DataToFirestore = async (updatedData: Omit<Stage1Data, 'useDeepResearch'>) => { /* ... */ };
  const handleAddOrUpdateInfo = async (e: FormEvent) => { /* ... */ };
  const handleEditInfo = (type: keyof Omit<Stage1Data, 'useDeepResearch'>, item: Stage1Item) => { /* ... */ };
  const handleDeleteInfo = async (type: keyof Omit<Stage1Data, 'useDeepResearch'>, itemId: string) => { /* ... */ };

  // --- AI呼び出し関数 (ロジック修正) ---
  const handleAnalyzeStage1to2 = async () => {
    if (stage1Data.productInfo.length === 0) {
      setError("ステージ1で最低1つの商品情報を入力してください。");
      return;
    }
    setAiLoading(true);
    setError('');
    try {
      const analyzeProductFunc = httpsCallable(functions, 'analyzeProduct');
      const payload: Stage1Data = { ...stage1Data, useDeepResearch: useDeepResearch };
      const result = await analyzeProductFunc(payload);
      const data = result.data as any;
      if (data.success) {
        const projectDocRef = doc(db, "users", user!.uid, "projects", projectId);
        await updateDoc(projectDocRef, {
          stage2: { productElements: data.productElements },
          currentStage: 2,
          updatedAt: new Date(),
        });
        // 自動遷移はしない
      } else { throw new Error("AIサマリー生成に失敗しました。"); }
    } catch (err: any) { setError(`AIサマリー呼び出しに失敗しました: ${err.message}`);
    } finally { setAiLoading(false); }
  };

  const handleAnalyzeStage2to3 = async () => {
    if (!stage2Data) {
      setError("ステージ2のデータがありません。ステージ1の分析を先に実行してください。");
      return;
    }
    setAiLoading(true);
    setError('');
    try {
      const generateCreativePartsFunc = httpsCallable(functions, 'generateCreativeParts');
      const result = await generateCreativePartsFunc(stage2Data);
      const data = result.data as { success: boolean; creativeParts: string; };
      if (data.success) {
        const projectDocRef = doc(db, "users", user!.uid, "projects", projectId);
        await updateDoc(projectDocRef, {
          stage3: { creativeParts: data.creativeParts },
          currentStage: 3,
          updatedAt: new Date(),
        });
      } else { throw new Error("クリエイティブパーツの生成に失敗しました。"); }
    } catch (err: any) { setError(`AI呼び出しに失敗しました: ${err.message}`);
    } finally { setAiLoading(false); }
  };

  const handleAnalyzeStage3to4 = async () => {
    if (!stage3Data) {
      setError("ステージ3のデータがありません。ステージ2の分析を先に実行してください。");
      return;
    }
    setAiLoading(true);
    setError('');
    try {
      const generateStrategyHypothesisFunc = httpsCallable(functions, 'generateStrategyHypothesis');
      const payload = { ...stage2Data, ...stage3Data };
      const result = await generateStrategyHypothesisFunc(payload);
      const data = result.data as { success: boolean; stage4Data: Stage4Data; };
      if (data.success) {
        const projectDocRef = doc(db, "users", user!.uid, "projects", projectId);
        await updateDoc(projectDocRef, {
          stage4: data.stage4Data,
          currentStage: 4,
          updatedAt: new Date(),
        });
      } else { throw new Error("戦略仮説の生成に失敗しました。"); }
    } catch (err: any) { setError(`AI呼び出しに失敗しました: ${err.message}`);
    } finally { setAiLoading(false); }
  };

  const handleAnalyzeStage4to5 = () => {
    alert("ステージ5は現在開発中です。");
  };

  if (loading) { return <div className="flex items-center justify-center min-h-screen"><p>プロジェクトを読み込み中...</p></div>; }

  // --- 表示ロジック ---
  const stage1FieldDefinitions = [ /* ... (変更なし) ... */ ];

  const renderStageContent = () => {
    switch (currentViewStage) {
      case 1:
        return (
          <div className="bg-white p-8 rounded-lg shadow mb-8">
            {/* ステージ1の入力フォーム群 (変更なし) */}
          </div>
        );
      case 2:
        return (
          <div className="bg-white p-8 rounded-lg shadow mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-6">2. 商品要素抽出</h2>
            <div className="mb-6 p-4 border-2 border-dashed rounded-lg flex justify-between items-center">
              <p className="text-gray-600 text-sm">ステージ1の情報を基に、AIサマリーを生成・更新します。</p>
              <div className="flex items-center">
                <label className="flex items-center mr-4 text-sm text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={useDeepResearch} onChange={(e) => setUseDeepResearch(e.target.checked)} className="h-4 w-4 text-indigo-600" />
                  <span className="ml-2">Deep Research</span>
                </label>
                <button onClick={handleAnalyzeStage1to2} disabled={aiLoading} className="px-6 py-2 font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-indigo-300">
                  {aiLoading ? '生成中...' : 'サマリーを生成'}
                </button>
              </div>
            </div>
            {stage2Data ? <div>{/* ステージ2のデータ表示JSX */}</div> : <p className="text-center text-gray-500 py-8">まだサマリーがありません。</p>}
          </div>
        );
      case 3:
        return (
          <div className="bg-white p-8 rounded-lg shadow mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-6">3. クリエイティブパーツ</h2>
            <div className="mb-6 p-4 border-2 border-dashed rounded-lg flex justify-between items-center">
               <p className="text-gray-600 text-sm">ステージ2の商品要素を基に、広告表現のパーツを量産します。</p>
               <button onClick={handleAnalyzeStage2to3} disabled={aiLoading} className="px-6 py-2 font-semibold text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-gray-300">
                {aiLoading ? '生成中...' : 'クリエイティブパーツを生成'}
              </button>
            </div>
            {stage3Data ? <div>{/* ステージ3のデータ表示JSX */}</div> : <p className="text-center text-gray-500 py-8">まだクリエイティブパーツがありません。</p>}
          </div>
        );
      case 4:
        return (
          <div className="bg-white p-8 rounded-lg shadow mb-8">
             <h2 className="text-xl font-semibold text-gray-800 mb-6">4. 戦略仮説</h2>
             <div className="mb-6 p-4 border-2 border-dashed rounded-lg flex justify-between items-center">
                <p className="text-gray-600 text-sm">クリエイティブパーツを基に、LPの戦略仮説を構築します。</p>
                <button onClick={handleAnalyzeStage3to4} disabled={aiLoading} className="px-6 py-2 font-semibold text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-gray-300">
                  {aiLoading ? '生成中...' : '戦略仮説を生成'}
                </button>
             </div>
             {stage4Data ? <div>{/* ステージ4のデータ表示JSX */}</div> : <p className="text-center text-gray-500 py-8">まだ戦略仮説がありません。</p>}
          </div>
        );
      case 5:
        return (
          <div className="bg-white p-8 rounded-lg shadow mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-6">5. アウトプット</h2>
            <div className="mb-6 p-4 border-2 border-dashed rounded-lg flex justify-between items-center">
              <p className="text-gray-600 text-sm">戦略仮説を基に、具体的な広告クリエイティブを生成します。</p>
              <button onClick={handleAnalyzeStage4to5} disabled={aiLoading} className="px-6 py-2 font-semibold text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:bg-gray-300">
                {aiLoading ? '生成中...' : 'アウトプットを生成'}
              </button>
            </div>
            <p className="text-center text-gray-500 py-8">この機能は現在開発中です。</p>
          </div>
        );
      default:
        return <p>無効なステージです。</p>;
    }
  };

  const currentStage = projectData?.currentStage || 1;
  const stageLinks = [ /* ... (変更なし) ... */ ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">{/* ... (変更なし) ... */}</header>
      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="mb-8 p-2 bg-white rounded-lg shadow-md flex justify-around border border-gray-200">
          {stageLinks.map(link => { /* ... (変更なし) ... */ })}
        </div>
        {error && <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-md">{error}</div>}
        {renderStageContent()}
      </main>
    </div>
  );
}