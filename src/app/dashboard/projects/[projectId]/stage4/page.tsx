// src/app/dashboard/projects/[projectId]/stage4/page.tsx
import StagePageWrapper from '@/components/StagePageWrapper';

interface PageProps { params: Promise<{ projectId: string; }>; }
export default async function Stage4Page({ params }: PageProps) {
  const resolvedParams = await params;
  const { projectId } = resolvedParams;
  return <StagePageWrapper projectId={projectId} targetStage={4} />;
}