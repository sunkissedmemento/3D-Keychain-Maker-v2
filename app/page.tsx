'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseClient'
import KeychainApp from '@/components/KeychainApp'
import SchoolIDApp from '@/components/SchoolIDApp'

const APPS = {
  keychain: KeychainApp,
  school: SchoolIDApp,
} as const

type AppKey = keyof typeof APPS

export default function HomePage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const appParam = searchParams.get('app') || 'keychain'
  const appKey: AppKey = appParam in APPS ? (appParam as AppKey) : 'keychain'
  const Component = APPS[appKey]

  useEffect(() => {
    async function checkSession() {
      const { data } = await supabase.auth.getSession()

      if (!data.session) {
        router.push('/login')
        return
      }

      setUser(data.session.user)
      setLoading(false)
    }

    checkSession()
  }, [router])

  if (loading) return <p>Loading...</p>
  if (!user) return null

  return <Component />
}