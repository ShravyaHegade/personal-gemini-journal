import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  auth, 
  googleProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as fbSignOut, 
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
  User 
} from '../lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    }, (err) => {
      console.error('Auth state listener error:', err);
      setError(err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const clearError = () => setError(null);

  const signInWithGoogle = async () => {
    try {
      setError(null);
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error('Google Sign In failed:', err);
      // Map common auth error codes to friendly messages
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign-in popup was closed before completing.');
      } else if (err.code === 'auth/cancelled-popup-request') {
        setError('Sign-in request was cancelled.');
      } else {
        setError(err.message || 'Failed to sign in with Google');
      }
      throw err;
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    try {
      setError(null);
      const cleanEmail = email.trim();
      if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        const errorMsg = 'Please enter a valid email address (e.g., name@example.com).';
        setError(errorMsg);
        const err = new Error(errorMsg);
        (err as any).code = 'auth/invalid-email';
        throw err;
      }
      await signInWithEmailAndPassword(auth, cleanEmail, pass);
    } catch (err: any) {
      console.error('Email Sign In failed:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Invalid email or password. Please try again.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address (e.g., name@example.com).');
      } else if (err.code === 'auth/user-disabled') {
        setError('This account has been disabled. Please contact support.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again later or reset your password.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Network connection error. Please check your internet connection.');
      } else {
        setError(err.message || 'Failed to sign in with email');
      }
      throw err;
    }
  };

  const signUpWithEmail = async (email: string, pass: string, name: string) => {
    try {
      setError(null);
      const cleanEmail = email.trim();
      if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        const errorMsg = 'Please enter a valid email address (e.g., name@example.com).';
        setError(errorMsg);
        const err = new Error(errorMsg);
        (err as any).code = 'auth/invalid-email';
        throw err;
      }
      if (!pass || pass.length < 6) {
        const errorMsg = 'Password must be at least 6 characters.';
        setError(errorMsg);
        const err = new Error(errorMsg);
        (err as any).code = 'auth/weak-password';
        throw err;
      }
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
      if (name && cred.user) {
        await updateProfile(cred.user, { displayName: name.trim() });
        // Force refresh user state with display name
        setUser({ ...cred.user, displayName: name.trim() });
      }
    } catch (err: any) {
      console.error('Sign Up failed:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists. Try signing in instead.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address (e.g., name@example.com).');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Email and password sign-up is currently not enabled.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Network error. Please check your connection and try again.');
      } else {
        setError(err.message || 'Failed to create account');
      }
      throw err;
    }
  };

  const logout = async () => {
    try {
      setError(null);
      await fbSignOut(auth);
    } catch (err: any) {
      console.error('Sign out failed:', err);
      setError(err.message || 'Failed to log out');
    }
  };

  const resetPassword = async (email: string) => {
    try {
      setError(null);
      const cleanEmail = email.trim();
      if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        const errorMsg = 'Please enter a valid email address.';
        setError(errorMsg);
        const err = new Error(errorMsg);
        (err as any).code = 'auth/invalid-email';
        throw err;
      }
      await sendPasswordResetEmail(auth, cleanEmail);
    } catch (err: any) {
      console.error('Password reset failed:', err);
      if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else if (err.code === 'auth/user-not-found') {
        setError('No account found with this email address.');
      } else {
        setError(err.message || 'Failed to send password reset email');
      }
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      error,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      logout,
      resetPassword,
      clearError
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
