import React, { useState } from 'react';
import { 
  BookOpen, 
  Lock, 
  ShieldCheck, 
  Sparkles, 
  Brain, 
  Calendar, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  KeyRound,
  Eye,
  EyeOff
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const AuthView: React.FC = () => {
  const { 
    signInWithGoogle, 
    signInWithEmail, 
    signUpWithEmail, 
    resetPassword, 
    error, 
    clearError 
  } = useAuth();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setLocalError('Please enter your email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setLocalError('Please enter a valid email address (e.g. name@example.com).');
      return;
    }

    if (!password) {
      setLocalError('Please enter your password.');
      return;
    }

    if (isSignUp && password.length < 6) {
      setLocalError('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      if (isSignUp) {
        await signUpWithEmail(cleanEmail, password, displayName.trim());
      } else {
        await signInWithEmail(cleanEmail, password);
      }
    } catch (err) {
      // Error handled by AuthContext
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setSubmitting(true);
    clearError();
    try {
      await signInWithGoogle();
    } catch (err) {
      // Error handled by AuthContext
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickDemoAccess = async () => {
    setSubmitting(true);
    clearError();
    try {
      // Create or log into an isolated ideathon demo session
      const demoEmail = 'guest.ideathon@geminijournal.app';
      const demoPass = 'SafeJournal2026!';
      try {
        await signInWithEmail(demoEmail, demoPass);
      } catch (err: any) {
        // If not created yet, create it
        await signUpWithEmail(demoEmail, demoPass, 'Ideathon Evaluator');
      }
    } catch (err) {
      console.error('Demo login attempt:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) return;
    try {
      await resetPassword(resetEmail);
      setResetSent(true);
    } catch (err) {
      // Error handled by AuthContext
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFCFB] flex flex-col justify-between text-[#2D2D2D]">
      {/* Top Header */}
      <header className="px-6 py-6 max-w-7xl mx-auto w-full flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-[#EEF2F0] text-[#7C8B82] flex items-center justify-center border border-[#7C8B82]/30">
            <BookOpen className="w-5 h-5 text-[#7C8B82]" />
          </div>
          <div>
            <h1 className="font-serif text-xl font-bold tracking-tight text-[#2D2D2D]">
              Personal Gemini Journal
            </h1>
            <p className="text-xs text-[#8A847E] font-sans">
              Gen AI Academy APAC Ideathon 2026
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#EEF2F0] text-[#64736A] border border-[#7C8B82]/30">
            <ShieldCheck className="w-3.5 h-3.5 text-[#7C8B82]" />
            <span>Strict User Data Isolation</span>
          </span>
        </div>
      </header>

      {/* Main Hero & Auth Form Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column: Concept & Features */}
          <div className="lg:col-span-7 space-y-8">
            <div className="space-y-4">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-lg bg-[#EEF2F0] border border-[#7C8B82]/30 text-[#64736A] text-xs font-medium">
                <Sparkles className="w-3.5 h-3.5 text-[#7C8B82]" />
                <span>Conversational AI Journal with User-Controlled Memory</span>
              </div>
              <h2 className="font-serif text-4xl sm:text-5xl font-semibold tracking-tight text-[#2D2D2D] leading-[1.15]">
                A mindful space to process your thoughts and organize your life.
              </h2>
              <p className="text-base text-[#5C5651] leading-relaxed font-sans max-w-xl">
                Unlike generic chatbots, Personal Gemini Journal is an empathetic, secure sanctuary. 
                Your conversations, summaries, and memories are strictly sandboxed to your private account.
              </p>
            </div>

            {/* Core Architectural Pillars */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-white border border-[#E5E1DD] shadow-xs space-y-2">
                <div className="w-8 h-8 rounded-lg bg-[#EEF2F0] text-[#7C8B82] flex items-center justify-center border border-[#7C8B82]/20">
                  <Brain className="w-4 h-4 text-[#7C8B82]" />
                </div>
                <h3 className="font-serif text-base font-semibold text-[#2D2D2D]">
                  User-Controlled Memory
                </h3>
                <p className="text-xs text-[#5C5651] leading-normal">
                  The AI identifies goals, milestones, or preferences, but <strong>never</strong> silently stores them. You explicitly review and approve every memory.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white border border-[#E5E1DD] shadow-xs space-y-2">
                <div className="w-8 h-8 rounded-lg bg-[#EEF2F0] text-[#7C8B82] flex items-center justify-center border border-[#7C8B82]/20">
                  <Calendar className="w-4 h-4 text-[#7C8B82]" />
                </div>
                <h3 className="font-serif text-base font-semibold text-[#2D2D2D]">
                  Date-Based Reminders
                </h3>
                <p className="text-xs text-[#5C5651] leading-normal">
                  Mentioning an upcoming exam, deadline, or milestone generates proactive, one-click reminder prompts saved securely to your dashboard.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white border border-[#E5E1DD] shadow-xs space-y-2">
                <div className="w-8 h-8 rounded-lg bg-[#EEF2F0] text-[#7C8B82] flex items-center justify-center border border-[#7C8B82]/20">
                  <BookOpen className="w-4 h-4 text-[#7C8B82]" />
                </div>
                <h3 className="font-serif text-base font-semibold text-[#2D2D2D]">
                  Automatic Summaries
                </h3>
                <p className="text-xs text-[#5C5651] leading-normal">
                  Wrap up reflections with structured takeaways: emotional themes, key realizations, tasks, and future contemplation questions.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white border border-[#E5E1DD] shadow-xs space-y-2">
                <div className="w-8 h-8 rounded-lg bg-[#EEF2F0] text-[#7C8B82] flex items-center justify-center border border-[#7C8B82]/20">
                  <Lock className="w-4 h-4 text-[#7C8B82]" />
                </div>
                <h3 className="font-serif text-base font-semibold text-[#2D2D2D]">
                  Strict Firestore Isolation
                </h3>
                <p className="text-xs text-[#5C5651] leading-normal">
                  Restricted Firestore Security Rules guarantee that no user can ever query or read another user's journal or memories.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Authentication Card */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#E5E1DD] shadow-md transition-all">
              
              {/* Form Mode Switcher */}
              <div className="flex bg-[#F4F1EE] p-1 rounded-xl mb-6 border border-[#E5E1DD]">
                <button
                  type="button"
                  id="tab-signin-btn"
                  onClick={() => { setIsSignUp(false); setLocalError(null); clearError(); }}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    !isSignUp ? 'bg-white text-[#2D2D2D] shadow-xs' : 'text-[#8A847E] hover:text-[#2D2D2D]'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  id="tab-signup-btn"
                  onClick={() => { setIsSignUp(true); setLocalError(null); clearError(); }}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    isSignUp ? 'bg-white text-[#2D2D2D] shadow-xs' : 'text-[#8A847E] hover:text-[#2D2D2D]'
                  }`}
                >
                  Create Account
                </button>
              </div>

              {/* Error Message */}
              {(localError || error) && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2 text-xs text-rose-700">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <div className="flex-1">{localError || error}</div>
                </div>
              )}

              {/* Google Sign-In */}
              <button
                type="button"
                id="btn-google-auth"
                disabled={submitting}
                onClick={handleGoogleSignIn}
                className="w-full flex items-center justify-center space-x-3 py-2.5 px-4 bg-white hover:bg-[#F4F1EE] border border-[#E5E1DD] rounded-xl text-[#2D2D2D] text-sm font-medium transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#E5E1DD]"></div>
                </div>
                <div className="relative flex justify-center text-xs text-[#8A847E] uppercase bg-white px-2">
                  <span>or email</span>
                </div>
              </div>

              {/* Email / Password Form */}
              <form onSubmit={handleSubmit} className="space-y-3.5">
                {isSignUp && (
                  <div>
                    <label className="block text-xs font-medium text-[#5C5651] mb-1">
                      Your Name or Preferred Title
                    </label>
                    <input
                      type="text"
                      id="input-display-name"
                      required
                      autoComplete="name"
                      placeholder="e.g. Alex"
                      value={displayName}
                      onChange={(e) => {
                        setDisplayName(e.target.value);
                        if (localError) setLocalError(null);
                        if (error) clearError();
                      }}
                      className="w-full px-3.5 py-2 text-sm bg-[#F4F1EE] border border-[#E5E1DD] rounded-xl text-[#2D2D2D] placeholder-[#8A847E] focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#7C8B82]"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-[#5C5651] mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="input-email"
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (localError) setLocalError(null);
                      if (error) clearError();
                    }}
                    className="w-full px-3.5 py-2 text-sm bg-[#F4F1EE] border border-[#E5E1DD] rounded-xl text-[#2D2D2D] placeholder-[#8A847E] focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#7C8B82]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-[#5C5651]">
                      Password
                    </label>
                    {!isSignUp && (
                      <button
                        type="button"
                        onClick={() => { setShowResetModal(true); setResetSent(false); setResetEmail(email); }}
                        className="text-[11px] text-[#7C8B82] hover:underline cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="input-password"
                      required
                      autoComplete={isSignUp ? 'new-password' : 'current-password'}
                      placeholder={isSignUp ? 'At least 6 characters' : 'Enter your password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (localError) setLocalError(null);
                        if (error) clearError();
                      }}
                      className="w-full px-3.5 py-2 text-sm bg-[#F4F1EE] border border-[#E5E1DD] rounded-xl text-[#2D2D2D] placeholder-[#8A847E] pr-10 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#7C8B82]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2.5 text-[#8A847E] hover:text-[#2D2D2D] cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  id="btn-auth-submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 bg-[#7C8B82] hover:bg-[#64736A] text-white rounded-xl text-sm font-semibold transition-all shadow-xs flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 mt-2"
                >
                  <span>{submitting ? 'Please wait...' : isSignUp ? 'Create My Private Journal' : 'Sign In'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              {/* Quick Ideathon Evaluator Access */}
              <div className="mt-5 pt-4 border-t border-[#E5E1DD] text-center">
                <button
                  type="button"
                  id="btn-quick-demo-access"
                  onClick={handleQuickDemoAccess}
                  disabled={submitting}
                  className="w-full py-2 px-3 rounded-xl text-xs font-medium text-[#2D2D2D] bg-[#EEF2F0] hover:bg-[#E5E1DD] border border-[#7C8B82]/30 transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5 text-[#7C8B82]" />
                  <span>1-Click Evaluator Guest Session (Ideathon Demo)</span>
                </button>
                <p className="text-[10px] text-[#8A847E] mt-2">
                  Uses genuine Firebase Auth to generate an isolated, secure user context.
                </p>
              </div>

            </div>
          </div>

        </div>
      </main>

      {/* Password Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-[#E5E1DD] space-y-4 text-[#2D2D2D]">
            <h3 className="font-serif text-lg font-semibold text-[#2D2D2D]">Reset Password</h3>
            <p className="text-xs text-[#5C5651]">
              Enter your email address and we will send you a password recovery link.
            </p>
            {resetSent ? (
              <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs space-y-2">
                <p>✓ Reset instructions sent to {resetEmail}. Check your inbox.</p>
                <button
                  onClick={() => setShowResetModal(false)}
                  className="w-full py-1.5 bg-emerald-700 text-white rounded-lg font-medium cursor-pointer"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handlePasswordReset} className="space-y-3">
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#F4F1EE] border border-[#E5E1DD] rounded-xl text-[#2D2D2D] placeholder-[#8A847E] focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#7C8B82]"
                />
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowResetModal(false)}
                    className="flex-1 py-2 text-xs font-medium text-[#5C5651] bg-[#F4F1EE] hover:bg-[#E5E1DD] rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 text-xs font-medium text-white bg-[#7C8B82] hover:bg-[#64736A] rounded-xl cursor-pointer"
                  >
                    Send Reset Link
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Bottom Footer */}
      <footer className="border-t border-[#E5E1DD] bg-white/50 py-4 px-6 text-center text-xs text-[#8A847E]">
        <p>Personal Gemini Journal • Built with Firebase Authentication, Cloud Firestore & Google Gemini</p>
      </footer>
    </div>
  );
};
