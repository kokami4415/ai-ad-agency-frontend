// src/app/dashboard/projects/[projectId]/page.tsx (最終確定版)
import ProjectPageWrapper from '@/components/ProjectPageWrapper'; // ラッパーコンポーネントをインポート
import { doc, getDoc } from 'firebase/firestore'; // Firestoreアクセス用
import { db } from '@/lib/firebase'; // Firebase DBインスタンス

interface PageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const resolvedParams = await params;
  const { projectId } = resolvedParams;

  // Firestoreからプロジェクト名を取得 (サーバーサイドで実行)
  // 注意: サーバーコンポーネントはユーザー認証情報に直接アクセスできないため、
  // ユーザーIDはクライアント側で取得されることを前提とする
  // ここではprojectIdのみを頼りにダミーデータとして取得を試みる
  // 実際の認証されたユーザーIDはProjectPageWrapper内で取得される
  let projectName = '読み込み中...';
  try {
    // サーバーサイドでのFirestoreアクセスは認証情報なしで行うため、
    // 実際にユーザーのデータにアクセスするには特別な考慮が必要。
    // ここでは便宜上、projectIdのみでダミーの取得を試みるが、
    // 実際のユーザーデータはクライアント側で取得されるべき。
    // そのため、一時的に固定のユーザーIDでダミーアクセスを試みるか、
    // プロジェクト名取得をProjectPageWrapperに完全に移譲する。
    // → ここではprojectIdのみを渡し、projectNameの取得はProjectPageWrapperに任せる
    projectName = "プロジェクト"; // 初期表示として仮の値を設定
  } catch (error) {
    console.error("Server-side project name fetch error:", error);
  }

  return (
    // projectIdのみを渡す。projectNameの実際の取得はWrapper内で行う。
    <ProjectPageWrapper projectId={projectId} projectName={projectName} />
  );
}
