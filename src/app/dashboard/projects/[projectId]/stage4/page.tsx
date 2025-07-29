import StagePageWrapper from '@/components/StagePageWrapper';

interface PageProps { params: { projectId: string; }; }
export default function Stage4Page({ params }: PageProps) {
  const { projectId } = params;
  return <StagePageWrapper projectId={projectId} targetStage={4} />;
}