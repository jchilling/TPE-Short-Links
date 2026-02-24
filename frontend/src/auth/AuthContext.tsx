import {
  isSignInWithEmailLink,
  signInWithEmailLink,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { auth } from '../firebase';

const EMAIL_FOR_SIGN_IN_KEY = 'emailForSignIn';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  requestLoginLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/8f8a3f0e-1f4c-4e1e-9e8e-8bee3dcb50dc',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1c1ee1'},body:JSON.stringify({sessionId:'1c1ee1',runId:'admins-debug',hypothesisId:'H5',location:'auth/AuthContext.tsx:mount',message:'AuthProvider mounted',data:{firebaseProjectId:(auth.app.options as any)?.projectId ?? null,firebaseAuthDomain:(auth.app.options as any)?.authDomain ?? null},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  // Complete sign-in when user lands on the app via the magic link
  useEffect(() => {
    if (!auth || !window.location.href) {
      setLoading(false);
      return;
    }
    const handleEmailLink = async () => {
      if (!isSignInWithEmailLink(auth, window.location.href)) {
        setLoading(false);
        return;
      }
      let email = window.localStorage.getItem(EMAIL_FOR_SIGN_IN_KEY);
      if (!email) {
        email = window.prompt('Please confirm your email address') ?? '';
        if (!email) {
          setLoading(false);
          return;
        }
      }
      try {
        await signInWithEmailLink(auth, email, window.location.href);
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/8f8a3f0e-1f4c-4e1e-9e8e-8bee3dcb50dc',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1c1ee1'},body:JSON.stringify({sessionId:'1c1ee1',runId:'admins-debug',hypothesisId:'H5',location:'auth/AuthContext.tsx:signInWithEmailLink:success',message:'signInWithEmailLink success',data:{},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        window.localStorage.removeItem(EMAIL_FOR_SIGN_IN_KEY);
        // Remove the link params from URL so refreshing doesn't re-trigger
        window.history.replaceState({}, document.title, window.location.pathname || '/');
      } catch (err) {
        console.error('Sign-in from link failed:', err);
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/8f8a3f0e-1f4c-4e1e-9e8e-8bee3dcb50dc',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1c1ee1'},body:JSON.stringify({sessionId:'1c1ee1',runId:'admins-debug',hypothesisId:'H5',location:'auth/AuthContext.tsx:signInWithEmailLink:error',message:'signInWithEmailLink error',data:{name:(err as any)?.name ?? null,code:(err as any)?.code ?? null,message:typeof (err as any)?.message==='string'?(err as any).message:String(err)},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
      } finally {
        setLoading(false);
      }
    };
    handleEmailLink();
  }, []);

  // Auth state listener (after initial link handling)
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      setUser(u);
      setLoading(false);
      const domain = u?.email && u.email.includes('@') ? u.email.split('@')[1] : null;
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/8f8a3f0e-1f4c-4e1e-9e8e-8bee3dcb50dc',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1c1ee1'},body:JSON.stringify({sessionId:'1c1ee1',runId:'admins-debug',hypothesisId:'H5',location:'auth/AuthContext.tsx:onAuthStateChanged',message:'Auth state changed',data:{userPresent:!!u,emailDomain:domain,providerCount:Array.isArray(u?.providerData)?u.providerData.length:null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
    });
    return () => unsub();
  }, []);

  const requestLoginLink = useCallback(async (email: string) => {
    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const fn = getFunctions(auth.app);
    const sendAdminLoginLink = httpsCallable<{ email: string }>(fn, 'sendAdminLoginLink');
    window.localStorage.setItem(EMAIL_FOR_SIGN_IN_KEY, email);
    await sendAdminLoginLink({ email });
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
    navigate('/login');
  }, [navigate]);

  const value: AuthContextValue = {
    user,
    loading,
    requestLoginLink,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
