import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NeonButton } from '../components/NeonButton';
import { loginWithGoogle } from '../lib/firebase';
import { trackEvent } from '../lib/posthog';

interface LandingPageProps {
  user: any;
  sessionsLeft: number;
}

export function LandingPage({ user, sessionsLeft }: LandingPageProps) {
  const navigate = useNavigate();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await loginWithGoogle();
      trackEvent('user_logged_in');
      navigate('/configure');
    } catch (e: any) {
      console.error(e);
      if (e.code !== 'auth/popup-closed-by-user') {
        alert("Failed to authenticate with Google: " + e.message);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleFreeTrial = () => {
    if (sessionsLeft <= 0) {
      alert("You have exhausted your 3 free sessions! Please sign in to continue.");
      return;
    }
    trackEvent('started_free_trial');
    navigate('/configure');
  };

  return (
    <div className="w-full h-full min-h-0 overflow-y-auto scroll-smooth">
      <div className="flex flex-col items-center min-h-[80vh] w-full px-4 pt-16 pb-32">
        {/* Main Hero Section */}
        <div className="glass-panel p-10 md:p-16 max-w-4xl w-full flex flex-col items-center text-center gap-6 shadow-[0_0_50px_rgba(0,243,255,0.1)] relative overflow-hidden mb-12">
          
          {/* Neon Decorators */}
          <div className="absolute -top-20 -left-20 w-60 h-60 bg-glass-blue/20 rounded-full blur-[80px] pointer-events-none" />
          <div className="absolute -bottom-20 -right-20 w-60 h-60 bg-glass-pink/20 rounded-full blur-[80px] pointer-events-none" />

          <div className="z-10 relative">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-glass-blue/10 border border-glass-blue/30 rounded-full text-glass-blue text-[10px] font-bold uppercase tracking-widest mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-glass-blue animate-pulse"></span>
              Agent OS Engine v2.5
            </div>

            <h1 className="text-4xl md:text-7xl font-extrabold tracking-tight text-white mb-6">
              Listen to the Future.<br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-glass-blue to-glass-pink">
                AI Debates in Real-Time.
              </span>
            </h1>

            <p className="text-text-dim text-sm md:text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
              Configure custom AI personas, plug them into the Arena, and hear them debate ideas at human-speed. Advanced audio synthesis combined with real-time strategic notes pushed directly to your stream.
            </p>

            {!user ? (
              <div className="flex flex-col md:flex-row gap-6 items-center justify-center w-full max-w-md mx-auto">
                <button 
                  onClick={handleLogin}
                  disabled={isLoggingIn}
                  className="w-full md:w-auto flex items-center justify-center gap-3 bg-white text-black font-bold uppercase tracking-widest text-sm rounded-lg px-8 py-4 transition-transform hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.2)] disabled:opacity-50"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  {isLoggingIn ? "Connecting..." : "Auth OS"}
                </button>

                <div className="flex flex-col items-center gap-2 w-full md:w-auto">
                  <NeonButton color="blue" onClick={handleFreeTrial} className="w-full md:w-auto px-8 py-4 text-sm font-bold shadow-[0_0_20px_rgba(0,243,255,0.2)]">
                    Free Trial Limit
                  </NeonButton>
                  <div className="text-[11px] text-glass-blue opacity-80 font-mono tracking-widest">
                    {sessionsLeft} SESSIONS REMAINING
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-6 w-full max-w-sm mx-auto p-4 bg-white/5 border border-glass-green/30 rounded-2xl shadow-[0_0_30px_rgba(57,255,20,0.1)]">
                <div className="flex items-center gap-4 w-full">
                  <img 
                    src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`} 
                    alt="Avatar" 
                    className="w-12 h-12 rounded-full border-2 border-glass-green"
                    referrerPolicy="no-referrer"
                  />
                  <div className="text-left overflow-hidden flex-1">
                    <div className="text-white text-md font-bold truncate">{user.displayName || "Pro User"}</div>
                    <div className="text-glass-green text-[10px] uppercase font-bold tracking-widest flex items-center gap-1">
                       <span className="w-1.5 h-1.5 rounded-full bg-glass-green animate-pulse"></span> DB SYNCHRONIZED
                    </div>
                  </div>
                </div>
                <NeonButton color="green" onClick={() => navigate('/configure')} className="w-full text-lg py-5 shadow-[0_0_20px_rgba(57,255,20,0.2)]">
                  ENTER ARENA →
                </NeonButton>
              </div>
            )}
          </div>
        </div>
        
        {/* Scrolling Features Marquee */}
        <div className="w-full overflow-hidden mb-24 relative before:absolute before:left-0 before:top-0 before:z-10 before:h-full before:w-20 before:bg-gradient-to-r before:from-glass-bg before:to-transparent after:absolute after:right-0 after:top-0 after:z-10 after:h-full after:w-20 after:bg-gradient-to-l after:from-glass-bg after:to-transparent">
          <div className="flex w-[200%] animate-marquee gap-6">
            {[1, 2].map((i) => (
              <div key={i} className="flex gap-6 min-w-full">
                <div className="flex-1 glass-panel p-6 px-10 whitespace-nowrap text-lg font-bold tracking-widest text-glass-blue border-glass-blue/30 flex items-center gap-4">
                  🎙️ MILLISECOND TTS
                </div>
                <div className="flex-1 glass-panel p-6 px-10 whitespace-nowrap text-lg font-bold tracking-widest text-glass-pink border-glass-pink/30 flex items-center gap-4">
                  🧠 AUTONOMOUS LOGIC
                </div>
                <div className="flex-1 glass-panel p-6 px-10 whitespace-nowrap text-lg font-bold tracking-widest text-glass-green border-glass-green/30 flex items-center gap-4">
                  ⚡ DB SYNCHRONIZATION
                </div>
                <div className="flex-1 glass-panel p-6 px-10 whitespace-nowrap text-lg font-bold tracking-widest text-white border-white/30 flex items-center gap-4">
                  📓 LIVE JOURNALISM
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing Plans */}
        <div className="max-w-6xl w-full mx-auto mb-24 px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-white uppercase tracking-widest mb-4">Choose Your Vector</h2>
            <p className="text-text-dim text-sm max-w-xl mx-auto">Scale your operations from casual debates to enterprise-grade AI combat simulations.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="glass-panel p-8 flex flex-col items-center text-center opacity-80 hover:opacity-100 transition-opacity">
              <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-widest">Observer</h3>
              <div className="text-3xl font-extrabold text-glass-blue mb-6">FREE</div>
              <ul className="text-sm text-text-dim space-y-4 mb-8 text-left w-full">
                <li className="flex items-center gap-2">✓ 3 Free Sessions</li>
                <li className="flex items-center gap-2">✓ Standard TTS Voices</li>
                <li className="flex items-center gap-2 opacity-30">× Custom DB Sync</li>
              </ul>
              <NeonButton color="blue" onClick={handleFreeTrial} className="w-full mt-auto">Start Trial</NeonButton>
            </div>
            <div className="glass-panel p-8 flex flex-col items-center text-center relative border-glass-pink/50 shadow-[0_0_30px_rgba(255,0,234,0.1)] scale-105">
              <div className="absolute top-0 right-0 bg-glass-pink text-white text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-bl-lg rounded-tr-lg">Popular</div>
              <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-widest">Architect</h3>
              <div className="text-3xl font-extrabold text-glass-pink mb-6">$19<span className="text-sm text-text-dim">/mo</span></div>
              <ul className="text-sm text-text-dim space-y-4 mb-8 text-left w-full">
                <li className="flex items-center gap-2">✓ Unlimited Sessions</li>
                <li className="flex items-center gap-2">✓ Advanced TTS Voices</li>
                <li className="flex items-center gap-2">✓ Firestore DB Sync</li>
                <li className="flex items-center gap-2">✓ Live Journalism Notes</li>
              </ul>
              <NeonButton color="pink" onClick={handleLogin} className="w-full mt-auto">Upgrade Now</NeonButton>
            </div>
            <div className="glass-panel p-8 flex flex-col items-center text-center opacity-80 hover:opacity-100 transition-opacity">
              <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-widest">Enterprise</h3>
              <div className="text-3xl font-extrabold text-glass-green mb-6">$99<span className="text-sm text-text-dim">/mo</span></div>
              <ul className="text-sm text-text-dim space-y-4 mb-8 text-left w-full">
                <li className="flex items-center gap-2">✓ Everything in Architect</li>
                <li className="flex items-center gap-2">✓ Custom Agent Logic</li>
                <li className="flex items-center gap-2">✓ API Access</li>
              </ul>
              <NeonButton color="green" onClick={handleLogin} className="w-full mt-auto">Contact Sales</NeonButton>
            </div>
          </div>
        </div>

        {/* User Testimonials */}
        <div className="max-w-6xl w-full mx-auto px-4 text-center">
          <h2 className="text-2xl font-extrabold text-white uppercase tracking-widest mb-10">Combat Communications Log</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
            <div className="glass-panel p-6 flex flex-col gap-4 italic border-white/10">
              <p className="text-text-dim text-sm leading-relaxed">"The speed at which these agents pivot arguments is terrifying. It's the ultimate tool for stress-testing business plans before pitching."</p>
              <div className="flex items-center gap-3 mt-auto pt-4 border-t border-white/5">
                <div className="w-8 h-8 rounded-full bg-glass-blue/20"></div>
                <div>
                  <div className="text-white text-sm font-bold">Sarah T.</div>
                  <div className="text-glass-blue text-xs uppercase tracking-widest">Startup Founder</div>
                </div>
              </div>
            </div>
            <div className="glass-panel p-6 flex flex-col gap-4 italic border-white/10">
              <p className="text-text-dim text-sm leading-relaxed">"I use the journalism feature constantly. Having a third stream summarizing the debate in real-time saves me hours of analysis."</p>
              <div className="flex items-center gap-3 mt-auto pt-4 border-t border-white/5">
                <div className="w-8 h-8 rounded-full bg-glass-pink/20"></div>
                <div>
                  <div className="text-white text-sm font-bold">Marcus L.</div>
                  <div className="text-glass-pink text-xs uppercase tracking-widest">Policy Analyst</div>
                </div>
              </div>
            </div>
            <div className="glass-panel p-6 flex flex-col gap-4 italic border-white/10 overflow-hidden relative">
               <div className="absolute top-0 right-0 w-16 h-16 bg-glass-green/10 blur-[30px]" />
              <p className="text-text-dim text-sm leading-relaxed">"The UI is unbelievably crisp. Neon Debate feels less like software and more like jacking into an operating system from 2080."</p>
              <div className="flex items-center gap-3 mt-auto pt-4 border-t border-white/5">
                <div className="w-8 h-8 rounded-full bg-glass-green/20"></div>
                <div>
                  <div className="text-white text-sm font-bold">Elena R.</div>
                  <div className="text-glass-green text-xs uppercase tracking-widest">Product Designer</div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
