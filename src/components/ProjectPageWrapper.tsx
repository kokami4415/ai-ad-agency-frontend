"use client";

import { useEffect, useState, FormEvent } from 'react';
import { useRequireAuth } from '@/contexts/AuthContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from "firebase/functions";
import { db, functions } from '@/lib/firebase';
import Link from 'next/link';
import Markdown from 'react-markdown';

// --- Type Definitions ---
interface AIResponseStage2Data {
  keywords: string;
  productElements: {
    features: string; benefits: string; results: string; authority: string; offer: string;
  };
  customerPersonas: string;
}
interface AIResponseStage3Data {
  catchCopy: string; subCopy: string; visualImageDescription: string; ctaButtonText: string;
}
interface Stage1Item {
  id: string;
  title: string;
  content: string;
}
interface Stage1DataType {
  productInfo: Stage1Item[];
  customerInfo: Stage1Item[];
  competitorInfo: Stage1Item[];
  marketInfo: Stage1Item[];
  brandInfo: Stage1Item[];
  pastData: Stage1Item[];
}
interface ProjectPageWrapperProps {
  projectId: string;
  projectName: string;
}

// --- Component ---
export default function ProjectPageWrapper({ projectId, projectName: initialProjectName }: ProjectPageWrapperProps) {
  const { user, loading: authLoading } = useRequireAuth();
  const [projectDisplayName, setProjectDisplayName] = useState(initialProjectName);
  
  const [currentStage, setCurrentStage] = useState(1);
  const [stage1Data, setStage1Data] = useState<Stage1DataType>({
    productInfo: [], customerInfo: [], competitorInfo: [],
    marketInfo: [], brandInfo: [], pastData: [],
  });
  const [stage2Data, setStage2Data] = useState<AIResponseStage2Data | null>(null);
  const [stage3Data, setStage3Data] = useState<AIResponseStage3Data | null>(null);

  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState('');

  const [newInfoType, setNewInfoType] = useState<keyof Stage1DataType>('productInfo');
  const [newInfoTitle, setNewInfoTitle] = useState('');
  const [newInfoContent, setNewInfoContent] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // --- Data Logic ---
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
          
          // 【FIX】 Simplified data loading to match the saving logic
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

  const saveStage1DataToFirestore = async (updatedData: Stage1DataType) => {
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

  const handleEditInfo = (type: keyof Stage1DataType, item: Stage1Item) => {
    setNewInfoType(type);
    setNewInfoTitle(item.title);
    setNewInfoContent(item.content);
    setEditingItemId(item.id);
  };

  const handleDeleteInfo = async (type: keyof Stage1DataType, itemId: string) => {
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
      const result = await analyzeProductFunc(stage1Data);
      const data = result.data as { success: boolean; keywords: string; productElements: any; customerPersonas: string; };
      if (data.success) {
        const stage2Result = {
          keywords: data.keywords,
          productElements: data.productElements,
          customerPersonas: data.customerPersonas,
        };
        setStage2Data(stage2Result);
        const projectDocRef = doc(db, "users", user!.uid, "projects", projectId);
        await updateDoc(projectDocRef, {
          stage2: stage2Result,
          currentStage: 2,
          updatedAt: new Date(),
        });
        setCurrentStage(2);
      } else {
        throw new Error("AI summary generation failed.");
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
        throw new Error("Strategy hypothesis generation failed.");
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
    { key: 'productInfo', label: '商品情報', placeholder: '商品名、特徴、価格など' },
    { key: 'customerInfo', label: '顧客情報', placeholder: 'ターゲット顧客の年齢、悩みなど' },
    { key: 'competitorInfo', label: '競合情報', placeholder: '競合の商品、広告など' },
    { key: 'marketInfo', label: '市場情報', placeholder: '業界トレンド、市場規模など' },
    { key: 'brandInfo', label: '自社・ブランド情報', placeholder: '自社の強み、ブランドイメージなど' },
    { key: 'pastData', label: '過去の施策データ', placeholder: '過去の広告施策の成果など' },
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
        {/* Stage 1 */}
        <div className="bg-white p-8 rounded-lg shadow mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">1. 情報基盤 (Foundation)</h2>
          {stage1FieldDefinitions.map((fieldDef) => (
            <div key={fieldDef.key} className="mb-6 border-b pb-4 border-gray-100 last:border-b-0 last:pb-0">
              <h3 className="text-lg font-semibold text-gray-700 mb-3">{fieldDef.label}</h3>
              {stage1Data[fieldDef.key as keyof Stage1DataType].length > 0 ? (
                <ul className="space-y-2 mb-4">
                  {stage1Data[fieldDef.key as keyof Stage1DataType].map((item) => (
                    <li key={item.id} className="bg-gray-50 p-3 rounded-md border border-gray-200 flex justify-between items-center text-sm">
                      <span className="font-medium text-gray-800 truncate">{item.title}</span>
                      <div className="flex space-x-2 ml-4">
                        <button onClick={() => handleEditInfo(fieldDef.key as keyof Stage1DataType, item)} className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-md">編集</button>
                        <button onClick={() => handleDeleteInfo(fieldDef.key as keyof Stage1DataType, item.id)} className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded-md">削除</button>
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
                  onChange={(e) => { setNewInfoType(fieldDef.key as keyof Stage1DataType); setNewInfoTitle(e.target.value); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm shadow-sm"
                  required
                />
                <textarea
                  placeholder={fieldDef.placeholder}
                  value={newInfoType === fieldDef.key ? newInfoContent : ''}
                  onChange={(e) => { setNewInfoType(fieldDef.key as keyof Stage1DataType); setNewInfoContent(e.target.value); }}
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
          <div className="mt-6 text-right">
            <button onClick={handleAnalyzeStage1to2} disabled={aiLoading} className="px-8 py-3 font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed">
              {aiLoading ? 'AIサマリー生成中...' : 'AIにサマリーとペルソナ作成を依頼 →'}
            </button>
          </div>
          {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
        </div>

        {/* Stage 2 */}
        <div className={`bg-white p-8 rounded-lg shadow mb-8 ${currentStage < 2 ? 'opacity-50 pointer-events-none' : ''}`}>
          <h2 className="text-xl font-semibold text-gray-800 mb-6">2. AIサマリー & ペルソナ</h2>
          {stage2Data && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">キーワード</h3>
                <p>{stage2Data.keywords}</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">商品要素</h3>
                <ul className="list-disc list-inside text-gray-600 space-y-1">
                  <li>**特徴:** {stage2Data.productElements?.features || 'なし'}</li>
                  <li>**メリット:** {stage2Data.productElements?.benefits || 'なし'}</li>
                  <li>**実績:** {stage2Data.productElements?.results || 'なし'}</li>
                  <li>**権威性:** {stage2Data.productElements?.authority || 'なし'}</li>
                  <li>**オファー:** {stage2Data.productElements?.offer || 'なし'}</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">顧客ペルソナ</h3>
                <Markdown>{stage2Data.customerPersonas}</Markdown>
              </div>
            </div>
          )}
          <div className="mt-6 text-right">
            <button onClick={handleAnalyzeStage2to3} disabled={aiLoading || !stage2Data} className="px-8 py-3 font-semibold text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed">
              {aiLoading ? '戦略仮説生成中...' : 'AIに戦略仮説の制作を依頼 →'}
            </button>
          </div>
        </div>

        {/* Stage 3 */}
        <div className={`bg-white p-8 rounded-lg shadow mb-8 ${currentStage < 3 ? 'opacity-50 pointer-events-none' : ''}`}>
          <h2 className="text-xl font-semibold text-gray-800 mb-6">3. 戦略仮説 (LPファーストビュー)</h2>
          {stage3Data && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">キャッチコピー</h3>
                <p>{stage3Data.catchCopy}</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">サブコピー</h3>
                <p>{stage3Data.subCopy}</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">ビジュアルイメージ</h3>
                <p>{stage3Data.visualImageDescription}</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">CTAボタン</h3>
                <p>{stage3Data.ctaButtonText}</p>
              </div>
            </div>
          )}
          <div className="mt-6 text-right">
            <button disabled={aiLoading || !stage3Data} className="px-8 py-3 font-semibold text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed">
              {'AIに広告アウトプットの制作を依頼 →'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}