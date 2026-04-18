import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import { Configurator } from './pages/Configurator';
import { DebateRoom } from './pages/DebateRoom';
import { LandingPage } from './pages/LandingPage';
import { initPostHog, trackEvent } from './lib/posthog';
import { auth, logoutGoogle, db } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

function App() {
  const [isPro, setIsPro] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [sessionsLeft, setSessionsLeft] = useState<number>(3);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    initPostHog();

    // Load local storage sessions left
    const saved = localStorage.getItem('neon_sessions_left');
    if (saved !== null) {
      setSessionsLeft(parseInt(saved, 10));
    }

    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      setUser(authUser);
      setAuthReady(true);
      if (authUser) {
        setIsPro(true);
        if (db) {
          try {
            const userRef = doc(db, 'users', authUser.uid);
            // Async save, do not block
            setDoc(userRef, {
              uid: authUser.uid,
              email: authUser.email,
              displayName: authUser.displayName,
              photoURL: authUser.photoURL,
              lastLoginAt: new Date().toISOString()
            }, { merge: true }).catch(e => console.error("Error securing user session in DB:", e));
          } catch (e) {
            console.error("Error securing user session in DB out:", e);
          }
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const deductSession = () => {
    if (user) return; // Authenticated users have unlimited access in this mock
    const newCount = Math.max(0, sessionsLeft - 1);
    setSessionsLeft(newCount);
    localStorage.setItem('neon_sessions_left', newCount.toString());
  };

  const handleUpgrade = () => {
    alert("Redirecting to Polar payments integration! Thank you for considering Pro.");
    setIsPro(true);
    trackEvent('upgraded_to_pro');
  };

  if (!authReady) {
    return <div className="h-screen w-full flex items-center justify-center font-mono text-glass-blue">INITIALIZING OS...</div>;
  }

  return (
    <BrowserRouter>
      <div className="h-screen w-full flex flex-col p-4 gap-4 overflow-hidden font-sans text-text-main">
        
        {/* Global Navigation Header */}
        <header className="glass-panel flex items-center justify-between px-6 h-16 shrink-0 z-50">
          <Link to="/" className="flex items-center gap-2.5 font-extrabold tracking-[2px] text-glass-blue uppercase">
            <span className="text-glass-pink">◆</span> NEON DEBATE
            <span className="bg-glass-blue/10 border border-glass-blue text-glass-blue px-2 py-0.5 rounded text-[10px] ml-1">PRO v2.5</span>
          </Link>
          
          <div className="flex items-center gap-5 text-[12px] text-text-dim">
            {user ? (
              <div className="flex items-center gap-4">
                <span className="text-white hidden sm:inline-block">{user.email}</span>
                <span className="px-2 py-0.5 bg-glass-green/10 text-glass-green border border-glass-green/20 rounded text-[10px] font-bold tracking-widest uppercase">
                   Pro Data Stream Active
                </span>
              </div>
            ) : null}
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 min-h-0 flex flex-col items-center">
          <Routes>
            <Route path="/" element={<LandingPage user={user} sessionsLeft={sessionsLeft} />} />
            <Route 
              path="/configure" 
              element={
                (user || sessionsLeft > 0) ? <Configurator /> : <Navigate to="/" />
              } 
            />
            <Route 
              path="/debate" 
              element={<DebateRoom deductSession={deductSession} user={user} sessionsLeft={sessionsLeft} />} 
            />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
