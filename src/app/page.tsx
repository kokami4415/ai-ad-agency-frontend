// src/app/page.tsx (最終ログインフォーム版)
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from '@/lib/firebase';

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!email || !password) {
      setError("メールアドレスとパスワードを入力してください。");
      return;
    }

    try {
      if (isLogin) {
        // ログイン処理
        await signInWithEmailAndPassword(auth, email, password);
        setMessage("ログインに成功しました！");
        router.push('/dashboard'); // ログイン後のリダイレクト
      } else {
        // 新規登録処理
        await createUserWithEmailAndPassword(auth, email, password);
        setMessage("ユーザー登録が完了しました。続けてログインしてください。");
      }
    } catch (err: any) {
      setError(getFirebaseErrorMessage(err.code));
      console.error(err);
    }
  };

  const getFirebaseErrorMessage = (code: string) => {
    switch (code) {
      case 'auth/invalid-email':
        return '無効なメールアドレスです。';
      case 'auth/user-not-found':
        return 'このメールアドレスは登録されていません。';
      case 'auth/wrong-password':
        return 'パスワードが間違っています。';
      case 'auth/email-already-in-use':
        return 'このメールアドレスは既に使用されています。';
      case 'auth/weak-password':
        return 'パスワードは6文字以上で入力してください。';
      default:
        return 'エラーが発生しました。しばらくしてからもう一度お試しください。';
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center text-gray-900">
          {isLogin ? 'ログイン' : '新規登録'}
        </h2>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              メールアドレス
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              パスワード
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          
          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm text-green-600">{message}</p>}

          <div>
            <button
              type="submit"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {isLogin ? 'ログイン' : '登録する'}
            </button>
          </div>
        </form>

        <p className="mt-2 text-sm text-center text-gray-600">
          {isLogin ? 'アカウントをお持ちでないですか？' : '既にアカウントをお持ちですか？'}
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
              setMessage('');
            }}
            className="font-medium text-indigo-600 hover:text-indigo-500"
          >
            {isLogin ? '新規登録へ' : 'ログインへ'}
          </button>
        </p>
      </div>
    </div>
  );
}