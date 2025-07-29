"use client";

import { useEffect, useState, FormEvent, ReactNode } from 'react';
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
          if (currentViewStage > currentDbStage + 1 && currentViewStage <= 5) { 
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

  const handleEditInfo = (type: Stage1Key, item: Stage1Item) => {
    setNewInfoType(type); setNewInfoTitle(item.title); setNewInfoContent(item.content); setEditingItemId(item.id);
  };

  const handleDeleteInfo = async (type: Stage1Key, itemId: string) => {
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
      } else { throw new Error("戦略仮説の生成に失敗しました。"); }
    } catch (err: any) { setError(`AI呼び出しに失敗しました: ${err.message}`);
    } finally { setAiLoading(false); }
  };

  const handleAnalyzeStage4to5 = () => { alert("ステージ5は現在開発中です。"); };

  if (loading) { return <div className="flex items-center justify-center min-h-screen"><p>プロジェクトを読み込み中...</p></div>; }
  
  const stage1FieldDefinitions = [
    { key: 'productInfo' as Stage1Key, label: '商品情報' },
    { key: 'customerInfo' as Stage1Key, label: '顧客情報' },
    { key: 'competitorInfo' as Stage1Key, label: '競合情報' },
    { key: 'marketInfo' as Stage1Key, label: '市場情報' },
    { key: 'brandInfo' as Stage1Key, label: '自社・ブランド情報' },
    { key: 'pastData' as Stage1Key, label: '過去の施策データ' },
  ];
  
  const renderStageContent = (): ReactNode => {
    switch (currentViewStage) {
      case 1:
        return (
          <div className="bg-white p-8 rounded-lg shadow mb-8">
            {stage1FieldDefinitions.map((fieldDef) => (
              <div key={fieldDef.key} className="mb-6 border-b pb-4 border-gray-100 last:border-b-0 last:pb-0">
                <h3 className="text-lg font-semibold text-gray-700 mb-3">{fieldDef.label}</h3>
                {stage1Data[fieldDef.key].length > 0 ? (
                  <ul className="space-y-2 mb-4">
                    {stage1Data[fieldDef.key].map((item) => (
                      <li key={item.id} className="bg-gray-50 p-3 rounded-md border border-gray-200 flex justify-between items-center text-sm">
                        <span className="font-medium text-gray-800 truncate">{item.title}</span>
                        <div className="flex space-x-2 ml-4">
                          <button onClick={() => handleEditInfo(fieldDef.key, item)} className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-md">編集</button>
                          <button onClick={() => handleDeleteInfo(fieldDef.key, item.id)} className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded-md">削除</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-gray-500 text-sm mb-4">まだ情報がありません。</p>}
                <form onSubmit={handleAddOrUpdateInfo} className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="font-semibold text-gray-800">{editingItemId && newInfoType === fieldDef.key ? `情報を編集` : `新しい${fieldDef.label}を追加`}</h4>
                  <input type="text" placeholder="タイトル" value={newInfoType === fieldDef.key ? newInfoTitle : ''} onChange={(e) => { setNewInfoType(fieldDef.key); setNewInfoTitle(e.target.value); }} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm shadow-sm" required />
                  <textarea placeholder="ここに内容を入力..." value={newInfoType === fieldDef.key ? newInfoContent : ''} onChange={(e) => { setNewInfoType(fieldDef.key); setNewInfoContent(e.target.value); }} rows={3} className="w-full p-3 border border-gray-300 rounded-lg text-sm resize-y shadow-sm" required></textarea>
                  <div className="text-right">
                    <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-md shadow-sm">{editingItemId && newInfoType === fieldDef.key ? '更新' : '追加'}</button>
                    {editingItemId && newInfoType === fieldDef.key && (<button type="button" onClick={() => { setEditingItemId(null); setNewInfoTitle(''); setNewInfoContent(''); }} className="ml-2 px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 text-sm font-semibold rounded-md shadow-sm">キャンセル</button>)}
                  </div>
                </form>
              </div>
            ))}
          </div>
        );
      case 2:
        return (
          <div className="bg-white p-8 rounded-lg shadow mb-8">
            <div className="mb-6 p-4 border-2 border-dashed rounded-lg flex justify-between items-center">
              <p className="text-gray-600 text-sm">ステージ1の情報を基に、商品要素を抽出・更新します。</p>
              <div className="flex items-center">
                <label className="flex items-center mr-4 text-sm text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={useDeepResearch} onChange={(e) => setUseDeepResearch(e.target.checked)} className="h-4 w-4 text-indigo-600" />
                  <span className="ml-2">Deep Research</span>
                </label>
                <button onClick={handleAnalyzeStage1to2} disabled={aiLoading} className="px-6 py-2 font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-indigo-300">
                  {aiLoading ? '生成中...' : '商品要素を抽出'}
                </button>
              </div>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-6">2. 商品要素抽出</h2>
            {stage2Data ? (
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="prose prose-sm max-w-none text-gray-800">
                  <Markdown>{`**特徴:**\n${stage2Data.productElements?.features || 'なし'}`}</Markdown> <hr className="my-2"/>
                  <Markdown>{`**メリット:**\n${stage2Data.productElements?.benefits || 'なし'}`}</Markdown> <hr className="my-2"/>
                  <Markdown>{`**実績:**\n${stage2Data.productElements?.results || 'なし'}`}</Markdown> <hr className="my-2"/>
                  <Markdown>{`**権威性:**\n${stage2Data.productElements?.authority || 'なし'}`}</Markdown> <hr className="my-2"/>
                  <Markdown>{`**オファー:**\n${stage2Data.productElements?.offer || 'なし'}`}</Markdown>
                </div>
              </div>
            ) : <p className="text-center text-gray-500 py-8">まだ商品要素がありません。「商品要素を抽出」ボタンを押してください。</p>}
          </div>
        );
      case 3:
        return (
          <div className="bg-white p-8 rounded-lg shadow mb-8">
            <div className="mb-6 p-4 border-2 border-dashed rounded-lg flex justify-between items-center">
              <p className="text-gray-600 text-sm">ステージ2の商品要素を基に、広告表現のパーツを量産します。</p>
              <button onClick={handleAnalyzeStage2to3} disabled={aiLoading} className="px-6 py-2 font-semibold text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-gray-300">
                {aiLoading ? '生成中...' : 'クリエイティブパーツを生成'}
              </button>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-6">3. クリエイティブパーツ</h2>
            {stage3Data ? (
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="prose prose-sm max-w-none"><Markdown>{stage3Data.creativeParts}</Markdown></div>
              </div>
            ) : <p className="text-center text-gray-500 py-8">まだクリエイティブパーツがありません。「クリエイティブパーツを生成」ボタンを押してください。</p>}
          </div>
        );
      case 4:
        return (
          <div className="bg-white p-8 rounded-lg shadow mb-8">
            <div className="mb-6 p-4 border-2 border-dashed rounded-lg flex justify-between items-center">
              <p className="text-gray-600 text-sm">クリエイティブパーツを基に、LPの戦略仮説を構築します。</p>
              <button onClick={handleAnalyzeStage3to4} disabled={aiLoading} className="px-6 py-2 font-semibold text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-gray-300">
                {aiLoading ? '生成中...' : '戦略仮説を生成'}
              </button>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-6">4. 戦略仮説</h2>
            {stage4Data ? (
              <div className="space-y-6">
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h3 className="font-semibold text-gray-700 mb-2">キャッチコピー</h3>
                  <p className="text-gray-800 text-lg font-bold">{stage4Data.catchCopy}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h3 className="font-semibold text-gray-700 mb-2">サブコピー</h3>
                  <p className="text-gray-600">{stage4Data.subCopy}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h3 className="font-semibold text-gray-700 mb-2">ビジュアルイメージ</h3>
                  <p className="text-gray-600">{stage4Data.visualImageDescription}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h3 className="font-semibold text-gray-700 mb-2">CTAボタン</h3>
                  <p className="text-gray-600 font-medium">{stage4Data.ctaButtonText}</p>
                </div>
              </div>
            ) : <p className="text-center text-gray-500 py-8">まだ戦略仮説がありません。「戦略仮説を生成」ボタンを押してください。</p>}
          </div>
        );
      case 5:
        return (
          <div className="bg-white p-8 rounded-lg shadow mb-8">
            <div className="mb-6 p-4 border-2 border-dashed rounded-lg flex justify-between items-center">
              <p className="text-gray-600 text-sm">戦略仮説を基に、具体的な広告クリエイティブを生成します。</p>
              <button onClick={handleAnalyzeStage4to5} disabled={aiLoading} className="px-6 py-2 font-semibold text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:bg-gray-300">
                {aiLoading ? '生成中...' : 'アウトプットを生成'}
              </button>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-6">5. アウトプット</h2>
            <p className="text-center text-gray-500 py-8">この機能は現在開発中です。</p>
          </div>
        );
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
            const isEnabled = link.num <= currentStage + 1 && link.num <= 5;
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