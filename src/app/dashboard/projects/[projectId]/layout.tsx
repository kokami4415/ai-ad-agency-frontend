// src/app/dashboard/projects/[projectId]/layout.tsx (型定義修正版)
"use client";

import { useEffect, ReactNode } from 'react';
import { useRequireAuth } from '@/contexts/AuthContext';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ProjectProvider, useProject } from '@/contexts/ProjectContext';

// 【修正点】 正しいPropsの型を定義
interface ProjectLayoutParams {
  children: ReactNode;
  params: {
    projectId: string;
  };
}

function ProjectLayout({ children, params }: ProjectLayoutParams) {
  const { user } = useRequireAuth();
  const pathname = usePathname();
  const { projectData, setProjectData, setLoading, setError } = useProject();
  const { projectId } = params;

  useEffect(() => {
    if (user && projectId) {
      setLoading(true);
      const projectDocRef = doc(db, "users", user.uid, "projects", projectId);
      const unsubscribe = onSnapshot(projectDocRef, (docSnap) => {
        if (docSnap.exists()) {
          setProjectData(docSnap.data());
          setError(null);
        } else {
          setError("プロジェクトが見つかりません。");
        }
        setLoading(false);
      }, (error) => {
        setError("データの取得に失敗しました。");
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, [user, projectId, setProjectData, setLoading, setError]);

  const currentStage = projectData?.currentStage || 1;
  const stageLinks = [
    { num: 1, path: `/stage1`, label: "1. 情報基盤" },
    { num: 2, path: `/stage2`, label: "2. AIサマリー" },
    { num: 3, path: `/stage3`, label: "3. 戦略仮説" },
    { num: 4, path: `/stage4`, label: "4. アウトプット" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <Link href="/dashboard" className="text-sm text-indigo-600 hover:underline mb-2 inline-block">← ダッシュボードに戻る</Link>
          <h1 className="text-2xl font-bold leading-tight text-gray-900">
            プロジェクト: {projectData?.name || '読み込み中...'}
          </h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="mb-8 p-2 bg-white rounded-lg shadow-md flex justify-around border border-gray-200">
          {stageLinks.map(link => {
            const isActive = pathname.endsWith(link.path);
            const isEnabled = link.num <= currentStage;
            return (
              <Link 
                key={link.num}
                href={isEnabled ? `/dashboard/projects/${projectId}${link.path}` : '#'}
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
        {children}
      </main>
    </div>
  );
}

export default function ProjectLayoutWrapper({ children, params }: ProjectLayoutParams) {
  return (
    <ProjectProvider>
      <ProjectLayout params={params}>{children}</ProjectLayout>
    </ProjectProvider>
  );
}