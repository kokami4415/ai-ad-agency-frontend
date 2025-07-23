// src/app/dashboard/projects/[projectId]/page.tsx (最終確定版: 純粋なサーバーコンポーネント)
import ProjectPageWrapper from '@/components/ProjectPageWrapper';

// paramsは直接オブジェクトとして渡されると仮定して型を定義
interface PageProps {
  params: {
    projectId: string;
  };
}

// サーバーコンポーネントなのでasyncを付けるが、データ取得は行わない
// 純粋にprojectIdをクライアントコンポーネントに渡すだけ
export default async function ProjectDetailPage({ params }: PageProps) {
  // params は直接オブジェクトとして渡されるので、await は不要
  const { projectId } = params;

  // プロジェクト名の初期表示用。実際のデータ取得はProjectPageWrapper内で行われる。
  const initialProjectName = '読み込み中...'; 

  return (
    <ProjectPageWrapper
      projectId={projectId}
      projectName={initialProjectName} // 初期値を渡す
    />
  );
}