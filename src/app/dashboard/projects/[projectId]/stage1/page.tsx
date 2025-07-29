import StagePageWrapper from '@/components/StagePageWrapper';

interface PageProps { params: { projectId: string; }; } // ← 正しい型
export default function Stage1Page({ params }: PageProps) { // ← async/await 不要
  const { projectId } = params;
  return <StagePageWrapper projectId={projectId} targetStage={1} />;
}