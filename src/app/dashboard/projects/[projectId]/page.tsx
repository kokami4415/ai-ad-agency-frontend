// src/app/dashboard/projects/[projectId]/page.tsx
"use client";

import { useEffect, useState, FormEvent } from 'react';
import { useRequireAuth } from '@/contexts/AuthContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from "firebase/functions";
import { db, functions } from '@/lib/firebase';
import Link from 'next/link';
import Markdown from 'react-markdown'; // マークダウンを表示するためのライブラリ

interface PageProps {
  params: {
    projectId: string;
  };
}

// AIからのレスポンスの型を定義
interface AIResponse {
  keywords: string;
  researchSummary: string;
  strategyHypotheses: string;
}

export default function ProjectDetailPage({ params }: PageProps) {
  const { user } = useRequireAuth();
  const { projectId } = params;

  const [project, setProject] = useState<{ name: string; productInfo?: string; aiResponse?: AIResponse } | null>(null);
  const [productInfo, setProductInfo] = useState('');
  const [aiResponse, setAiResponse] = useState<AIResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState('');

  // 初回ロード時にプロジェクトのデータを取得
  useEffect(() => {
    if (user) {
      const getProjectData = async () => {
        setLoading(true);
        const projectDocRef = doc(db, "users", user.uid, "projects", projectId);
        const docSnap = await getDoc(projectDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setProject({ name: data.name, productInfo: data.productInfo, aiResponse: data.aiResponse });
          setProductInfo(data.productInfo || '');
          setAiResponse(data.aiResponse || null);
        } else {
          setError("プロジェクトが見つかりません。");
        }
        setLoading(false);
      };
      getProjectData();
    }
  }, [user, projectId]);

  // 「分析を開始する」ボタンが押された時の処理
  const handleAnalyze = async (e: FormEvent) => {
    e.preventDefault();
    if (!productInfo.trim()) {
      setError("基礎情報を入力してください。");
      return;
    }

    setAiLoading(true);
    setError('');
    setAiResponse(null);

    try {
      // Firebase Functionsの 'analyzeProduct' 関数を呼び出す準備
      const analyzeProductFunc = httpsCallable(functions, 'api-v1-analyzeProduct');
      // 関数にデータを渡して実行
      const result = await analyzeProductFunc({ productInfo });
      const data = result.data as AIResponse;
      
      setAiResponse(data); // 画面に結果を反映

      // 結果をFirestoreに保存
      const projectDocRef = doc(db, "users", user!.uid, "projects", projectId);
      await updateDoc(projectDocRef, {
        productInfo: productInfo,
        aiResponse: data,
        updatedAt: new Date(),
      });

    } catch (err: any) {
      console.error("AI分析の呼び出しに失敗しました:", err);
      setError(`エラーが発生しました: ${err.message}`);
    } finally {
      setAiLoading(false);
    }
  };
  
  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><p>プロジェクトを読み込み中...</p></div>;
  }
  
  if (error && !project) {
    return <div className="flex items-center justify-center min-h-screen"><p>{error}</p></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <Link href="/dashboard" className="text-sm text-indigo-600 hover:underline mb-2 inline-block">← ダッシュボードに戻る</Link>
          <h1 className="text-2xl font-bold leading-tight text-gray-900">
            プロジェクト: {project?.name}
          </h1>
        </div>
      </header>
      
      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <form onSubmit={handleAnalyze}>
          <div className="bg-white p-8 rounded-lg shadow">
              <h2 className="text-xl font-semibold text-gray-800 mb-6">1. 基礎情報を入力</h2>
              <textarea
                  value={productInfo}
                  onChange={(e) => setProductInfo(e.target.value)}
                  rows={10}
                  className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="ここに宣伝したい商品やサービスに関する情報、ターゲット顧客のペルソナ、過去の広告の成果などを自由に入力してください..."
              ></textarea>
              <div className="mt-6 text-right">
                  <button 
                    type="submit"
                    disabled={aiLoading}
                    className="px-8 py-3 font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed"
                  >
                      {aiLoading ? '分析中...' : '分析を開始する →'}
                  </button>
              </div>
              {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
          </div>
        </form>

        {/* AIのレスポンス表示エリア */}
        {aiLoading && (
          <div className="mt-12 text-center">
            <p className="text-gray-600">AIが分析中です。しばらくお待ちください...</p>
          </div>
        )}

        {aiResponse && (
          <div className="mt-12 space-y-8">
            <h2 className="text-xl font-semibold text-gray-800">2. AIからの戦略提案</h2>
            
            <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="font-semibold text-gray-700 mb-2">抽出キーワード</h3>
                <p className="text-gray-600">{aiResponse.keywords}</p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="font-semibold text-gray-700 mb-2">Webリサーチ要約</h3>
                <p className="text-gray-600 whitespace-pre-wrap">{aiResponse.researchSummary}</p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="font-semibold text-gray-700 mb-2">マーケティング戦略仮説</h3>
                {/* Markdownを適切に表示するために div でラップ */}
                <div className="prose max-w-none">
                  <Markdown>{aiResponse.strategyHypotheses}</Markdown>
                </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}