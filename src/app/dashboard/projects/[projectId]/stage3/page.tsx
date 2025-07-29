"use client";

import { useState, useEffect } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { useParams, useRouter } from 'next/navigation';

interface AIResponseStage3Data {
  catchCopy: string;
  subCopy: string;
  visualImageDescription: string;
  ctaButtonText: string;
}

export default function Stage3Page() {
  const { projectData } = useProject();
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const [stage3Data, setStage3Data] = useState<AIResponseStage3Data | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (projectData?.stage3) {
      setStage3Data(projectData.stage3);
    }
  }, [projectData]);

  const handleAnalyzeStage3to4 = async () => {
    alert("ステージ4は現在開発中です。");
    router.push(`/dashboard/projects/${projectId}/stage4`);
  };

  if (!projectData) {
    return <p>データを読み込み中...</p>;
  }

  return (
    <div className="bg-white p-8 rounded-lg shadow mb-8">
      {!stage3Data ? (
        <p className="text-gray-500 text-sm">ステージ2の分析を完了し、「AIに戦略仮説の制作を依頼」を実行してください。</p>
      ) : (
        <div>
          <div className="space-y-6">
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <h3 className="font-semibold text-gray-700 mb-2">キャッチコピー</h3>
              <p className="text-gray-800 text-lg font-bold">{stage3Data.catchCopy}</p>
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
              <p className="text-gray-600 font-medium">{stage3Data.ctaButtonText}</p>
            </div>
          </div>
          <div className="mt-6 text-right">
            <button 
              type="button"
              onClick={handleAnalyzeStage3to4}
              disabled={aiLoading || !stage3Data}
              className="px-8 py-3 font-semibold text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {aiLoading ? 'アウトプット生成中...' : 'AIに広告アウトプットの制作を依頼 →'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}