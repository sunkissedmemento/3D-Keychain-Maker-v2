'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'

const KeychainApp = dynamic(() => import('@/components/KeychainApp'), { ssr: false })
const SchoolIDApp = dynamic(() => import('@/components/SchoolIDApp'), { ssr: false })

export default function HomeClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const app = searchParams.get('app') ?? 'keychain'
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    fetch('/api/me')
      .then(r => r.json())
      .then(d => {
        if (!d.ok) router.replace('/login')
        else setAuthed(true)
      })
      .catch(() => router.replace('/login'))
  }, [router])

  if (!authed) return (
    <div style={{ display: 'flex', height: '100dvh', alignItems: 'center', justifyContent: 'center', background: '#0f0a1a', color: '#c084fc', fontFamily: 'sans-serif', fontSize: 13 }}>
      Checking session…
    </div>
  )

  return app === 'school' ? <SchoolIDApp /> : <KeychainApp />
}
