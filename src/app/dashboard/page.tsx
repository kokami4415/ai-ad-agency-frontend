// src/app/dashboard/page.tsx
"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRequireAuth } from "@/contexts/AuthContext";
import { auth, db } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { collection, addDoc, query, onSnapshot, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from 'next/link';

interface Project {
  id: string;
  name: string;
}

export default function Dashboard() {
  const { user, loading } = useRequireAuth();
  const router = useRouter();

  const [newProjectName, setNewProjectName] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState("");
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState("");

  useEffect(() => {
    if (user) {
      const projectsColRef = collection(db, "users", user.uid, "projects");
      const q = query(projectsColRef);
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const projectsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name,
        }));
        setProjects(projectsData);
      });
      return () => unsubscribe();
    }
  }, [user]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/');
  };

  const handleCreateProject = async (e: FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || !user) return;
    try {
      const projectsColRef = collection(db, "users", user.uid, "projects");
      const docRef = await addDoc(projectsColRef, {
        name: newProjectName,
        currentStage: 1,
        createdAt: new Date(),
      });
      setNewProjectName("");
      router.push(`/dashboard/projects/${docRef.id}/stage1`);
    } catch (err) {
      setError("プロジェクトの作成に失敗しました。");
    }
  };

  const handleEditProject = (project: Project) => {
    setEditingProjectId(project.id);
    setEditingProjectName(project.name);
  };

  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingProjectName.trim() || !editingProjectId || !user) return;
    try {
      const projectDocRef = doc(db, "users", user.uid, "projects", editingProjectId);
      await updateDoc(projectDocRef, { name: editingProjectName });
      setEditingProjectId(null);
    } catch (err) {
      setError("プロジェクト名の変更に失敗しました。");
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!user || !confirm("本当にこのプロジェクトを削除しますか？")) return;
    try {
      const projectDocRef = doc(db, "users", user.uid, "projects", projectId);
      await deleteDoc(projectDocRef);
    } catch (err) {
      setError("プロジェクトの削除に失敗しました。");
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><p>読み込み中...</p></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">ダッシュボード</h1>
          <button onClick={handleLogout} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700">ログアウト</button>
        </div>
      </header>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">新しいプロジェクトを作成</h2>
          <form onSubmit={handleCreateProject} className="flex items-center gap-4">
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="プロジェクト名"
              className="flex-grow px-3 py-2 border border-gray-300 rounded-md shadow-sm"
              required
            />
            <button type="submit" className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">作成</button>
          </form>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">プロジェクト一覧</h2>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <ul className="divide-y divide-gray-200">
              {projects.length > 0 ? projects.map((project) => (
                <li key={project.id} className="px-6 py-4 flex items-center justify-between">
                  {editingProjectId === project.id ? (
                    <form onSubmit={handleSaveEdit} className="flex flex-grow items-center gap-2">
                      <input type="text" value={editingProjectName} onChange={(e) => setEditingProjectName(e.target.value)} className="flex-grow px-2 py-1 border border-gray-300 rounded-md shadow-sm text-sm" required/>
                      <button type="submit" className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded-md">保存</button>
                      <button type="button" onClick={() => setEditingProjectId(null)} className="px-3 py-1 bg-gray-300 hover:bg-gray-400 text-gray-800 text-xs rounded-md">キャンセル</button>
                    </form>
                  ) : (
                    <>
                      <Link href={`/dashboard/projects/${project.id}/stage1`} className="block text-sm font-medium text-indigo-600 hover:underline flex-grow">
                        {project.name}
                      </Link>
                      <div className="flex gap-2 ml-4">
                        <button onClick={() => handleEditProject(project)} className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-md">編集</button>
                        <button onClick={() => handleDeleteProject(project.id)} className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded-md">削除</button>
                      </div>
                    </>
                  )}
                </li>
              )) : (
                <li className="px-6 py-4"><p className="text-sm text-gray-500">プロジェクトはまだありません。</p></li>
              )}
            </ul>
          </div>
        </div>
        {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
      </main>
    </div>
  );
}