// src/components/ProjectPageWrapper.tsx (Functions連携最終確定版)
"use client";

import { useEffect, useState, FormEvent } from 'react';
import { useRequireAuth } from '@/contexts/AuthContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from "firebase/functions";
import { db, functions } from '@/lib/firebase';
import Link from 'next/link';
import Markdown from 'react-markdown';

// AIからのレスポンスの型を定義 (stage2Dataの形式)
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
    productInfo: '',
    customerInfo: '',
    competitorInfo: '',
    marketInfo: '',
    brandInfo: '',
    pastData: '',
  });

  const [aiResponseStage2, setAiResponseStage2] = useState<AIResponseStage2Data | null>(null);
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
          
          // Stage 1のデータを読み込み
          setStage1Data({
            productInfo: data.stage1?.productInfo || '',
            customerInfo: data.stage1?.customerInfo || '',
            competitorInfo: data.stage1?.competitorInfo || '',
            marketInfo: data.stage1?.marketInfo || '',
            brandInfo: data.stage1?.brandInfo || '',
            pastData: data.stage1?.pastData || '',
          });
          
          // Stage 2のAIレスポンスを読み込み
          setAiResponseStage2(data.stage2?.aiResponse || null);

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

  // 「AI分析を開始する」ボタンが押された時の処理
  const handleAnalyze = async (e: FormEvent) => {
    e.preventDefault();
    if (!stage1Data.productInfo.trim()) { // 少なくとも商品情報は必須
      setError("商品情報を入力してください。");
      return;
    }

    setAiLoading(true);
    setError('');
    setAiResponseStage2(null);

    try {
      const analyzeProductFunc = httpsCallable(functions, 'analyzeProduct');
      // Stage 1の全てのデータをペイロードとして送信
      const result = await analyzeProductFunc(stage1Data); 
      const data = result.data as { success: boolean; stage2Data: AIResponseStage2Data; }; // 返り値の型を明示

      if (data.success) {
        setAiResponseStage2(data.stage2Data); // Stage 2のデータをセット
        // 結果とStage 1のデータをFirestoreに保存
        const projectDocRef = doc(db, "users", user!.uid, "projects", projectId);
        await updateDoc(projectDocRef, {
          stage1: stage1Data, // Stage 1のデータを保存
          stage2: { aiResponse: data.stage2Data, strategyHypothesisCreated: true }, // Stage 2のデータと完了フラグを保存
          currentStage: 2, // ステージを2に進める
          updatedAt: new Date(),
        });
      } else {
        setError("AI分析が成功しませんでした。");
        console.error("AI分析が成功しませんでした:", data);
      }
    } catch (err: any) {
      console.error("AI分析の呼び出しに失敗しました:", err);
      setError(`AI分析の呼び出しに失敗しました: ${err.message}`);
    } finally {
      setAiLoading(false);
    }
  };
  
  if (authLoading || loading) {
    return <div className="flex items-center justify-center min-h-screen"><p>読み込み中...</p></div>;
  }
  
  if (!user) {
    return null; // useRequireAuthがリダイレクトする
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
        <form onSubmit={handleAnalyze}>
          <div className="bg-white p-8 rounded-lg shadow">
              <h2 className="text-xl font-semibold text-gray-800 mb-6">1. 情報基盤 (Foundation)</h2>
              {/* Stage 1の入力項目 */}
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
                    type="submit"
                    disabled={aiLoading}
                    className="px-8 py-3 font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed"
                  >
                      {aiLoading ? 'AIサマリー生成中...' : 'AIにサマリーとペルソナ作成を依頼 →'}
                  </button>
              </div>
              {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
          </div>
        </form>

        {/* AIのレスポンス表示エリア (Stage 2) */}
        {aiLoading && (
          <div className="mt-12 text-center">
            <p className="text-gray-600">AIが分析中です。しばらくお待ちください...</p>
          </div>
        )}

        {aiResponseStage2 && (
          <div className="mt-12 space-y-8">
            <h2 className="text-xl font-semibold text-gray-800">2. AIサマリー & ペルソナ</h2>
            
            <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="font-semibold text-gray-700 mb-2">キーワード</h3>
                <p className="text-gray-600">{aiResponseStage2.keywords}</p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="font-semibold text-gray-700 mb-2">商品要素</h3>
                <ul className="list-disc list-inside text-gray-600 space-y-1">
                  <li>**特徴:** {aiResponseStage2.productElements.features || 'なし'}</li>
                  <li>**メリット:** {aiResponseStage2.productElements.benefits || 'なし'}</li>
                  <li>**実績:** {aiResponseStage2.productElements.results || 'なし'}</li>
                  <li>**権威性:** {aiResponseStage2.productElements.authority || 'なし'}</li>
                  <li>**オファー:** {aiResponseStage2.productElements.offer || 'なし'}</li>
                </ul>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="font-semibold text-gray-700 mb-2">顧客ペルソナ</h3>
                <div className="prose max-w-none">
                  <Markdown>{aiResponseStage2.customerPersonas}</Markdown>
                </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}