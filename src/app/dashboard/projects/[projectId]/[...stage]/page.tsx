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
interface ProductElements {
  features: string; benefits: string; results: string; authority: string; offer: string;
}
interface Stage1Item { id: string; title: string; content: string; }
interface Stage1Data {
  productInfo: Stage1Item[]; customerInfo: Stage1Item[]; competitorInfo: Stage1Item[];
  marketInfo: Stage1Item[]; brandInfo: Stage1Item[]; pastData: Stage1Item[];
  useDeepResearch?: boolean;
}
// 【更新】ステージ2の型
interface Stage2Data {
  productElements: ProductElements;
}
// 【新設】ステージ3の型
interface Stage3Data {
  creativeParts: string;
}
// 【新設】ステージ4の型
interface Stage4Data {
  catchCopy: string; subCopy: string; visualImageDescription: string; ctaButtonText: string;
}

export default function ProjectStagePage() {
  const { user } = useRequireAuth();
  const params = useParams();
  const router = useRouter();

  const projectId = params.projectId as string;
  const stageSlug = Array.isArray(params.stage) ? params.stage[0] : 'stage1';
  const currentViewStage = parseInt(stageSlug.replace('stage', ''), 10) || 1;

  // --- 全てのStateをここで管理 ---
  const [projectData, setProjectData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState('');

  const [stage1Data, setStage1Data] = useState<Omit<Stage1DataType, 'useDeepResearch'>>({
    productInfo: [], customerInfo: [], competitorInfo: [],
    marketInfo: [], brandInfo: [], pastData: [],
  });
  const [stage2Data, setStage2Data] = useState<Stage2Data | null>(null);
  const [stage3Data, setStage3Data] = useState<Stage3Data | null>(null);
  const [stage4Data, setStage4Data] = useState<Stage4Data | null>(null); // 【新設】ステージ4のState

  const [newInfoType, setNewInfoType] = useState<keyof Omit<Stage1DataType, 'useDeepResearch'>>('productInfo');
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
          if (currentViewStage > currentDbStage) {
            router.push(`/dashboard/projects/${projectId}/stage${currentDbStage}`);
          }
          setStage1Data(data.stage1 || { productInfo: [], customerInfo: [], competitorInfo: [], marketInfo: [], brandInfo: [], pastData: [] });
          setStage2Data(data.stage2 || null);
          setStage3Data(data.stage3 || null);
          setStage4Data(data.stage4 || null); // 【新設】ステージ4のデータを読み込み
        } else {
          setError("プロジェクトが見つかりません。");
        }
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, [user, projectId, router, currentViewStage]);

  const saveStage1DataToFirestore = async (updatedData: Omit<Stage1DataType, 'useDeepResearch'>) => {
    if (!user) return;
    const projectDocRef = doc(db, "users", user.uid, "projects", projectId);
    await updateDoc(projectDocRef, { stage1: updatedData, updatedAt: new Date() });
  };

  const handleAddOrUpdateInfo = async (e: FormEvent) => { /* ... (変更なし) ... */ };
  const handleEditInfo = (type: keyof Omit<Stage1DataType, 'useDeepResearch'>, item: Stage1Item) => { /* ... (変更なし) ... */ };
  const handleDeleteInfo = async (type: keyof Omit<Stage1DataType, 'useDeepResearch'>, itemId: string) => { /* ... (変更なし) ... */ };

  const handleAnalyzeStage1to2 = async () => { /* ... (変更なし) ... */ };

  // 【更新】ステージ2 → 3の関数
  const handleAnalyzeStage2to3 = async () => {
    if (!stage2Data) return;
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
        router.push(`/dashboard/projects/${projectId}/stage3`);
      } else {
        throw new Error("クリエイティブパーツの生成に失敗しました。");
      }
    } catch (err: any) {
      setError(`AI呼び出しに失敗しました: ${err.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  // 【新設】ステージ3 → 4の関数
  const handleAnalyzeStage3to4 = async () => {
    if (!stage2Data || !stage3Data) return;
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
        router.push(`/dashboard/projects/${projectId}/stage4`);
      } else {
        throw new Error("戦略仮説の生成に失敗しました。");
      }
    } catch (err: any) {
      setError(`AI呼び出しに失敗しました: ${err.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  // 【新設】ステージ4 → 5の関数（プレースホルダー）
  const handleAnalyzeStage4to5 = () => {
    alert("ステージ5は現在開発中です。");
  };

  if (loading) { return <div className="flex items-center justify-center min-h-screen"><p>読み込み中...</p></div>; }

  // 【更新】ステージの表示を切り替える
  const renderStageContent = () => {
    switch (currentViewStage) {
      case 1:
        return ( <div className="bg-white p-8 rounded-lg shadow mb-8">{/* ... ステージ1のJSX ... */}</div> );
      case 2:
        return ( <div className="bg-white p-8 rounded-lg shadow mb-8">{/* ... ステージ2のJSX ... */}</div> );
      case 3:
        return (
          <div className="bg-white p-8 rounded-lg shadow mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-6">3. クリエイティブパーツ</h2>
            {!stage3Data ? (<p>ステージ2を完了してください。</p>) : (
              <div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="prose prose-sm max-w-none"><Markdown>{stage3Data.creativeParts}</Markdown></div>
                </div>
                <div className="mt-6 text-right">
                  <button onClick={handleAnalyzeStage3to4} disabled={aiLoading} className="px-8 py-3 font-semibold text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-gray-300">
                    {aiLoading ? '生成中...' : 'AIに戦略仮説の制作を依頼 →'}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      case 4:
        return (
          <div className="bg-white p-8 rounded-lg shadow mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-6">4. 戦略仮説</h2>
            {!stage4Data ? (<p>ステージ3を完了してください。</p>) : (
              <div>
                {/* ... ステージ4（旧ステージ3）の表示JSX ... */}
                <div className="mt-6 text-right">
                  <button onClick={handleAnalyzeStage4to5} disabled={aiLoading} className="px-8 py-3 font-semibold text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:bg-gray-300">
                    {'AIに広告アウトプットの制作を依頼 →'}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      case 5:
        return (
          <div className="bg-white p-8 rounded-lg shadow mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-6">5. アウトプット</h2>
            <p>この機能は現在開発中です。</p>
          </div>
        );
      default:
        return <p>無効なステージです。</p>;
    }
  };

  const currentStage = projectData?.currentStage || 1;
  // 【更新】ナビゲーションを5段階に変更
  const stageLinks = [
    { num: 1, path: `/stage1`, label: "1. 情報基盤" },
    { num: 2, path: `/stage2`, label: "2. 商品要素抽出" },
    { num: 3, path: `/stage3`, label: "3. クリエイティブパーツ" },
    { num: 4, path: `/stage4`, label: "4. 戦略仮説" },
    { num: 5, path: `/stage5`, label: "5. アウトプット" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">{/* ... (変更なし) ... */}</header>
      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="mb-8 p-2 bg-white rounded-lg shadow-md flex justify-around border border-gray-200">
          {stageLinks.map(link => { /* ... (変更なし) ... */ })}
        </div>
        {renderStageContent()}
      </main>
    </div>
  );
}