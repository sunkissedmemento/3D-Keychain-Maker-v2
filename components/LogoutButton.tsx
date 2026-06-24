'use client'

import { useRouter } from 'next/navigation'

export default function LogoutButton({ style }: { style?: React.CSSProperties }) {
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/logout', { method: 'POST' })
    router.replace('/login')
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      style={{
        background: 'none',
        border: '1px solid rgba(192,132,252,0.3)',
        borderRadius: 8,
        color: '#7a5a9a',
        fontSize: 11,
        fontWeight: 600,
        padding: '5px 12px',
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'all 0.15s',
        ...style,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = '#c084fc'
        ;(e.currentTarget as HTMLButtonElement).style.color = '#c084fc'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(192,132,252,0.3)'
        ;(e.currentTarget as HTMLButtonElement).style.color = '#7a5a9a'
      }}
    >
      Sign out
    </button>
  )
}
