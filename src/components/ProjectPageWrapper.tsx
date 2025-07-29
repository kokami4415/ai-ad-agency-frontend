"use client";

import { useEffect, useState, FormEvent } from 'react';
import { useRequireAuth } from '@/contexts/AuthContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from "firebase/functions";
import { db, functions } from '@/lib/firebase';
import Link from 'next/link';
import Markdown from 'react-markdown';

// --- Type Definitions ---
interface ProductElements {
  features: string; benefits: string; results: string; authority: string; offer: string;
}
interface AIResponseStage2Data {
  productElements: ProductElements;
}
interface AIResponseStage3Data {
  catchCopy: string; subCopy: string; visualImageDescription: string; ctaButtonText: string;
}
interface Stage1Item {
  id: string; title: string; content: string;
}
interface Stage1DataType {
  productInfo: Stage1Item[];
  customerInfo: Stage1Item[];
  competitorInfo: Stage1Item[];
  marketInfo: Stage1Item[];
  brandInfo: Stage1Item[];
  pastData: Stage1Item[];
  useDeepResearch?: boolean;
}
interface ProjectPageWrapperProps {
  projectId: string; projectName: string;
}

// --- Component ---
export default function ProjectPageWrapper({ projectId, projectName: initialProjectName }: ProjectPageWrapperProps) {
  const { user, loading: authLoading } = useRequireAuth();
  const [projectDisplayName, setProjectDisplayName] = useState(initialProjectName);
  
  const [currentStage, setCurrentStage] = useState(1);
  const [stage1Data, setStage1Data] = useState<Omit<Stage1DataType, 'useDeepResearch'>>({
    productInfo: [], customerInfo: [], competitorInfo: [],
    marketInfo: [], brandInfo: [], pastData: [],
  });
  const [stage2Data, setStage2Data] = useState<AIResponseStage2Data | null>(null);
  const [stage3Data, setStage3Data] = useState<AIResponseStage3Data | null>(null);

  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState('');

  const [newInfoType, setNewInfoType] = useState<keyof Omit<Stage1DataType, 'useDeepResearch'>>('productInfo');
  const [newInfoTitle, setNewInfoTitle] = useState('');
  const [newInfoContent, setNewInfoContent] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [useDeepResearch, setUseDeepResearch] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      const getProjectData = async () => {
        setLoading(true);
        const projectDocRef = doc(db, "users", user.uid, "projects", projectId);
        const docSnap = await getDoc(projectDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setProjectDisplayName(data.name);
          setCurrentStage(data.currentStage || 1);
          setStage1Data({
            productInfo: Array.isArray(data.stage1?.productInfo) ? data.stage1.productInfo : [],
            customerInfo: Array.isArray(data.stage1?.customerInfo) ? data.stage1.customerInfo : [],
            competitorInfo: Array.isArray(data.stage1?.competitorInfo) ? data.stage1.competitorInfo : [],
            marketInfo: Array.isArray(data.stage1?.marketInfo) ? data.stage1.marketInfo : [],
            brandInfo: Array.isArray(data.stage1?.brandInfo) ? data.stage1.brandInfo : [],
            pastData: Array.isArray(data.stage1?.pastData) ? data.stage1.pastData : [],
          });
          setStage2Data(data.stage2 || null);
          setStage3Data(data.stage3 || null);
        } else {
          setError("プロジェクトが見つかりません。");
        }
        setLoading(false);
      };
      getProjectData();
    }
  }, [authLoading, user, projectId]);

  const saveStage1DataToFirestore = async (updatedData: Omit<Stage1DataType, 'useDeepResearch'>) => {
    if (!user) return;
    const projectDocRef = doc(db, "users", user.uid, "projects", projectId);
    await updateDoc(projectDocRef, { stage1: updatedData, updatedAt: new Date() });
    setStage1Data(updatedData);
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
    setNewInfoTitle('');
    setNewInfoContent('');
    setEditingItemId(null);
  };

  const handleEditInfo = (type: keyof Omit<Stage1DataType, 'useDeepResearch'>, item: Stage1Item) => {
    setNewInfoType(type);
    setNewInfoTitle(item.title);
    setNewInfoContent(item.content);
    setEditingItemId(item.id);
  };

  const handleDeleteInfo = async (type: keyof Omit<Stage1DataType, 'useDeepResearch'>, itemId: string) => {
    if (!confirm("この情報を削除しますか？")) return;
    const updatedStage1Data = { ...stage1Data };
    updatedStage1Data[type] = updatedStage1Data[type].filter(item => item.id !== itemId);
    await saveStage1DataToFirestore(updatedStage1Data);
  };

  const handleAnalyzeStage1to2 = async () => {
    if (stage1Data.productInfo.length === 0) {
      setError("最低1つの商品情報を入力してください。");
      return;
    }
    setAiLoading(true);
    setError('');
    try {
      const analyzeProductFunc = httpsCallable(functions, 'analyzeProduct');
      const payload: Stage1DataType = { ...stage1Data, useDeepResearch: useDeepResearch };
      const result = await analyzeProductFunc(payload);
      const data = result.data as { success: boolean; productElements?: ProductElements; };

      if (data.success && data.productElements) {
        const finalStage2Data: AIResponseStage2Data = {
          productElements: data.productElements,
        };
        setStage2Data(finalStage2Data);
        const projectDocRef = doc(db, "users", user!.uid, "projects", projectId);
        await updateDoc(projectDocRef, {
          stage2: finalStage2Data,
          currentStage: 2,
          updatedAt: new Date(),
        });
        setCurrentStage(2);
      } else {
        throw new Error("AIサマリー生成に失敗しました。");
      }
    } catch (err: any) {
      setError(`AIサマリー呼び出しに失敗しました: ${err.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  const handleAnalyzeStage2to3 = async () => {
    if (!stage2Data) return;
    setAiLoading(true);
    setError('');
    try {
      const generateLpFirstViewFunc = httpsCallable(functions, 'generateLpFirstView');
      const result = await generateLpFirstViewFunc(stage2Data);
      const data = result.data as { success: boolean; stage3Data: AIResponseStage3Data; };
      if (data.success) {
        setStage3Data(data.stage3Data);
        const projectDocRef = doc(db, "users", user!.uid, "projects", projectId);
        await updateDoc(projectDocRef, {
          stage3: data.stage3Data,
          currentStage: 3,
          updatedAt: new Date(),
        });
        setCurrentStage(3);
      } else {
        throw new Error("戦略仮説生成に失敗しました。");
      }
    } catch (err: any) {
      setError(`戦略仮説呼び出しに失敗しました: ${err.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  if (authLoading || loading) {
    return <div className="flex items-center justify-center min-h-screen"><p>読み込み中...</p></div>;
  }
  if (!user) return null;
  
  const stage1FieldDefinitions = [
    { key: 'productInfo', label: '商品情報' },
    { key: 'customerInfo', label: '顧客情報' },
    { key: 'competitorInfo', label: '競合情報' },
    { key: 'marketInfo', label: '市場情報' },
    { key: 'brandInfo', label: '自社・ブランド情報' },
    { key: 'pastData', label: '過去の施策データ' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <Link href="/dashboard" className="text-sm text-indigo-600 hover:underline mb-2 inline-block">← ダッシュボードに戻る</Link>
          <h1 className="text-2xl font-bold leading-tight text-gray-900">
            プロジェクト: {projectDisplayName}
          </h1>
        </div>
      </header>
      
      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* 【FIX】 Restored the Stage 1 UI block */}
        <div className="bg-white p-8 rounded-lg shadow mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">1. 情報基盤 (Foundation)</h2>
          {stage1FieldDefinitions.map((fieldDef) => (
            <div key={fieldDef.key} className="mb-6 border-b pb-4 border-gray-100 last:border-b-0 last:pb-0">
              <h3 className="text-lg font-semibold text-gray-700 mb-3">{fieldDef.label}</h3>
              {stage1Data[fieldDef.key as keyof Omit<Stage1DataType, 'useDeepResearch'>].length > 0 ? (
                <ul className="space-y-2 mb-4">
                  {stage1Data[fieldDef.key as keyof Omit<Stage1DataType, 'useDeepResearch'>].map((item) => (
                    <li key={item.id} className="bg-gray-50 p-3 rounded-md border border-gray-200 flex justify-between items-center text-sm">
                      <span className="font-medium text-gray-800 truncate">{item.title}</span>
                      <div className="flex space-x-2 ml-4">
                        <button onClick={() => handleEditInfo(fieldDef.key as keyof Omit<Stage1DataType, 'useDeepResearch'>, item)} className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-md">編集</button>
                        <button onClick={() => handleDeleteInfo(fieldDef.key as keyof Omit<Stage1DataType, 'useDeepResearch'>, item.id)} className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded-md">削除</button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-gray-500 text-sm mb-4">まだ情報がありません。</p>}
              <form onSubmit={handleAddOrUpdateInfo} className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="font-semibold text-gray-800">{editingItemId && newInfoType === fieldDef.key ? `情報を編集` : `新しい${fieldDef.label}を追加`}</h4>
                <input
                  type="text"
                  placeholder="タイトル"
                  value={newInfoType === fieldDef.key ? newInfoTitle : ''}
                  onChange={(e) => { setNewInfoType(fieldDef.key as keyof Omit<Stage1DataType, 'useDeepResearch'>); setNewInfoTitle(e.target.value); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm shadow-sm"
                  required
                />
                <textarea
                  placeholder="ここに内容を入力..."
                  value={newInfoType === fieldDef.key ? newInfoContent : ''}
                  onChange={(e) => { setNewInfoType(fieldDef.key as keyof Omit<Stage1DataType, 'useDeepResearch'>); setNewInfoContent(e.target.value); }}
                  rows={3}
                  className="w-full p-3 border border-gray-300 rounded-lg text-sm resize-y shadow-sm"
                  required
                ></textarea>
                <div className="text-right">
                  <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-md shadow-sm">
                    {editingItemId && newInfoType === fieldDef.key ? '更新' : '追加'}
                  </button>
                  {editingItemId && newInfoType === fieldDef.key && (
                    <button type="button" onClick={() => { setEditingItemId(null); setNewInfoTitle(''); setNewInfoContent(''); }} className="ml-2 px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 text-sm font-semibold rounded-md shadow-sm">
                      キャンセル
                    </button>
                  )}
                </div>
              </form>
            </div>
          ))}
          <div className="mt-8 flex justify-end items-center">
              <label className="flex items-center mr-4 text-sm text-gray-600 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={useDeepResearch} 
                  onChange={(e) => setUseDeepResearch(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <span className="ml-2">Deep Researchを行う (より詳細な分析)</span>
              </label>
            <button onClick={handleAnalyzeStage1to2} disabled={aiLoading} className="px-8 py-3 font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed">
              {aiLoading ? 'AIサマリー生成中...' : 'AIにサマリー作成を依頼 →'}
            </button>
          </div>
          {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
        </div>

        {/* Stage 2 */}
        <div className={`bg-white p-8 rounded-lg shadow mb-8 ${currentStage < 2 ? 'opacity-50 pointer-events-none' : ''}`}>
          <h2 className="text-xl font-semibold text-gray-800 mb-6">2. AIサマリー</h2>
          {stage2Data && (
            <div className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h3 className="font-semibold text-gray-700 mb-2">商品要素</h3>
                  <div className="prose prose-sm max-w-none">
                    <Markdown>{`**特徴:**\n${stage2Data.productElements?.features || 'なし'}`}</Markdown>
                    <Markdown>{`**メリット:**\n${stage2Data.productElements?.benefits || 'なし'}`}</Markdown>
                    <Markdown>{`**実績:**\n${stage2Data.productElements?.results || 'なし'}`}</Markdown>
                    <Markdown>{`**権威性:**\n${stage2Data.productElements?.authority || 'なし'}`}</Markdown>
                    <Markdown>{`**オファー:**\n${stage2Data.productElements?.offer || 'なし'}`}</Markdown>
                  </div>
              </div>
            </div>
          )}
          <div className="mt-6 text-right">
            <button onClick={handleAnalyzeStage2to3} disabled={aiLoading || !stage2Data} className="px-8 py-3 font-semibold text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed">
              {aiLoading ? '戦略仮説生成中...' : 'AIに戦略仮説の制作を依頼 →'}
            </button>
          </div>
        </div>

        {/* Stage 3 and 4 UI would follow */}
        <div className={`bg-white p-8 rounded-lg shadow mb-8 ${currentStage < 3 ? 'opacity-50 pointer-events-none' : ''}`}>
          {/* ... Stage 3 JSX ... */}
        </div>
      </main>
    </div>
  );
}