'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError]       = useState('')
  const [showPw, setShowPw]     = useState(false)

  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(d => {
      if (d.ok) router.replace('/')
      else setChecking(false)
    })
  }, [router])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setError(data.error || 'Invalid username or password')
      } else {
        router.replace('/')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (checking) return (
    <div style={styles.root}>
      <div style={styles.spinner} />
    </div>
  )

  return (
    <div style={styles.root}>
      {/* background blobs */}
      <div style={{ ...styles.blob, top: -100, left: -80, width: 380, height: 380, background: 'radial-gradient(circle, #f472b640 0%, transparent 70%)' }} />
      <div style={{ ...styles.blob, bottom: -80, right: -60, width: 320, height: 320, background: 'radial-gradient(circle, #c084fc40 0%, transparent 70%)' }} />

      <div style={styles.card}>
        {/* logo / brand */}
        <div style={styles.brand}>
          <div style={styles.brandIcon}>🔑</div>
          <div>
            <div style={styles.brandTitle}>Keychain Maker</div>
            <div style={styles.brandSub}>Design Studio</div>
          </div>
        </div>

        <div style={styles.divider} />

        <h1 style={styles.heading}>Welcome back</h1>
        <p style={styles.subheading}>Enter your credentials to continue</p>

        <form onSubmit={handleLogin} style={styles.form}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="your_username"
              required
              autoComplete="username"
              style={styles.input}
              onFocus={e => (e.target.style.borderColor = '#c084fc')}
              onBlur={e  => (e.target.style.borderColor = '#2e1f42')}
            />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                style={{ ...styles.input, paddingRight: 44 }}
                onFocus={e => (e.target.style.borderColor = '#c084fc')}
                onBlur={e  => (e.target.style.borderColor = '#2e1f42')}
              />
              <button
                type="button"
                onClick={() => setShowPw(p => !p)}
                style={styles.eyeBtn}
                tabIndex={-1}
              >
                {showPw ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {error && (
            <div style={styles.errorBox}>
              <span>⚠️</span> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            style={{
              ...styles.submitBtn,
              opacity: loading || !username || !password ? 0.55 : 1,
              cursor:  loading || !username || !password ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span style={styles.btnSpinner} /> Signing in…
              </span>
            ) : 'Sign In'}
          </button>
        </form>

        <p style={styles.footer}>Contact your administrator for access.</p>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0f0a1a; }
        input:-webkit-autofill {
          -webkit-box-shadow: 0 0 0 1000px #1a1028 inset !important;
          -webkit-text-fill-color: #ead6f8 !important;
          caret-color: #ead6f8;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0f0a1a',
    fontFamily: "'Montserrat', sans-serif",
    position: 'relative',
    overflow: 'hidden',
    padding: 16,
  },
  blob: {
    position: 'absolute',
    borderRadius: '50%',
    pointerEvents: 'none',
    filter: 'blur(40px)',
  },
  card: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    maxWidth: 400,
    background: 'rgba(26, 16, 40, 0.85)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1.5px solid #2e1f42',
    borderRadius: 20,
    padding: '32px 28px 28px',
    boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(192,132,252,0.08)',
    animation: 'fadeUp 0.35s ease both',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  brandIcon: {
    fontSize: 28,
    width: 48,
    height: 48,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #f472b620, #c084fc20)',
    border: '1.5px solid #3a2050',
    borderRadius: 12,
  },
  brandTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: '#ead6f8',
    letterSpacing: '-0.01em',
  },
  brandSub: {
    fontSize: 11,
    color: '#7a5a9a',
    marginTop: 1,
  },
  divider: {
    height: 1,
    background: 'linear-gradient(90deg, transparent, #2e1f42, transparent)',
    marginBottom: 20,
  },
  heading: {
    fontSize: 22,
    fontWeight: 700,
    color: '#ead6f8',
    letterSpacing: '-0.02em',
    marginBottom: 4,
  },
  subheading: {
    fontSize: 12,
    color: '#7a5a9a',
    marginBottom: 24,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#7a5a9a',
  },
  input: {
    width: '100%',
    padding: '11px 14px',
    background: '#1a1028',
    border: '1.5px solid #2e1f42',
    borderRadius: 12,
    color: '#ead6f8',
    fontSize: 14,
    fontFamily: "'Montserrat', sans-serif",
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  eyeBtn: {
    position: 'absolute',
    right: 10,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    padding: 4,
    lineHeight: 1,
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 14px',
    background: 'rgba(239,68,68,0.12)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 10,
    color: '#fca5a5',
    fontSize: 12,
  },
  submitBtn: {
    width: '100%',
    padding: '13px 0',
    background: 'linear-gradient(135deg, #f472b6, #c084fc)',
    border: 'none',
    borderRadius: 12,
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    fontFamily: "'Montserrat', sans-serif",
    letterSpacing: '0.02em',
    transition: 'all 0.2s',
    boxShadow: '0 4px 20px rgba(192,132,252,0.3)',
    marginTop: 4,
  },
  footer: {
    marginTop: 20,
    textAlign: 'center',
    fontSize: 11,
    color: '#4a3060',
  },
  spinner: {
    width: 28,
    height: 28,
    border: '3px solid #2e1f42',
    borderTopColor: '#c084fc',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
  btnSpinner: {
    display: 'inline-block',
    width: 14,
    height: 14,
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
}
