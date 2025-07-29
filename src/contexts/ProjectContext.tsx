// src/contexts/ProjectContext.tsx
"use client";

import { createContext, useState, useContext, ReactNode, Dispatch, SetStateAction } from 'react';
import { DocumentData } from 'firebase/firestore';

interface ProjectContextType {
  projectData: DocumentData | null;
  setProjectData: Dispatch<SetStateAction<DocumentData | null>>;
  loading: boolean;
  setLoading: Dispatch<SetStateAction<boolean>>;
  error: string | null;
  setError: Dispatch<SetStateAction<string | null>>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projectData, setProjectData] = useState<DocumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const value = { projectData, setProjectData, loading, setLoading, error, setError };

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}