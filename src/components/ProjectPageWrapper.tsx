// src/components/ProjectPageWrapper.tsx (ステージ3対応 最終確定版)
"use client";

import { useEffect, useState, FormEvent } from 'react';
import { useRequireAuth } from '@/contexts/AuthContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from "firebase/functions";
import { db, functions } from '@/lib/firebase';
import Link from 'next/link';
import Markdown from 'react-markdown';

// AIからのレスポンスの型を定義 (stage2Dataとstage3Dataの形式)
interface AIResponseStage2Data {
  keywords: string;
  productElements: {
    features: string;
    benefits: string;
    results: string;
    authority: string;
    offer: string;
  };
  customerPersonas: string;
}

interface AIResponseStage3Data {
  catchCopy: string;
  subCopy: string;
  visualImageDescription: string;
  ctaButtonText: string;
}

// Propsの型定義
interface ProjectPageWrapperProps {
  projectId: string;
  projectName: string;
}

export default function ProjectPageWrapper({ projectId, projectName: initialProjectName }: ProjectPageWrapperProps) {
  const { user, loading: authLoading } = useRequireAuth();
  const [projectDisplayName, setProjectDisplayName] = useState(initialProjectName);
  
  // Stage 1の入力項目をそれぞれstateで管理
  const [stage1Data, setStage1Data] = useState({
    productInfo: '', customerInfo: '', competitorInfo: '',
    marketInfo: '', brandInfo: '', pastData: '',
  });

  const [aiResponseStage2, setAiResponseStage2] = useState<AIResponseStage2Data | null>(null);
  const [aiResponseStage3, setAiResponseStage3] = useState<AIResponseStage3Data | null>(null); // Stage 3のstateを追加
  const [currentStage, setCurrentStage] = useState(1); // 現在のステージを管理

  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState('');

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
          
          setStage1Data({
            productInfo: data.stage1?.productInfo || '',
            customerInfo: data.stage1?.customerInfo || '',
            competitorInfo: data.stage1?.competitorInfo || '',
            marketInfo: data.stage1?.marketInfo || '',
            brandInfo: data.stage1?.brandInfo || '',
            pastData: data.stage1?.pastData || '',
          });
          setAiResponseStage2(data.stage2?.aiResponse || null);
          setAiResponseStage3(data.stage3?.aiResponse || null); // Stage 3のデータを読み込み
          setCurrentStage(data.currentStage || 1); // 現在のステージを読み込み

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

  // Stage 1 -> Stage 2 のAI分析 (AIサマリーとペルソナ作成)
  const handleAnalyzeStage1to2 = async (e: FormEvent) => {
    e.preventDefault();
    if (!stage1Data.productInfo.trim()) {
      setError("商品情報を入力してください。");
      return;
    }

    setAiLoading(true);
    setError('');
    setAiResponseStage2(null); // Stage 2の結果をクリア

    try {
      const analyzeProductFunc = httpsCallable(functions, 'analyzeProduct');
      const result = await analyzeProductFunc(stage1Data); 
      const data = result.data as { success: boolean; stage2Data: AIResponseStage2Data; };

      if (data.success) {
        setAiResponseStage2(data.stage2Data);
        const projectDocRef = doc(db, "users", user!.uid, "projects", projectId);
        await updateDoc(projectDocRef, {
          stage1: stage1Data,
          stage2: { aiResponse: data.stage2Data, strategyHypothesisCreated: true },
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
    if (!aiResponseStage2) {
      setError("ステージ2のAIサマリーを生成してから依頼してください。");
      return;
    }

    setAiLoading(true);
    setError('');
    setAiResponseStage3(null); // Stage 3の結果をクリア

    try {
      const generateLpFirstViewFunc = httpsCallable(functions, 'generateLpFirstView'); // 新しいFunctionsを呼び出す
      // Stage 2のデータをペイロードとして送信
      const result = await generateLpFirstViewFunc(aiResponseStage2); 
      const data = result.data as { success: boolean; stage3Data: AIResponseStage3Data; };

      if (data.success) {
        setAiResponseStage3(data.stage3Data);
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
            {[
              { key: 'productInfo', label: '商品情報', placeholder: '新商品の特徴、価格、強みなど' },
              { key: 'customerInfo', label: '顧客情報', placeholder: 'ターゲット顧客の年齢層、悩み、欲求、購買行動など' },
              { key: 'competitorInfo', label: '競合情報', placeholder: '競合の商品、広告、Webサイト、評判など' },
              { key: 'marketInfo', label: '市場情報', placeholder: '業界トレンド、市場規模、規制、最新技術など' },
              { key: 'brandInfo', label: '自社・ブランド情報', placeholder: '自社の強み、弱み、ブランドイメージ、ミッションなど' },
              { key: 'pastData', label: '過去の施策データ', placeholder: '過去の広告施策、Webサイトのデータ、キャンペーン結果など' },
            ].map((field) => (
              <div key={field.key} className="mb-4">
                <label htmlFor={field.key} className="block text-gray-700 text-sm font-semibold mb-2">
                  {field.label}:
                </label>
                <textarea
                  id={field.key}
                  value={stage1Data[field.key as keyof typeof stage1Data]}
                  onChange={(e) => setStage1Data({ ...stage1Data, [field.key]: e.target.value })}
                  rows={3}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800 text-base resize-y shadow-sm"
                  placeholder={field.placeholder}
                ></textarea>
              </div>
            ))}

            <div className="mt-6 text-right">
                <button 
                  type="button" // submitではなくbuttonに
                  onClick={handleAnalyzeStage1to2} // 新しいハンドラを呼び出す
                  disabled={aiLoading}
                  className="px-8 py-3 font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed"
                >
                    {aiLoading && currentStage === 1 ? 'AIサマリー生成中...' : 'AIにサマリーとペルソナ作成を依頼 →'}
                </button>
            </div>
            {error && currentStage === 1 && <p className="text-red-500 text-sm mt-4">{error}</p>}
        </div>

        {/* ステージ2: AIサマリー & ペルソナ */}
        <div className={`bg-white p-8 rounded-lg shadow mb-8 ${aiResponseStage2 ? '' : 'opacity-50 pointer-events-none'}`}>
          <h2 className="text-xl font-semibold text-gray-800 mb-6">2. AIサマリー & ペルソナ</h2>
          {!aiResponseStage2 && <p className="text-gray-500 text-sm mb-4">ステージ1の情報を入力し、「AIにサマリーとペルソナ作成を依頼」してください。</p>}

          {aiResponseStage2 && (
            <div className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h3 className="font-semibold text-gray-700 mb-2">キーワード</h3>
                  <p className="text-gray-600">{aiResponseStage2.keywords}</p>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h3 className="font-semibold text-gray-700 mb-2">商品要素</h3>
                  <ul className="list-disc list-inside text-gray-600 space-y-1">
                    <li>**特徴:** {aiResponseStage2.productElements.features || 'なし'}</li>
                    <li>**メリット:** {aiResponseStage2.productElements.benefits || 'なし'}</li>
                    <li>**実績:** {aiResponseStage2.productElements.results || 'なし'}</li>
                    <li>**権威性:** {aiResponseStage2.productElements.authority || 'なし'}</li>
                    <li>**オファー:** {aiResponseStage2.productElements.offer || 'なし'}</li>
                  </ul>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h3 className="font-semibold text-gray-700 mb-2">顧客ペルソナ</h3>
                  <div className="prose max-w-none">
                    <Markdown>{aiResponseStage2.customerPersonas}</Markdown>
                  </div>
              </div>
            </div>
          )}
          
          <div className="mt-6 text-right">
              <button 
                type="button"
                onClick={handleAnalyzeStage2to3} // 新しいハンドラを呼び出す
                disabled={aiLoading || !aiResponseStage2} // Stage 2の結果がないと無効
                className="px-8 py-3 font-semibold text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                  {aiLoading && currentStage === 2 ? '戦略仮説生成中...' : 'AIに戦略仮説（LPファーストビュー）の制作を依頼 →'}
              </button>
          </div>
          {error && currentStage === 2 && <p className="text-red-500 text-sm mt-4">{error}</p>}
        </div>

        {/* ステージ3: 戦略仮説 (LPファーストビュー) */}
        <div className={`bg-white p-8 rounded-lg shadow mb-8 ${aiResponseStage3 ? '' : 'opacity-50 pointer-events-none'}`}>
          <h2 className="text-xl font-semibold text-gray-800 mb-6">3. 戦略仮説 (LPファーストビュー)</h2>
          {!aiResponseStage3 && <p className="text-gray-500 text-sm mb-4">ステージ2の情報を入力し、「AIに戦略仮説の制作を依頼」してください。</p>}
          
          {aiResponseStage3 && (
            <div className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h3 className="font-semibold text-gray-700 mb-2">キャッチコピー</h3>
                  <p className="text-gray-600">{aiResponseStage3.catchCopy}</p>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h3 className="font-semibold text-gray-700 mb-2">サブコピー</h3>
                  <p className="text-gray-600">{aiResponseStage3.subCopy}</p>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h3 className="font-semibold text-gray-700 mb-2">ビジュアルイメージ</h3>
                  <p className="text-gray-600">{aiResponseStage3.visualImageDescription}</p>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h3 className="font-semibold text-gray-700 mb-2">CTAボタン</h3>
                  <p className="text-gray-600">{aiResponseStage3.ctaButtonText}</p>
              </div>
            </div>
          )}

          <div className="mt-6 text-right">
              <button 
                type="button"
                // onClick={handleAnalyzeStage3to4} // ステージ4のハンドラを後で追加
                disabled={aiLoading || !aiResponseStage3} // Stage 3の結果がないと無効
                className="px-8 py-3 font-semibold text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                  {aiLoading && currentStage === 3 ? 'アウトプット生成中...' : 'AIに具体的な広告アウトプットの制作を依頼 →'}
              </button>
          </div>
          {error && currentStage === 3 && <p className="text-red-500 text-sm mt-4">{error}</p>}
        </div>

        {/* ステージ4: アウトプット (広告クリエイティブ) */}
        <div className={`bg-white p-8 rounded-lg shadow ${currentStage === 4 ? '' : 'opacity-50 pointer-events-none'}`}>
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