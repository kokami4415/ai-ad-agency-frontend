"use client";

import { useEffect, useState, FormEvent, ReactNode } from 'react'; // ReactNode をインポート
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

  const [newInfoType, setNewInfoType] = useState<keyof Omit<Stage1Data, 'useDeepResearch'>>('productInfo');
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
          setStage4Data(data.stage4 || null);
        } else {
          setError("プロジェクトが見つかりません。");
        }
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, [user, projectId, router, currentViewStage]);

  const saveStage1DataToFirestore = async (updatedData: Omit<Stage1Data, 'useDeepResearch'>) => {
    if (!user) return;
    const projectDocRef = doc(db, "users", user.uid, "projects", projectId);
    await updateDoc(projectDocRef, { stage1: updatedData, updatedAt: new Date() });
  };

  const handleAddOrUpdateInfo = async (e: FormEvent) => {
    e.preventDefault();
    if (!newInfoTitle.trim() || !newInfoContent.trim()) return;
    const updatedStage1Data = { ...stage1Data };
    if (editingItemId) {
      updatedStage1Data[newInfoType] = updatedStage1Data[newInfoType].map(item =>
        item.id === editingItemId ? { ...item, title: newInfoTitle, content: newInfoContent } : item
      );
    } else {
      const newItem: Stage1Item = { id: Date.now().toString(), title: newInfoTitle, content: newInfoContent };
      updatedStage1Data[newInfoType] = [...updatedStage1Data[newInfoType], newItem];
    }
    await saveStage1DataToFirestore(updatedStage1Data);
    setNewInfoTitle(''); setNewInfoContent(''); setEditingItemId(null);
  };

  const handleEditInfo = (type: keyof Omit<Stage1Data, 'useDeepResearch'>, item: Stage1Item) => {
    setNewInfoType(type); setNewInfoTitle(item.title); setNewInfoContent(item.content); setEditingItemId(item.id);
  };

  const handleDeleteInfo = async (type: keyof Omit<Stage1Data, 'useDeepResearch'>, itemId: string) => {
    if (!confirm("この情報を削除しますか？")) return;
    const updatedStage1Data = { ...stage1Data };
    updatedStage1Data[type] = updatedStage1Data[type].filter(item => item.id !== itemId);
    await saveStage1DataToFirestore(updatedStage1Data);
  };

  const handleAnalyzeStage1to2 = async () => {
    if (stage1Data.productInfo.length === 0) { setError("最低1つの商品情報を入力してください。"); return; }
    setAiLoading(true); setError('');
    try {
      const analyzeProductFunc = httpsCallable(functions, 'analyzeProduct');
      const payload: Stage1Data = { ...stage1Data, useDeepResearch: useDeepResearch };
      const result = await analyzeProductFunc(payload);
      const data = result.data as any;
      if (data.success) {
        const projectDocRef = doc(db, "users", user!.uid, "projects", projectId);
        await updateDoc(projectDocRef, {
          stage2: { productElements: data.productElements },
          currentStage: 2, updatedAt: new Date(),
        });
        router.push(`/dashboard/projects/${projectId}/stage2`);
      } else { throw new Error("AIサマリー生成に失敗しました。"); }
    } catch (err: any) { setError(`AIサマリー呼び出しに失敗しました: ${err.message}`);
    } finally { setAiLoading(false); }
  };

  const handleAnalyzeStage2to3 = async () => {
    if (!stage2Data) { setError("ステージ2のデータがありません。"); return; }
    setAiLoading(true); setError('');
    try {
      const generateCreativePartsFunc = httpsCallable(functions, 'generateCreativeParts');
      const result = await generateCreativePartsFunc(stage2Data);
      const data = result.data as { success: boolean; creativeParts: string; };
      if (data.success) {
        const projectDocRef = doc(db, "users", user!.uid, "projects", projectId);
        await updateDoc(projectDocRef, {
          stage3: { creativeParts: data.creativeParts },
          currentStage: 3, updatedAt: new Date(),
        });
        router.push(`/dashboard/projects/${projectId}/stage3`);
      } else { throw new Error("クリエイティブパーツの生成に失敗しました。"); }
    } catch (err: any) { setError(`AI呼び出しに失敗しました: ${err.message}`);
    } finally { setAiLoading(false); }
  };
  
  const handleAnalyzeStage3to4 = async () => {
    if (!stage2Data || !stage3Data) { setError("ステージ3のデータがありません。"); return; }
    setAiLoading(true); setError('');
    try {
      const generateStrategyHypothesisFunc = httpsCallable(functions, 'generateStrategyHypothesis');
      const payload = { ...stage2Data, ...stage3Data };
      const result = await generateStrategyHypothesisFunc(payload);
      const data = result.data as { success: boolean; stage4Data: Stage4Data; };
      if (data.success) {
        const projectDocRef = doc(db, "users", user!.uid, "projects", projectId);
        await updateDoc(projectDocRef, {
          stage4: data.stage4Data,
          currentStage: 4, updatedAt: new Date(),
        });
        router.push(`/dashboard/projects/${projectId}/stage4`);
      } else { throw new Error("戦略仮説の生成に失敗しました。"); }
    } catch (err: any) { setError(`AI呼び出しに失敗しました: ${err.message}`);
    } finally { setAiLoading(false); }
  };

  const handleAnalyzeStage4to5 = () => { alert("ステージ5は現在開発中です。"); };

  if (loading) { return <div className="flex items-center justify-center min-h-screen"><p>プロジェクトを読み込み中...</p></div>; }
  
  const stage1FieldDefinitions = [
    { key: 'productInfo' as const, label: '商品情報' },
    { key: 'customerInfo' as const, label: '顧客情報' },
    { key: 'competitorInfo' as const, label: '競合情報' },
    { key: 'marketInfo' as const, label: '市場情報' },
    { key: 'brandInfo' as const, label: '自社・ブランド情報' },
    { key: 'pastData' as const, label: '過去の施策データ' },
  ];
  
  // 【修正点】 関数の戻り値の型を : ReactNode として明示的に指定
  const renderStageContent = (): ReactNode => {
    switch (currentViewStage) {
      case 1:
        return ( <div className="bg-white p-8 rounded-lg shadow mb-8">{/* ステージ1のJSX */}</div> );
      case 2:
        return ( <div className="bg-white p-8 rounded-lg shadow mb-8">{/* ステージ2のJSX */}</div> );
      case 3:
        return ( <div className="bg-white p-8 rounded-lg shadow mb-8">{/* ステージ3のJSX */}</div> );
      case 4:
        return ( <div className="bg-white p-8 rounded-lg shadow mb-8">{/* ステージ4のJSX */}</div> );
      case 5:
        return ( <div className="bg-white p-8 rounded-lg shadow mb-8">{/* ステージ5のJSX */}</div> );
      default:
        return <p>無効なステージです。</p>;
    }
  };

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
      <header className="bg-white shadow-sm sticky top-0 z-10">{/* Header JSX */}</header>
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