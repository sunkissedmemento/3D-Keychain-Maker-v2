import { Suspense } from 'react'
import HomeClient from '@/components/HomeClient'

export default function Home() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', height: '100dvh', alignItems: 'center', justifyContent: 'center', background: '#0f0a1a', color: '#c084fc', fontFamily: 'sans-serif', fontSize: 13 }}>
        Checking session…
      </div>
    }>
      <HomeClient />
    </Suspense>
  )
}
