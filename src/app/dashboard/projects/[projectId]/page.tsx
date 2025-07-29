// src/app/dashboard/projects/[projectId]/page.tsx (最終確定版: Promiseとしてparamsを扱う)
import ProjectPageWrapper from '@/components/ProjectPageWrapper';

// paramsはPromiseとして渡されると仮定して型を定義
interface PageProps {
  params: Promise<{ // ← ここをPromiseに戻す
    projectId: string;
  }>;
}

// サーバーコンポーネントなのでasyncを付ける
export default async function ProjectDetailPage({ params }: PageProps) {
  // params はPromiseなので、await で解決する
  const resolvedParams = await params; 
  const { projectId } = resolvedParams;

  // プロジェクト名の初期表示用。実際のデータ取得はProjectPageWrapper内で行われる。
  const initialProjectName = '読み込み中...'; 

  return (
    <ProjectPageWrapper
      projectId={projectId}
      projectName={initialProjectName} // 初期値を渡す
    />
  );
}