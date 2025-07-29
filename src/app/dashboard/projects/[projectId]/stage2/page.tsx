"use client";

import { useState, useEffect } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { doc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from "firebase/functions";
import { db, functions } from '@/lib/firebase';
import { useRequireAuth } from '@/contexts/AuthContext';
import { useParams, useRouter } from 'next/navigation';
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

export default function Stage2Page() {
  const { user } = useRequireAuth();
  const { projectData } = useProject();
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const [stage2Data, setStage2Data] = useState<AIResponseStage2Data | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (projectData?.stage2) {
      setStage2Data(projectData.stage2);
    }
  }, [projectData]);

  const handleAnalyzeStage2to3 = async () => {
    if (!stage2Data) {
      setError("ステージ2のAIサマリーが存在しません。");
      return;
    }
    setAiLoading(true);
    setError('');
    try {
      const generateLpFirstViewFunc = httpsCallable(functions, 'generateLpFirstView');
      const result = await generateLpFirstViewFunc(stage2Data);
      const data = result.data as { success: boolean; stage3Data: AIResponseStage3Data; };

      if (data.success) {
        const projectDocRef = doc(db, "users", user!.uid, "projects", projectId);
        await updateDoc(projectDocRef, {
          stage3: data.stage3Data,
          currentStage: 3,
          updatedAt: new Date(),
        });
        router.push(`/dashboard/projects/${projectId}/stage3`); // Navigate to Stage 3
      } else {
        throw new Error("戦略仮説生成に失敗しました。");
      }
    } catch (err: any) {
      setError(`戦略仮説呼び出しに失敗しました: ${err.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  if (!projectData) {
    return <p>データを読み込み中...</p>;
  }

  return (
    <div className="bg-white p-8 rounded-lg shadow mb-8">
      {!stage2Data ? (
        <p className="text-gray-500 text-sm">ステージ1の情報を入力し、「AIにサマリー作成を依頼」を完了してください。</p>
      ) : (
        <div>
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
          <div className="mt-6 text-right">
            <button 
              type="button"
              onClick={handleAnalyzeStage2to3}
              disabled={aiLoading || !stage2Data}
              className="px-8 py-3 font-semibold text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {aiLoading ? '戦略仮説を生成中...' : 'AIに戦略仮説の制作を依頼 →'}
            </button>
          </div>
          {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
        </div>
      )}
    </div>
  );
}