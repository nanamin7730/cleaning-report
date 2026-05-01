'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) {
      setError('メール送信に失敗しました。メールアドレスを確認してください。')
    } else {
      setMessage('パスワードリセット用のメールを送信しました。メールを確認してください。')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-md w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">パスワードをリセット</h1>
          <p className="text-gray-500 mt-1 text-sm">登録済みのメールアドレスを入力してください</p>
        </div>

        {message ? (
          <div>
            <p className="text-green-600 text-sm bg-green-50 rounded-lg p-4 text-center">
              {message}
            </p>
            <Link
              href="/login"
              className="block text-center mt-4 text-blue-600 text-sm underline"
            >
              ログインページへ戻る
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                メールアドレス
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="example@email.com"
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm bg-red-50 rounded-lg p-3">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white rounded-lg py-3 font-medium text-base hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? '送信中...' : 'リセットメールを送信'}
            </button>

            <Link
              href="/login"
              className="block text-center text-sm text-gray-400 hover:text-gray-600 underline"
            >
              ログインページへ戻る
            </Link>
          </form>
        )}
      </div>
    </div>
  )
}
