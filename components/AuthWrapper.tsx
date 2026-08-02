import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, signInWithGoogle } from '../firebase';
import { Hexagon, LogIn, Loader2 } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../utils/firebaseUtils';

interface AuthWrapperProps {
  children: React.ReactNode;
}

/**
 * End-to-end test escape hatch.
 *
 * The app is gated behind Google sign-in, which Playwright cannot complete in
 * CI. This lets the e2e build render the app shell directly.
 *
 * It is double-gated and cannot be turned on in a production bundle:
 *
 *   1. `import.meta.env.MODE !== 'production'` — `npm run build` uses the
 *      production mode, so the whole branch is statically false there and Vite
 *      tree-shakes it out of the shipped bundle entirely.
 *   2. `VITE_E2E_AUTH_BYPASS === 'true'` — set only by `npm run build:e2e`
 *      (`vite build --mode e2e`) and by the Playwright web server.
 *
 * Both conditions are build-time constants, so this is not a runtime flag an
 * attacker can flip. If you ever need to verify: `npm run build` then grep the
 * output for `VITE_E2E_AUTH_BYPASS` — it is not there.
 */
const E2E_AUTH_BYPASS =
  import.meta.env.MODE !== 'production' &&
  import.meta.env.VITE_E2E_AUTH_BYPASS === 'true';

export const AuthWrapper: React.FC<AuthWrapperProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  // Skip the auth-pending state entirely under the e2e bypass, so tests don't
  // race a spinner that will never resolve.
  const [loading, setLoading] = useState(!E2E_AUTH_BYPASS);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Not a conditional hook — the hook always runs; only its body short-circuits.
    if (E2E_AUTH_BYPASS) return;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          // Check if user document exists, if not create it
          // Wrapped in a 5-second timeout so Firestore issues never block auth
          const userDocRef = doc(db, 'users', currentUser.uid);
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Firestore timeout')), 5000)
          );
          let userDoc;
          try {
            userDoc = await Promise.race([getDoc(userDocRef), timeoutPromise]);
          } catch (e) {
            handleFirestoreError(e, OperationType.GET, `users/${currentUser.uid}`);
            throw e; // Should not reach here as handleFirestoreError throws
          }
          
          if (!userDoc.exists()) {
            const userData: any = {
              uid: currentUser.uid,
              email: currentUser.email,
              role: 'user', // Default role
              createdAt: serverTimestamp()
            };
            
            if (currentUser.displayName) {
              userData.displayName = currentUser.displayName;
            }
            if (currentUser.photoURL) {
              userData.photoURL = currentUser.photoURL;
            }

            try {
              await Promise.race([setDoc(userDocRef, userData), timeoutPromise]);
            } catch (e) {
              handleFirestoreError(e, OperationType.CREATE, `users/${currentUser.uid}`);
            }
          }
        } catch (err: any) {
          console.error("Error setting up user in Firestore (proceeding anyway):", err);
          // We log the error but don't set the blocking error state, 
          // allowing the user to use the app with local storage if Firestore is blocked by their browser.
        } finally {
          setUser(currentUser);
          setLoading(false);
        }
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  if (E2E_AUTH_BYPASS) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
        <p className="text-slate-500 font-medium animate-pulse">Authenticating...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4" dir="ltr">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-slate-100 text-center">
          <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-600/20 transform rotate-3">
            <Hexagon className="text-white" size={40} fill="currentColor" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2 tracking-tight">Welcome Back</h1>
          <p className="text-slate-500 mb-8">Sign in to access your AI tools and dashboard.</p>
          
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm mb-6 border border-red-100 text-left">
              <p className="font-bold mb-1">Authentication Error</p>
              <p className="break-words">{
                error.includes('client is offline') 
                  ? "Unable to connect to the database. This is usually caused by an ad-blocker, a strict network firewall, or browser privacy settings blocking the connection."
                  : error
              }</p>
              {(error.includes('network-request-failed') || error.includes('client is offline') || error.includes('popup-closed-by-user')) && (
                <div className="mt-3 pt-3 border-t border-red-200">
                  <p className="font-semibold text-xs mb-1">How to fix this:</p>
                  <ul className="list-disc pl-4 text-xs space-y-1">
                    <li>This usually happens because your browser is blocking third-party cookies or popups in this iframe preview.</li>
                    <li><strong>Solution:</strong> Open this app in a new tab using the "Open in New Tab" button at the top right of the preview window.</li>
                    <li>Alternatively, disable your ad-blocker or allow third-party cookies for this site.</li>
                  </ul>
                </div>
              )}
            </div>
          )}
          
          <button
            onClick={() => signInWithGoogle().catch(e => setError(e.message))}
            className="flex items-center justify-center gap-3 w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium transition-all transform active:scale-[0.98] shadow-md"
          >
            <LogIn size={20} />
            Sign in with Google
          </button>
          
          <p className="mt-6 text-xs text-slate-400">
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
