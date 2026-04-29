import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { user, login, verifyPin } = useAuth();

  const [step,      setStep]      = useState('credentials');
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [pin,       setPin]       = useState('');
  const [tempToken, setTempToken] = useState('');
  const [userName,  setUserName]  = useState('');
  const [loading,   setLoading]   = useState(false);
  const [showPass,  setShowPass]  = useState(false);
  const [pinExpiry, setPinExpiry] = useState(null);
  const [pinSecsLeft, setPinSecsLeft] = useState(null);

  useEffect(() => {
    if (step !== 'pin' || !pinExpiry) { setPinSecsLeft(null); return; }
    const tick = () => {
      const secs = Math.max(0, Math.round((pinExpiry - Date.now()) / 1000));
      setPinSecsLeft(secs);
      if (secs === 0) {
        setStep('credentials'); setPin(''); setTempToken('');
        toast.error('Session expired. Please sign in again.');
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [step, pinExpiry]);

  if (user) return <Navigate to="/dashboard" replace />;

  async function handleCredentials(e) {
    e.preventDefault();
    if (!email || !password) { toast.error('Please fill all fields'); return; }
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.requiresPin) {
        setTempToken(result.tempToken);
        setUserName(result.userName);
        setPinExpiry(Date.now() + 15 * 60 * 1000);
        setStep('pin');
        toast.success(`Welcome, ${result.userName}! Enter your Green PIN.`);
      } else {
        toast.success('Welcome back!');
      }
    } catch { /* handled by axios interceptor */ }
    finally { setLoading(false); }
  }

  async function handlePin(e) {
    e.preventDefault();
    if (!pin || pin.length !== 6) { toast.error('Enter your 6-digit Green PIN'); return; }
    setLoading(true);
    try {
      await verifyPin(tempToken, pin);
      toast.success('Verified! Welcome back 🔐');
    } catch (err) {
      const msg = err?.response?.data?.error || '';
      if (msg.toLowerCase().includes('session') || msg.toLowerCase().includes('expired')) {
        setStep('credentials'); setPin(''); setTempToken('');
      } else {
        setPin('');
      }
    } finally { setLoading(false); }
  }

  function handlePinInput(e) {
    setPin(e.target.value.replace(/\D/g, '').slice(0, 6));
  }

  return (
    <div style={{
      margin: 0, minHeight: '100vh', fontFamily: '"Manrope","Segoe UI",sans-serif',
      color: '#f2f7ff', overflow: 'hidden',
      background: 'radial-gradient(circle at 20% 20%,rgba(38,184,224,.1),transparent 18%),radial-gradient(circle at 80% 40%,rgba(38,184,224,.08),transparent 18%),linear-gradient(180deg,#081126 0%,#050d1d 100%)',
    }}>

      {/* Glow overlay */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(circle at 22% 35%,rgba(54,222,245,.1),transparent 16%),radial-gradient(circle at 78% 62%,rgba(54,222,245,.1),transparent 16%)',
        filter: 'blur(30px)',
      }} />

      <style>{`
        @import url("https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap");
        @keyframes traceLine{0%{stroke-dashoffset:380;opacity:.22}20%{opacity:.9}55%{stroke-dashoffset:0;opacity:1}100%{stroke-dashoffset:-380;opacity:.2}}
        @keyframes processPulse{0%,100%{opacity:.52;transform:scale(1)}50%{opacity:.95;transform:scale(1.04)}}
        @keyframes textBlink{0%,100%{opacity:.4}50%{opacity:.9}}
        @keyframes signalMove{0%{opacity:0}10%{opacity:1}80%{opacity:1}100%{opacity:0}}
        @keyframes pulseNode{0%,100%{opacity:.62;transform:scale(1)}50%{opacity:.95;transform:scale(1.28)}}
        @keyframes nodeSpark{0%,100%{opacity:.82}50%{opacity:1}}
        @keyframes floatGlow{0%,100%{opacity:.22;transform:translate3d(0,0,0) scale(1)}50%{opacity:.42;transform:translate3d(0,-12px,0) scale(1.1)}}
        @keyframes cardFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @keyframes logoFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
        @keyframes logoPulse{0%,100%{transform:scale(1);filter:drop-shadow(0 10px 18px rgba(0,0,0,.18))}50%{transform:scale(1.015);filter:drop-shadow(0 14px 24px rgba(0,0,0,.2)) drop-shadow(0 0 16px rgba(15,230,255,.18))}}
        @keyframes logoAura{0%,100%{opacity:.45;transform:scale(.98)}50%{opacity:.82;transform:scale(1.03)}}
        @keyframes logoShine{0%,100%{left:-35%;opacity:0}18%{opacity:0}42%{opacity:1}60%{left:120%;opacity:0}}
        @keyframes borderAura{0%,100%{opacity:.45;transform:scale(1)}50%{opacity:.78;transform:scale(1.01)}}
        @keyframes buttonSweep{0%,100%{transform:translateX(-130%)}45%,60%{transform:translateX(130%)}}
        @keyframes footerGlow{0%,100%{opacity:.72}50%{opacity:1;text-shadow:0 0 14px rgba(54,222,245,.18)}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        .lms-input{width:100%;height:62px;border:1px solid rgba(158,174,211,.22);border-radius:16px;background:rgba(255,255,255,.07);color:#f2f7ff;padding:0 52px;font-size:1rem;font-family:"Manrope","Segoe UI",sans-serif;outline:none;resize:none;transition:border-color .25s,box-shadow .25s,background .25s,transform .25s}
        .lms-input::placeholder{color:#7887a2}
        .lms-input:focus{border-color:rgba(54,222,245,.7);box-shadow:0 0 0 4px rgba(54,222,245,.12);background:rgba(255,255,255,.09);transform:translateY(-1px)}
        .lms-btn{width:100%;height:68px;border:0;border-radius:16px;cursor:pointer;font-size:1.15rem;font-weight:800;letter-spacing:.02em;color:#07213a;background:linear-gradient(90deg,#3fe4f7,#36ccec);box-shadow:0 10px 24px rgba(31,211,239,.32);transition:transform .2s,box-shadow .2s,filter .2s;position:relative;overflow:hidden;font-family:"Manrope","Segoe UI",sans-serif}
        .lms-btn::before{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 20%,rgba(255,255,255,.3) 42%,transparent 58%);transform:translateX(-130%);animation:buttonSweep 4.8s ease-in-out infinite}
        .lms-btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 16px 30px rgba(31,211,239,.38);filter:brightness(1.02)}
        .lms-btn:disabled{opacity:.6;cursor:not-allowed}
        .lms-card{position:relative;padding:34px 36px 28px;border-radius:28px;background:linear-gradient(180deg,rgba(31,37,57,.94),rgba(20,24,41,.96));border:2px solid rgba(58,224,247,.8);box-shadow:0 0 0 1px rgba(54,222,245,.26),0 0 28px rgba(54,222,245,.32),0 0 75px rgba(54,222,245,.18);backdrop-filter:blur(18px);animation:cardFloat 6s ease-in-out infinite}
        .lms-card::before{content:"";position:absolute;inset:14px;border-radius:22px;border:1px solid rgba(255,255,255,.04);pointer-events:none}
        .lms-card::after{content:"";position:absolute;inset:-2px;border-radius:28px;background:linear-gradient(135deg,rgba(54,222,245,.28),transparent 28%,transparent 72%,rgba(54,222,245,.22));opacity:.55;filter:blur(18px);z-index:-1;animation:borderAura 5s ease-in-out infinite}
        .pin-input{background:transparent;border:none;outline:none;color:#4ade80;width:100%;text-align:center;caret-color:#4ade80;letter-spacing:.5em;font-size:1.8rem;font-family:monospace}
        .pin-btn{width:100%;height:64px;border:0;border-radius:16px;cursor:pointer;font-size:1.1rem;font-weight:800;color:#fff;background:linear-gradient(135deg,#22c55e,#16a34a);box-shadow:0 4px 20px rgba(34,197,94,.35),0 0 0 1px rgba(34,197,94,.2);transition:transform .2s,box-shadow .2s;font-family:"Manrope","Segoe UI",sans-serif}
        .pin-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 6px 24px rgba(34,197,94,.45)}
        .pin-btn:disabled{opacity:.6;cursor:not-allowed}
      `}</style>

      {/* ── Animated SVG Network Background ── */}
      <svg style={{ position:'fixed', inset:0, width:'100%', height:'100%', zIndex:0, opacity:.62, overflow:'visible', pointerEvents:'none' }}
           viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path stroke="rgba(34,95,168,.2)" strokeWidth="6" filter="drop-shadow(0 0 8px rgba(54,222,245,.08))" d="M90 230H235L310 300H420L500 220H620" />
          <path stroke="rgba(34,95,168,.2)" strokeWidth="6" d="M1010 260H1130L1210 330H1360L1450 270H1540" />
          <path stroke="rgba(34,95,168,.2)" strokeWidth="6" d="M120 700H290L390 600H520L610 675H720" />
          <path stroke="rgba(34,95,168,.2)" strokeWidth="6" d="M920 760H1060L1160 680H1310L1400 740H1520" />
          <path stroke="rgba(15,230,255,.28)" strokeWidth="2.5" filter="drop-shadow(0 0 10px rgba(15,230,255,.22))" d="M90 230H235L310 300H420L500 220H620" />
          <path stroke="rgba(15,230,255,.28)" strokeWidth="2.5" d="M1010 260H1130L1210 330H1360L1450 270H1540" />
          <path stroke="rgba(15,230,255,.28)" strokeWidth="2.5" d="M120 700H290L390 600H520L610 675H720" />
          <path stroke="rgba(15,230,255,.28)" strokeWidth="2.5" d="M920 760H1060L1160 680H1310L1400 740H1520" />
          {[
            {d:"M90 230H235L310 300H420L500 220H620", delay:'0s'},
            {d:"M1010 260H1130L1210 330H1360L1450 270H1540", delay:'1.2s'},
            {d:"M120 700H290L390 600H520L610 675H720", delay:'2.4s'},
            {d:"M920 760H1060L1160 680H1310L1400 740H1520", delay:'3.6s'},
          ].map((p,i) => (
            <path key={i} stroke="#0fe6ff" strokeWidth="6" strokeDasharray="380" strokeDashoffset="380"
              filter="drop-shadow(0 0 8px rgba(15,230,255,.9)) drop-shadow(0 0 18px rgba(15,230,255,.45))"
              style={{animation:`traceLine 4.8s ${p.delay} linear infinite`}} d={p.d} />
          ))}
        </g>
        <g>
          {[
            {x:210,y:188,w:120,h:84,label:'DATA',cx:270,cy:238,delay:'0s'},
            {x:488,y:176,w:146,h:88,label:'FLOW',cx:561,cy:230,delay:'.8s'},
            {x:1120,y:218,w:150,h:88,label:'TASK',cx:1195,cy:272,delay:'1.6s'},
            {x:360,y:560,w:162,h:88,label:'BOT',cx:441,cy:614,delay:'2.4s'},
            {x:1135,y:640,w:174,h:88,label:'SYNC',cx:1222,cy:694,delay:'.8s'},
          ].map((b,i) => (
            <g key={i}>
              <rect rx="18" ry="18" x={b.x} y={b.y} width={b.w} height={b.h}
                fill="rgba(11,26,51,.7)" stroke="rgba(60,220,246,.38)" strokeWidth="2"
                filter="drop-shadow(0 0 16px rgba(54,222,245,.15))"
                style={{animation:`processPulse 4.2s ${b.delay} ease-in-out infinite`}} />
              <text x={b.cx} y={b.cy} textAnchor="middle"
                fill="rgba(175,226,242,.7)" fontSize="22" fontWeight="700" letterSpacing=".08em"
                style={{textTransform:'uppercase', animation:`textBlink 4.2s ${b.delay} ease-in-out infinite`}}>
                {b.label}
              </text>
            </g>
          ))}
        </g>
        <g fill="rgba(56,225,247,.68)">
          {[[90,230],[420,300],[620,220],[1010,260],[1360,330],[1540,270],[120,700],[520,600],[720,675],[920,760],[1310,680],[1520,740]].map(([cx,cy],i) => (
            <circle key={i} cx={cx} cy={cy} r={i%3===1?18:16}
              style={{transformBox:'fill-box',transformOrigin:'center',
                filter:'drop-shadow(0 0 10px rgba(184,255,255,.95)) drop-shadow(0 0 24px rgba(15,230,255,.48))',
                animation:`pulseNode 2.8s ${(i*.8)%2.4}s ease-in-out infinite`}} />
          ))}
        </g>
        <g fill="#dfffff">
          {[[90,230,4],[420,300,4.5],[620,220,4],[1010,260,4],[1360,330,4.5],[1540,270,4],[120,700,4],[520,600,4.5],[720,675,4],[920,760,4],[1310,680,4.5],[1520,740,4]].map(([cx,cy,r],i) => (
            <circle key={i} cx={cx} cy={cy} r={r} style={{animation:`nodeSpark 2.8s ${(i*.4)%1.6}s ease-in-out infinite`}} />
          ))}
        </g>
        {[
          {cx:90,cy:230,path:"M90 230H235L310 300H420L500 220H620",delay:'0s'},
          {cx:1010,cy:260,path:"M1010 260H1130L1210 330H1360L1450 270H1540",delay:'1.5s'},
          {cx:120,cy:700,path:"M120 700H290L390 600H520L610 675H720",delay:'3s'},
          {cx:920,cy:760,path:"M920 760H1060L1160 680H1310L1400 740H1520",delay:'0s'},
        ].map((s,i) => (
          <circle key={i} cx={s.cx} cy={s.cy} r="6" fill="#d8ffff"
            filter="drop-shadow(0 0 8px rgba(216,255,255,1)) drop-shadow(0 0 20px rgba(15,230,255,.72))"
            style={{animation:`signalMove 6s ${s.delay} linear infinite`}}>
            <animateMotion dur="6s" repeatCount="indefinite" path={s.path} />
          </circle>
        ))}
        <g fill="rgba(41,202,240,.16)">
          {[[220,220,185,'0s'],[1320,300,165,'1.4s'],[1210,720,140,'2.8s'],[430,620,150,'1.4s']].map(([cx,cy,r,d],i) => (
            <circle key={i} cx={cx} cy={cy} r={r} style={{animation:`floatGlow 5.8s ${d} ease-in-out infinite`}} />
          ))}
        </g>
      </svg>

      {/* ── Page layout ── */}
      <div style={{ position:'relative', minHeight:'100vh', display:'grid', placeItems:'center', padding:'32px 18px', isolation:'isolate', zIndex:1 }}>
        <div style={{ width:'min(100%, 620px)' }}>

          {/* Card */}
          <section className="lms-card">

            {/* Logo */}
            <div style={{ margin:'0 auto 18px', width:'min(100%,440px)', display:'grid', placeItems:'center', animation:'logoFloat 4.8s ease-in-out infinite' }}>
              <div style={{ width:'100%', padding:'6px 2px 10px', display:'grid', placeItems:'center', borderRadius:16, position:'relative', overflow:'hidden' }}>
                <div style={{ position:'absolute', inset:'8% 10%', borderRadius:22, background:'radial-gradient(circle,rgba(42,224,247,.18),transparent 70%)', filter:'blur(18px)', opacity:.7, animation:'logoAura 4.8s ease-in-out infinite', pointerEvents:'none' }} />
                <img
                  src="https://wizone.ai/assets/WIZONE%20AI%20LABS%20LOGO.png"
                  alt="Wizone AI Labs"
                  style={{ width:'96%', height:'auto', display:'block', filter:'drop-shadow(0 10px 18px rgba(0,0,0,.18))', userSelect:'none', pointerEvents:'none', animation:'logoPulse 4.8s ease-in-out infinite' }}
                  onError={e => { e.target.style.display='none'; }}
                />
              </div>
            </div>

            <p style={{ margin:'-4px 0 20px', textAlign:'right', color:'#fff', fontSize:'1rem', fontWeight:800, letterSpacing:'.08em' }}>
              LMS PORTAL
            </p>

            {step === 'credentials' ? (
              /* ── Step 1: Email + Password ── */
              <form onSubmit={handleCredentials}>
                <div style={{ marginBottom:18 }}>
                  <label htmlFor="lms-email" style={{ display:'block', marginBottom:10, fontSize:'1rem', color:'rgba(240,245,255,.82)' }}>
                    Username or Email
                  </label>
                  <div style={{ position:'relative' }}>
                    <svg style={{ position:'absolute', left:16, top:'50%', transform:'translateY(-50%)', width:22, height:22, stroke:'#28d6f0', opacity:.95 }} viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/><path d="M4 20a8 8 0 0 1 16 0"/>
                    </svg>
                    <input id="lms-email" type="email" className="lms-input" placeholder="Enter your email"
                      value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
                  </div>
                </div>

                <div style={{ marginBottom:10 }}>
                  <label htmlFor="lms-pass" style={{ display:'block', marginBottom:10, fontSize:'1rem', color:'rgba(240,245,255,.82)' }}>
                    Password
                  </label>
                  <div style={{ position:'relative' }}>
                    <svg style={{ position:'absolute', left:16, top:'50%', transform:'translateY(-50%)', width:22, height:22, stroke:'#28d6f0', opacity:.95 }} viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                      <path d="M7 11V8a5 5 0 0 1 10 0v3"/><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M12 15v2"/>
                    </svg>
                    <input id="lms-pass" type={showPass ? 'text' : 'password'} className="lms-input"
                      placeholder="Enter your password"
                      value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
                    <button type="button" onClick={() => setShowPass(s => !s)}
                      style={{ position:'absolute', right:16, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', padding:0 }}>
                      {showPass ? (
                        <svg style={{ width:22, height:22, stroke:'#28d6f0', opacity:.85 }} viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                          <path d="M3 3l18 18"/><path d="M10.7 6.3A10.9 10.9 0 0 1 12 6c5.5 0 9.5 6 9.5 6a17.2 17.2 0 0 1-3.1 3.8"/><path d="M6.6 6.7A17.8 17.8 0 0 0 2.5 12S6.5 18 12 18a9.6 9.6 0 0 0 4-.8"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>
                        </svg>
                      ) : (
                        <svg style={{ width:22, height:22, stroke:'#28d6f0', opacity:.85 }} viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div style={{ margin:'10px 0 24px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, flexWrap:'wrap' }}>
                  <label style={{ display:'inline-flex', alignItems:'center', gap:10, color:'#d8e2f4', fontSize:'.98rem', cursor:'pointer' }}>
                    <input type="checkbox" style={{ width:18, height:18, margin:0, padding:0, accentColor:'#30daf4' }} />
                    <span>Remember Me</span>
                  </label>
                  <a href="#" style={{ color:'#31d8f3', textDecoration:'none', fontWeight:600, fontSize:'.95rem' }}>Forgot Password?</a>
                </div>

                <button type="submit" className="lms-btn" disabled={loading}>
                  {loading ? (
                    <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" style={{ animation:'spin 1s linear infinite' }}>
                        <circle cx="12" cy="12" r="10" stroke="#07213a" strokeWidth="4" opacity=".25"/>
                        <path fill="#07213a" opacity=".75" d="M4 12a8 8 0 018-8v8H4z"/>
                      </svg>
                      Signing in…
                    </span>
                  ) : 'SIGN IN'}
                </button>
              </form>

            ) : (
              /* ── Step 2: Green PIN ── */
              <>
                <div style={{ textAlign:'center', marginBottom:24 }}>
                  <div style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:64, height:64, borderRadius:20, marginBottom:12, background:'linear-gradient(135deg,#22c55e,#16a34a)', boxShadow:'0 6px 24px rgba(34,197,94,.4)' }}>
                    <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                    </svg>
                  </div>
                  <h2 style={{ color:'#f1f5f9', fontSize:20, fontWeight:700, margin:0 }}>Green PIN Verification</h2>
                  <p style={{ color:'rgba(255,255,255,.5)', fontSize:13, marginTop:6 }}>
                    Hi <strong style={{ color:'#4ade80' }}>{userName}</strong>! Enter your 6-digit Green PIN to continue.
                  </p>
                  {pinSecsLeft !== null && (
                    <div style={{ display:'inline-flex', alignItems:'center', gap:6, marginTop:8, padding:'4px 12px', borderRadius:20, background: pinSecsLeft < 60 ? 'rgba(239,68,68,.15)' : 'rgba(34,197,94,.12)', border:`1px solid ${pinSecsLeft < 60 ? 'rgba(239,68,68,.3)' : 'rgba(34,197,94,.25)'}` }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={pinSecsLeft < 60 ? '#f87171' : '#4ade80'} strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/><path strokeLinecap="round" d="M12 6v6l4 2"/>
                      </svg>
                      <span style={{ fontSize:11, fontWeight:700, fontFamily:'monospace', color: pinSecsLeft < 60 ? '#f87171' : '#4ade80' }}>
                        {Math.floor(pinSecsLeft/60)}:{String(pinSecsLeft%60).padStart(2,'0')} remaining
                      </span>
                    </div>
                  )}
                </div>

                <form onSubmit={handlePin}>
                  <div style={{ marginBottom:20 }}>
                    <label style={{ display:'block', color:'rgba(240,245,255,.82)', fontSize:'1rem', marginBottom:10, textAlign:'center' }}>
                      6-Digit Security PIN
                    </label>
                    <div style={{ background:'rgba(0,0,0,.25)', border:'1px solid rgba(34,197,94,.3)', borderRadius:16, padding:'20px 24px', textAlign:'center' }}>
                      <input type="password" inputMode="numeric" pattern="[0-9]*" maxLength={6}
                        className="pin-input" placeholder="• • • • • •"
                        value={pin} onChange={handlePinInput} autoFocus />
                      <div style={{ display:'flex', justifyContent:'center', gap:8, marginTop:8 }}>
                        {[0,1,2,3,4,5].map(i => (
                          <div key={i} style={{ width:8, height:8, borderRadius:'50%', transition:'background .15s', background: i < pin.length ? '#4ade80' : 'rgba(255,255,255,.15)', boxShadow: i < pin.length ? '0 0 6px rgba(74,222,128,.6)' : 'none' }} />
                        ))}
                      </div>
                    </div>
                  </div>

                  <button type="submit" className="pin-btn" disabled={loading || pin.length !== 6} style={{ marginBottom:12 }}>
                    {loading ? (
                      <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" style={{ animation:'spin 1s linear infinite' }}>
                          <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="4" opacity=".25"/>
                          <path fill="white" opacity=".75" d="M4 12a8 8 0 018-8v8H4z"/>
                        </svg>
                        Verifying…
                      </span>
                    ) : '🔐 Verify PIN'}
                  </button>

                  <button type="button" onClick={() => { setStep('credentials'); setPin(''); }}
                    style={{ width:'100%', background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,.4)', fontSize:13, fontFamily:'"Manrope","Segoe UI",sans-serif' }}>
                    ← Back to login
                  </button>
                </form>
              </>
            )}

            <p style={{ textAlign:'center', color:'rgba(255,255,255,.25)', fontSize:11, marginTop:20 }}>
              Protected by Wizone Security • 2FA Enabled
            </p>
          </section>

          <div style={{ marginTop:22, textAlign:'center', color:'#fff', fontSize:'.95rem', fontWeight:800, animation:'footerGlow 4.5s ease-in-out infinite' }}>
            Powered by Wizone AI Labs
          </div>
        </div>
      </div>
    </div>
  );
}
