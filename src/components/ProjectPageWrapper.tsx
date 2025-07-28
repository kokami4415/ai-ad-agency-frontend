// src/components/ProjectPageWrapper.tsx (ステージ1多情報対応版)
"use client";

import { useEffect, useState, FormEvent } from 'react';
import { useRequireAuth } from '@/contexts/AuthContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from "firebase/functions";
import { db, functions } from '@/lib/firebase';
import Link from 'next/link';
import Markdown from 'react-markdown';

// AIからのレスポンスの型を定義 (stage2, stage3の形式)
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

// Stage 1の各情報アイテムの型
interface Stage1Item {
  id: string; // 一意のID
  title: string;
  content: string;
}

// Stage 1のデータの型
interface Stage1DataType {
  productInfo: Stage1Item[];
  customerInfo: Stage1Item[];
  competitorInfo: Stage1Item[];
  marketInfo: Stage1Item[];
  brandInfo: Stage1Item[];
  pastData: Stage1Item[];
}

// Propsの型定義
interface ProjectPageWrapperProps {
  projectId: string;
  projectName: string;
}

export default function ProjectPageWrapper({ projectId, projectName: initialProjectName }: ProjectPageWrapperProps) {
  const { user, loading: authLoading } = useRequireAuth();
  const [projectDisplayName, setProjectDisplayName] = useState(initialProjectName);
  
  const [currentStage, setCurrentStage] = useState(1);
  const [stage1Data, setStage1Data] = useState<Stage1DataType>({ // Stage1Dataの型を更新
    productInfo: [], customerInfo: [], competitorInfo: [],
    marketInfo: [], brandInfo: [], pastData: [],
  });
  const [stage2Data, setStage2Data] = useState<AIResponseStage2Data | null>(null);
  const [stage3Data, setStage3Data] = useState<AIResponseStage3Data | null>(null);

  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState('');

  // 新規追加/編集用のState
  const [newInfoType, setNewInfoType] = useState<keyof Stage1DataType>('productInfo');
  const [newInfoTitle, setNewInfoTitle] = useState('');
  const [newInfoContent, setNewInfoContent] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // 初回ロード時にプロジェクトのデータを取得
  useEffect(() => {
    if (!authLoading && user) {
      const getProjectData = async () => {
        setLoading(true);
        const projectDocRef = doc(db, "users", user.uid, "projects", projectId);
        const docSnap = await getDoc(projectDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setProjectDisplayName(data.name);
          
          // データベースから各ステージのデータを読み込み
          setCurrentStage(data.currentStage || 1);
          // Stage 1のデータを読み込み（配列形式に対応）
          setStage1Data({
            productInfo: data.stage1?.productInfo || [],
            customerInfo: data.stage1?.customerInfo || [],
            competitorInfo: data.stage1?.competitorInfo || [],
            marketInfo: data.stage1?.marketInfo || [],
            brandInfo: data.stage1?.brandInfo || [],
            pastData: data.stage1?.pastData || [],
          });
          setStage2Data(data.stage2?.aiResponse || null);
          setStage3Data(data.stage3?.aiResponse || null);

        } else {
          setError("プロジェクトが見つかりません。");
          setProjectDisplayName("プロジェクトが見つかりません");
        }
        setLoading(false);
      };
      getProjectData();
    } else if (!authLoading && !user) {
      setLoading(false);
    }
  }, [authLoading, user, projectId]);

  // Stage 1の情報をFirestoreに保存するヘルパー関数
  const saveStage1DataToFirestore = async (updatedData: Stage1DataType) => {
    if (!user) return;
    const projectDocRef = doc(db, "users", user.uid, "projects", projectId);
    await updateDoc(projectDocRef, {
      stage1: updatedData, // Stage 1のデータを保存
      updatedAt: new Date(),
    });
    setStage1Data(updatedData); // ローカルStateも更新
  };


  // 新しい情報の追加/編集
  const handleAddOrUpdateInfo = async (e: FormEvent) => {
    e.preventDefault();
    if (!newInfoTitle.trim() || !newInfoContent.trim()) {
      setError("タイトルと内容を入力してください。");
      return;
    }

    const updatedStage1Data = { ...stage1Data };
    if (editingItemId) {
      // 既存アイテムの更新
      updatedStage1Data[newInfoType] = updatedStage1Data[newInfoType].map(item =>
        item.id === editingItemId ? { ...item, title: newInfoTitle, content: newInfoContent } : item
      );
    } else {
      // 新規アイテムの追加
      const newItem: Stage1Item = { id: Date.now().toString(), title: newInfoTitle, content: newInfoContent };
      updatedStage1Data[newInfoType] = [...updatedStage1Data[newInfoType], newItem];
    }
    
    await saveStage1DataToFirestore(updatedStage1Data); // Firestoreに保存
    
    // Stateをリセット
    setNewInfoTitle('');
    setNewInfoContent('');
    setEditingItemId(null);
    setError('');
  };

  // 情報の編集開始
  const handleEditInfo = (type: keyof Stage1DataType, item: Stage1Item) => {
    setNewInfoType(type);
    setNewInfoTitle(item.title);
    setNewInfoContent(item.content);
    setEditingItemId(item.id);
    setError('');
  };

  // 情報の削除
  const handleDeleteInfo = async (type: keyof Stage1DataType, itemId: string) => {
    if (!confirm("この情報を削除しますか？")) return;
    const updatedStage1Data = { ...stage1Data };
    updatedStage1Data[type] = updatedStage1Data[type].filter(item => item.id !== itemId);
    await saveStage1DataToFirestore(updatedStage1Data); // Firestoreに保存
    setError('');
  };


  // Stage 1 -> Stage 2 のAI分析 (AIサマリーとペルソナ作成)
  const handleAnalyzeStage1to2 = async (e: FormEvent) => {
    e.preventDefault();
    // Stage 1のデータが空でないか確認（商品情報が最低1つは必要）
    if (Object.values(stage1Data).every(arr => arr.length === 0)) {
      setError("ステージ1の情報を入力してください。");
      return;
    }
    if (stage1Data.productInfo.length === 0) {
      setError("最低1つの商品情報を入力してください。");
      return;
    }


    setAiLoading(true);
    setError('');
    setStage2Data(null); // Stage 2の結果をクリア

    try {
      const analyzeProductFunc = httpsCallable(functions, 'analyzeProduct');
      // Stage 1の全てのデータをペイロードとして送信
      const result = await analyzeProductFunc(stage1Data); 
      const data = result.data as { success: boolean; stage2Data: AIResponseStage2Data; };

      if (data.success) {
        setStage2Data(data.stage2Data);
        const projectDocRef = doc(db, "users", user!.uid, "projects", projectId);
        await updateDoc(projectDocRef, {
          stage1: stage1Data, // Stage 1のデータを保存
          stage2: { aiResponse: data.stage2Data, strategyHypothesisCreated: true }, // Stage 2のデータと完了フラグを保存
          currentStage: 2, // ステージを2に進める
          updatedAt: new Date(),
        });
        setCurrentStage(2); // UIのステージも更新
      } else {
        setError("AIサマリー生成に失敗しました。");
        console.error("AIサマリー生成に失敗しました:", data);
      }
    } catch (err: any) {
      console.error("AIサマリー呼び出しに失敗しました:", err);
      setError(`AIサマリー呼び出しに失敗しました: ${err.message}`);
    } finally {
      setAiLoading(false);
    }
  };
  
  // Stage 2 -> Stage 3 のAI分析 (戦略仮説LPファーストビュー作成)
  const handleAnalyzeStage2to3 = async (e: FormEvent) => {
    e.preventDefault();
    if (!stage2Data) {
      setError("ステージ2のAIサマリーを生成してから依頼してください。");
      return;
    }

    setAiLoading(true);
    setError('');
    setStage3Data(null); // Stage 3の結果をクリア

    try {
      const generateLpFirstViewFunc = httpsCallable(functions, 'generateLpFirstView'); // 新しいFunctionsを呼び出す
      // Stage 2のデータをペイロードとして送信
      const result = await generateLpFirstViewFunc(stage2Data); 
      const data = result.data as { success: boolean; stage3Data: AIResponseStage3Data; };

      if (data.success) {
        setStage3Data(data.stage3Data);
        const projectDocRef = doc(db, "users", user!.uid, "projects", projectId);
        await updateDoc(projectDocRef, {
          stage3: { aiResponse: data.stage3Data, outputGenerationRequested: true }, // Stage 3のデータと完了フラグを保存
          currentStage: 3, // ステージを3に進める
          updatedAt: new Date(),
        });
        setCurrentStage(3); // UIのステージも更新
      } else {
        setError("戦略仮説生成に失敗しました。");
        console.error("戦略仮説生成に失敗しました:", data);
      }
    } catch (err: any) {
      console.error("戦略仮説呼び出しに失敗しました:", err);
      setError(`戦略仮説呼び出しに失敗しました: ${err.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  // UIのレンダリング
  if (authLoading || loading) {
    return <div className="flex items-center justify-center min-h-screen"><p>読み込み中...</p></div>;
  }
  
  if (!user) {
    return null;
  }

  if (error && projectDisplayName === "プロジェクトが見つかりません") {
    return <div className="flex items-center justify-center min-h-screen"><p>{error}</p></div>;
  }

  const stage1FieldDefinitions = [
    { key: 'productInfo', label: '商品情報', placeholder: '商品名、特徴、価格、強みなど' },
    { key: 'customerInfo', label: '顧客情報', placeholder: 'ターゲット顧客の年齢、悩み、購買行動など' },
    { key: 'competitorInfo', label: '競合情報', placeholder: '競合の商品、広告、Webサイトなど' },
    { key: 'marketInfo', label: '市場情報', placeholder: '業界トレンド、市場規模、規制など' },
    { key: 'brandInfo', label: '自社・ブランド情報', placeholder: '自社の強み、弱み、ブランドイメージなど' },
    { key: 'pastData', label: '過去の施策データ', placeholder: '過去の広告施策、Webサイトのデータなど' },
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
        {/* ステージ1: 情報基盤 (Foundation) */}
        <div className="bg-white p-8 rounded-lg shadow mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-6">1. 情報基盤 (Foundation)</h2>
            
            {stage1FieldDefinitions.map((fieldDef) => (
              <div key={fieldDef.key} className="mb-6 border-b pb-4 border-gray-100 last:border-b-0 last:pb-0">
                <h3 className="text-lg font-semibold text-gray-700 mb-3">{fieldDef.label}</h3>
                
                {/* 既存の情報リスト */}
                {stage1Data[fieldDef.key as keyof Stage1DataType].length > 0 ? (
                  <ul className="space-y-2 mb-4">
                    {stage1Data[fieldDef.key as keyof Stage1DataType].map((item) => (
                      <li key={item.id} className="bg-gray-50 p-3 rounded-md border border-gray-200 flex justify-between items-center text-sm">
                        <span className="font-medium text-gray-800 truncate">{item.title}</span>
                        <div className="flex space-x-2 ml-4">
                          <button type="button" onClick={() => handleEditInfo(fieldDef.key as keyof Stage1DataType, item)} className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-md">編集</button>
                          <button type="button" onClick={() => handleDeleteInfo(fieldDef.key as keyof Stage1DataType, item.id)} className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded-md">削除</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500 text-sm mb-4">まだ情報がありません。</p>
                )}

                {/* 新規追加/編集フォーム */}
                <form onSubmit={handleAddOrUpdateInfo} className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <h4 className="font-semibold text-gray-800">
                      {editingItemId ? `情報を編集: ${newInfoType}` : `新しい${fieldDef.label}を追加`}
                    </h4>
                    <input
                      type="text"
                      placeholder="タイトル（例: 顧客インタビュー1、LPのURL）"
                      value={newInfoType === fieldDef.key ? newInfoTitle : ''} // 選択中のタイプのみ表示
                      onChange={(e) => {
                        setNewInfoType(fieldDef.key as keyof Stage1DataType);
                        setNewInfoTitle(e.target.value);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm shadow-sm"
                      required
                    />
                    <textarea
                      placeholder={fieldDef.placeholder}
                      value={newInfoType === fieldDef.key ? newInfoContent : ''} // 選択中のタイプのみ表示
                      onChange={(e) => {
                        setNewInfoType(fieldDef.key as keyof Stage1DataType);
                        setNewInfoContent(e.target.value);
                      }}
                      rows={3}
                      className="w-full p-3 border border-gray-300 rounded-lg text-sm resize-y shadow-sm"
                      required
                    ></textarea>
                    <div className="text-right">
                        <button 
                          type="submit"
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-md shadow-sm"
                        >
                            {editingItemId && newInfoType === fieldDef.key ? '更新' : '追加'}
                        </button>
                        {editingItemId && newInfoType === fieldDef.key && (
                          <button 
                            type="button" 
                            onClick={() => {
                              setEditingItemId(null); 
                              setNewInfoTitle(''); 
                              setNewInfoContent('');
                            }}
                            className="ml-2 px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 text-sm font-semibold rounded-md shadow-sm"
                          >
                            キャンセル
                          </button>
                        )}
                    </div>
                </form>
                {error && editingItemId === null && newInfoType === fieldDef.key && <p className="text-red-500 text-sm mt-2">{error}</p>}
              </div>
            ))}

            <div className="mt-6 text-right">
                <button 
                  type="button"
                  onClick={handleAnalyzeStage1to2}
                  disabled={aiLoading && currentStage === 1}
                  className="px-8 py-3 font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed"
                >
                    {aiLoading && currentStage === 1 ? 'AIサマリー生成中...' : 'AIにサマリーとペルソナ作成を依頼 →'}
                </button>
            </div>
            {error && currentStage === 1 && <p className="text-red-500 text-sm mt-4">{error}</p>}
        </div>

        {/* ステージ2: AIサマリー & ペルソナ */}
        <div className={`bg-white p-8 rounded-lg shadow mb-8 ${currentStage < 2 ? 'opacity-50 pointer-events-none' : ''}`}>
          <h2 className="text-xl font-semibold text-gray-800 mb-6">2. AIサマリー & ペルソナ</h2>
          {currentStage < 2 && <p className="text-gray-500 text-sm mb-4">ステージ1の情報を入力し、「AIにサマリーとペルソナ作成を依頼」してください。</p>}

          {stage2Data && (
            <div className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h3 className="font-semibold text-gray-700 mb-2">キーワード</h3>
                  <p className="text-gray-600">{stage2Data.keywords}</p>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h3 className="font-semibold text-gray-700 mb-2">商品要素</h3>
                  <ul className="list-disc list-inside text-gray-600 space-y-1">
                    <li>**特徴:** {stage2Data.productElements.features || 'なし'}</li>
                    <li>**メリット:** {stage2Data.productElements.benefits || 'なし'}</li>
                    <li>**実績:** {stage2Data.productElements.results || 'なし'}</li>
                    <li>**権威性:** {stage2Data.productElements.authority || 'なし'}</li>
                    <li>**オファー:** {stage2Data.productElements.offer || 'なし'}</li>
                  </ul>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h3 className="font-semibold text-gray-700 mb-2">顧客ペルソナ</h3>
                  <div className="prose max-w-none">
                    <Markdown>{stage2Data.customerPersonas}</Markdown>
                  </div>
              </div>
            </div>
          )}
          
          <div className="mt-6 text-right">
              <button 
                type="button"
                onClick={handleAnalyzeStage2to3}
                disabled={aiLoading || !stage2Data}
                className="px-8 py-3 font-semibold text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                  {aiLoading && currentStage === 2 ? '戦略仮説生成中...' : 'AIに戦略仮説（LPファーストビュー）の制作を依頼 →'}
              </button>
          </div>
          {error && currentStage === 2 && <p className="text-red-500 text-sm mt-4">{error}</p>}
        </div>

        {/* ステージ3: 戦略仮説 (LPファーストビュー) */}
        <div className={`bg-white p-8 rounded-lg shadow mb-8 ${currentStage < 3 ? 'opacity-50 pointer-events-none' : ''}`}>
          <h2 className="text-xl font-semibold text-gray-800 mb-6">3. 戦略仮説 (LPファーストビュー)</h2>
          {currentStage < 3 && <p className="text-gray-500 text-sm mb-4">ステージ2の情報を入力し、「AIに戦略仮説の制作を依頼」してください。</p>}
          
          {stage3Data && (
            <div className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h3 className="font-semibold text-gray-700 mb-2">キャッチコピー</h3>
                  <p className="text-gray-600">{stage3Data.catchCopy}</p>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h3 className="font-semibold text-gray-700 mb-2">サブコピー</h3>
                  <p className="text-gray-600">{stage3Data.subCopy}</p>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h3 className="font-semibold text-gray-700 mb-2">ビジュアルイメージ</h3>
                  <p className="text-gray-600">{stage3Data.visualImageDescription}</p>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h3 className="font-semibold text-gray-700 mb-2">CTAボタン</h3>
                  <p className="text-gray-600">{stage3Data.ctaButtonText}</p>
              </div>
            </div>
          )}

          <div className="mt-6 text-right">
              <button 
                type="button"
                // onClick={handleAnalyzeStage3to4} // ステージ4のハンドラを後で追加
                disabled={aiLoading || !stage3Data}
                className="px-8 py-3 font-semibold text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                  {aiLoading && currentStage === 3 ? 'アウトプット生成中...' : 'AIに具体的な広告アウトプットの制作を依頼 →'}
              </button>
          </div>
          {error && currentStage === 3 && <p className="text-red-500 text-sm mt-4">{error}</p>}
        </div>

        {/* ステージ4: アウトプット (広告クリエイティブ) */}
        <div className={`bg-white p-8 rounded-lg shadow ${currentStage < 4 ? 'opacity-50 pointer-events-none' : ''}`}>
          <h2 className="text-xl font-semibold text-gray-800 mb-6">4. アウトプット (広告クリエイティブ)</h2>
          {currentStage < 4 && <p className="text-gray-500 text-sm mb-4">ステージ3の戦略仮説を生成すると、ここに具体的なアウトプットが表示されます。</p>}

          {currentStage === 4 && (
            <div>
              {/* ここにアウトプットの一覧と追加ボタンを後で実装 */}
              <p className="text-gray-600">具体的な広告アウトプットが表示されます。</p>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}