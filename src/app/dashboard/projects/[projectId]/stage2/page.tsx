import StagePageWrapper from '@/components/StagePageWrapper';

interface PageProps { params: { projectId: string; }; }
export default function Stage2Page({ params }: PageProps) {
  const { projectId } = params;
  return <StagePageWrapper projectId={projectId} targetStage={2} />;
}