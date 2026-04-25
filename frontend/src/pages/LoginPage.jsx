import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

/* ── Floating 3-D shape component ──────────────────────────── */
function FloatShape({ style, className }) {
  return <div className={`absolute rounded-full pointer-events-none ${className}`} style={style} />;
}

export default function LoginPage() {
  const { user, login, verifyPin } = useAuth();

  // Step: 'credentials' | 'pin'
  const [step,      setStep]      = useState('credentials');
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [pin,       setPin]       = useState('');
  const [tempToken, setTempToken] = useState('');
  const [userName,  setUserName]  = useState('');
  const [loading,   setLoading]   = useState(false);
  const [showPass,  setShowPass]  = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  /* Step 1 ─ email + password */
  async function handleCredentials(e) {
    e.preventDefault();
    if (!email || !password) { toast.error('Please fill all fields'); return; }
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.requiresPin) {
        setTempToken(result.tempToken);
        setUserName(result.userName);
        setStep('pin');
        toast.success(`Welcome, ${result.userName}! Enter your Green PIN.`);
      } else {
        toast.success('Welcome back!');
      }
    } catch {
      // handled by axios interceptor
    } finally {
      setLoading(false);
    }
  }

  /* Step 2 ─ Green PIN */
  async function handlePin(e) {
    e.preventDefault();
    if (!pin || pin.length !== 6) { toast.error('Enter your 6-digit Green PIN'); return; }
    setLoading(true);
    try {
      await verifyPin(tempToken, pin);
      toast.success('Verified! Welcome back 🔐');
    } catch {
      // handled by interceptor
    } finally {
      setLoading(false);
    }
  }

  /* Auto-tab PIN digits */
  function handlePinInput(e) {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setPin(val);
  }

  return (
    <div className="relative min-h-screen overflow-hidden flex items-center justify-center p-4"
         style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 40%, #0c4a6e 100%)' }}>

      {/* ── Animated 3D floating shapes ─────────────────────── */}
      <style>{`
        @keyframes floatA {
          0%,100% { transform: translateY(0px) rotate(0deg) scale(1); }
          33%      { transform: translateY(-30px) rotate(120deg) scale(1.05); }
          66%      { transform: translateY(15px) rotate(240deg) scale(0.95); }
        }
        @keyframes floatB {
          0%,100% { transform: translateY(0px) rotate(0deg); }
          50%      { transform: translateY(-45px) rotate(180deg); }
        }
        @keyframes floatC {
          0%,100% { transform: translate(0,0) scale(1); }
          25%      { transform: translate(20px,-20px) scale(1.1); }
          75%      { transform: translate(-15px,25px) scale(0.9); }
        }
        @keyframes pulse3d {
          0%,100% { opacity: 0.15; transform: scale(1); }
          50%      { opacity: 0.3; transform: scale(1.08); }
        }
        @keyframes shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        .glass-card {
          background: rgba(255,255,255,0.08);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.15);
          box-shadow: 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1);
        }
        .glass-input {
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.15);
          color: #f1f5f9;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .glass-input::placeholder { color: rgba(255,255,255,0.35); }
        .glass-input:focus {
          outline: none;
          border-color: rgba(99,179,237,0.6);
          box-shadow: 0 0 0 3px rgba(99,179,237,0.15);
          background: rgba(255,255,255,0.12);
        }
        .pin-btn {
          background: linear-gradient(135deg, #22c55e, #16a34a);
          box-shadow: 0 4px 20px rgba(34,197,94,0.35), 0 0 0 1px rgba(34,197,94,0.2);
          transition: all 0.2s;
        }
        .pin-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 24px rgba(34,197,94,0.45);
        }
        .login-btn {
          background: linear-gradient(135deg, #0ea5e9, #0284c7);
          box-shadow: 0 4px 20px rgba(14,165,233,0.35);
          transition: all 0.2s;
        }
        .login-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 24px rgba(14,165,233,0.45);
        }
        .pin-digit-display {
          letter-spacing: 0.5em;
          font-size: 1.8rem;
          font-family: monospace;
        }
      `}</style>

      {/* Large blurred orbs */}
      <div style={{ position:'absolute', top:'-10%', left:'-5%', width:'500px', height:'500px',
                    background:'radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%)',
                    animation:'floatA 8s ease-in-out infinite', borderRadius:'50%' }} />
      <div style={{ position:'absolute', bottom:'-15%', right:'-5%', width:'600px', height:'600px',
                    background:'radial-gradient(circle, rgba(14,165,233,0.25) 0%, transparent 70%)',
                    animation:'floatB 11s ease-in-out infinite', borderRadius:'50%' }} />
      <div style={{ position:'absolute', top:'40%', left:'60%', width:'350px', height:'350px',
                    background:'radial-gradient(circle, rgba(168,85,247,0.2) 0%, transparent 70%)',
                    animation:'floatC 9s ease-in-out infinite', borderRadius:'50%' }} />

      {/* Geometric floating shapes */}
      {[
        { size:60, top:'8%',  left:'12%', bg:'rgba(99,179,237,0.15)',  delay:'0s',   dur:'6s',  border:'1px solid rgba(99,179,237,0.3)',  anim:'floatA' },
        { size:40, top:'75%', left:'8%',  bg:'rgba(167,139,250,0.15)', delay:'2s',   dur:'8s',  border:'1px solid rgba(167,139,250,0.3)', anim:'floatB' },
        { size:80, top:'15%', left:'82%', bg:'rgba(52,211,153,0.1)',   delay:'1s',   dur:'7s',  border:'1px solid rgba(52,211,153,0.25)', anim:'floatC' },
        { size:30, top:'60%', left:'88%', bg:'rgba(251,191,36,0.12)',  delay:'3s',   dur:'5s',  border:'1px solid rgba(251,191,36,0.25)', anim:'floatA' },
        { size:50, top:'85%', left:'55%', bg:'rgba(244,114,182,0.1)',  delay:'1.5s', dur:'9s',  border:'1px solid rgba(244,114,182,0.2)', anim:'floatB' },
        { size:25, top:'30%', left:'5%',  bg:'rgba(34,211,238,0.12)',  delay:'4s',   dur:'6.5s',border:'1px solid rgba(34,211,238,0.3)', anim:'floatC' },
      ].map((s,i) => (
        <div key={i} style={{
          position:'absolute', top:s.top, left:s.left,
          width:s.size, height:s.size, borderRadius:'30%',
          background:s.bg, border:s.border,
          animation:`${s.anim} ${s.dur} ${s.delay} ease-in-out infinite`,
          backdropFilter:'blur(4px)',
        }} />
      ))}

      {/* ── Main card ─────────────────────────────────────────── */}
      <div className="w-full max-w-md relative z-10">

        {/* Brand */}
        <div className="text-center mb-8">
          <div style={{
            display:'inline-flex', alignItems:'center', justifyContent:'center',
            width:72, height:72, borderRadius:20, marginBottom:16,
            background:'linear-gradient(135deg, #0ea5e9, #6366f1)',
            boxShadow:'0 8px 32px rgba(14,165,233,0.4), 0 0 0 1px rgba(255,255,255,0.1)',
          }}>
            <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 style={{ color:'#f1f5f9', fontSize:28, fontWeight:800, margin:0, letterSpacing:'-0.5px' }}>
            Wizone LMS
          </h1>
          <p style={{ color:'rgba(255,255,255,0.5)', fontSize:14, marginTop:4 }}>
            AI-Powered Lead Management
          </p>
        </div>

        {/* Glass card */}
        <div className="glass-card rounded-3xl p-8">

          {step === 'credentials' ? (
            <>
              <div className="mb-6">
                <h2 style={{ color:'#f1f5f9', fontSize:20, fontWeight:700, margin:0 }}>Sign In</h2>
                <p style={{ color:'rgba(255,255,255,0.45)', fontSize:13, marginTop:4 }}>
                  Enter your credentials to continue
                </p>
              </div>

              <form onSubmit={handleCredentials} className="space-y-4">
                <div>
                  <label style={{ display:'block', color:'rgba(255,255,255,0.7)', fontSize:13,
                                  fontWeight:600, marginBottom:6 }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    className="glass-input w-full rounded-xl px-4 py-3 text-sm"
                    placeholder="admin@wizone.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label style={{ display:'block', color:'rgba(255,255,255,0.7)', fontSize:13,
                                  fontWeight:600, marginBottom:6 }}>
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      className="glass-input w-full rounded-xl px-4 py-3 pr-11 text-sm"
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(s => !s)}
                      style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)',
                               color:'rgba(255,255,255,0.4)', background:'none', border:'none', cursor:'pointer' }}>
                      {showPass ? (
                        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                        </svg>
                      ) : (
                        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="login-btn w-full text-white font-bold py-3 rounded-xl mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={loading}
                  style={{ fontSize:15 }}>
                  {loading ? (
                    <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" style={{ animation:'spin 1s linear infinite' }}>
                        <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="4" opacity="0.25" />
                        <path fill="white" opacity="0.75" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Signing in…
                    </span>
                  ) : 'Sign In →'}
                </button>
              </form>
            </>
          ) : (
            /* ── PIN step ──────────────────────────────────── */
            <>
              <div className="text-center mb-6">
                {/* Green shield icon */}
                <div style={{
                  display:'inline-flex', alignItems:'center', justifyContent:'center',
                  width:64, height:64, borderRadius:20, marginBottom:12,
                  background:'linear-gradient(135deg, #22c55e, #16a34a)',
                  boxShadow:'0 6px 24px rgba(34,197,94,0.4)',
                }}>
                  <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h2 style={{ color:'#f1f5f9', fontSize:20, fontWeight:700, margin:0 }}>
                  Green PIN Verification
                </h2>
                <p style={{ color:'rgba(255,255,255,0.5)', fontSize:13, marginTop:6 }}>
                  Hi <strong style={{ color:'#4ade80' }}>{userName}</strong>! Enter your 6-digit Green PIN to continue.
                </p>
              </div>

              <form onSubmit={handlePin} className="space-y-5">
                <div>
                  <label style={{ display:'block', color:'rgba(255,255,255,0.7)', fontSize:13,
                                  fontWeight:600, marginBottom:8, textAlign:'center' }}>
                    6-Digit Security PIN
                  </label>

                  {/* Large PIN display */}
                  <div style={{
                    background:'rgba(0,0,0,0.25)', border:'1px solid rgba(34,197,94,0.3)',
                    borderRadius:16, padding:'20px 24px', textAlign:'center', position:'relative',
                  }}>
                    <input
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      className="pin-digit-display"
                      style={{
                        background:'transparent', border:'none', outline:'none',
                        color:'#4ade80', width:'100%', textAlign:'center',
                        caretColor:'#4ade80',
                      }}
                      placeholder="• • • • • •"
                      value={pin}
                      onChange={handlePinInput}
                      autoFocus
                    />
                    {/* PIN strength dots */}
                    <div style={{ display:'flex', justifyContent:'center', gap:8, marginTop:8 }}>
                      {[0,1,2,3,4,5].map(i => (
                        <div key={i} style={{
                          width:8, height:8, borderRadius:'50%',
                          background: i < pin.length ? '#4ade80' : 'rgba(255,255,255,0.15)',
                          transition:'background 0.15s',
                          boxShadow: i < pin.length ? '0 0 6px rgba(74,222,128,0.6)' : 'none',
                        }} />
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="pin-btn w-full text-white font-bold py-3 rounded-xl disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={loading || pin.length !== 6}
                  style={{ fontSize:15 }}>
                  {loading ? (
                    <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" style={{ animation:'spin 1s linear infinite' }}>
                        <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="4" opacity="0.25" />
                        <path fill="white" opacity="0.75" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Verifying…
                    </span>
                  ) : '🔐 Verify PIN'}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep('credentials'); setPin(''); }}
                  style={{
                    width:'100%', background:'none', border:'none', cursor:'pointer',
                    color:'rgba(255,255,255,0.4)', fontSize:13, marginTop:4,
                  }}>
                  ← Back to login
                </button>
              </form>
            </>
          )}

          <p style={{ textAlign:'center', color:'rgba(255,255,255,0.25)', fontSize:11, marginTop:24 }}>
            Protected by Wizone Security • 2FA Enabled
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
