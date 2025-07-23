// src/app/dashboard/projects/[projectId]/page.tsx
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRequireAuth } from '@/contexts/AuthContext'; // クライアントコンポーネントではないが、ユーザー情報取得のために必要
import ProjectPageWrapper from '@/components/ProjectPageWrapper'; // 新しいラッパーコンポーネントをインポート

// URLのパラメータから型を取得するために必要
interface PageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { user } = useRequireAuth(); // ユーザー情報を取得
  const resolvedParams = await params;
  const { projectId } = resolvedParams;

  // サーバーコンポーネントで直接Firestoreからプロジェクト名を取得
  // 注意: `user` はサーバーサイドではundefinedになる可能性があるため、注意深く扱う
  // 本来はサーバー側で認証チェックを挟むべきだが、今回はシンプルにするためクライアント側でのリダイレクトに依存
  let projectName = 'プロジェクト';
  if (user?.uid) { // userが存在する場合のみFirestoreアクセス
    const projectDocRef = doc(db, "users", user.uid, "projects", projectId);
    const docSnap = await getDoc(projectDocRef);
    if (docSnap.exists()) {
      projectName = docSnap.data().name;
    }
  } else {
    // userがnullの場合、useRequireAuthがクライアント側でリダイレクトするのを期待
    projectName = "プロジェクトを読み込み中...";
  }

  return (
    // ProjectPageWrapper に projectId と projectName を渡す
    <ProjectPageWrapper projectId={projectId} projectName={projectName} />
  );
}
