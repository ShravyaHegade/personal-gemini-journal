import React from 'react';
import { 
  BookOpen, 
  Sparkles, 
  Calendar, 
  Brain, 
  ShieldCheck, 
  LogOut, 
  User, 
  LayoutDashboard,
  Lock
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface NavbarProps {
  activeTab: 'dashboard' | 'journal' | 'ask-journal' | 'memories' | 'reminders' | 'summaries';
  setActiveTab: (tab: 'dashboard' | 'journal' | 'ask-journal' | 'memories' | 'reminders' | 'summaries') => void;
  onNewJournal: () => void;
  onOpenSecuritySuite: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onNewJournal,
  onOpenSecuritySuite,
}) => {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-[#FDFCFB]/95 backdrop-blur-md border-b border-[#E5E1DD] transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Brand Logo & Title */}
          <div 
            className="flex items-center gap-3 cursor-pointer shrink-0 select-none group" 
            onClick={() => setActiveTab('dashboard')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveTab('dashboard'); } }}
            aria-label="Personal Gemini Journal Dashboard"
          >
            <div className="w-10 h-10 rounded-xl bg-[#EEF2F0] text-[#7C8B82] flex items-center justify-center border border-[#E5E1DD] shadow-2xs shrink-0 group-hover:border-[#7C8B82]/40 transition-colors">
              <BookOpen className="w-5 h-5 text-[#7C8B82]" />
            </div>
            <div className="flex flex-col justify-center text-left">
              <div className="flex items-center gap-2">
                <span className="font-serif text-[17px] font-bold tracking-tight text-[#2D2D2D] whitespace-nowrap leading-tight">
                  Personal Gemini Journal
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#EEF2F0] text-[#5C5651] border border-[#E5E1DD] shrink-0">
                  Private
                </span>
              </div>
              <p className="text-[11px] leading-tight text-[#7A746E] tracking-normal whitespace-nowrap mt-0.5 hidden sm:block">
                Secure AI Journal & Mindful Reflection Space
              </p>
            </div>
          </div>

          {/* Center Navigation Links */}
          <nav className="hidden md:flex items-center space-x-0.5 lg:space-x-1 bg-[#F4F1EE] p-1 rounded-xl border border-[#E5E1DD] shrink-0">
            <button
              id="nav-dashboard-btn"
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center space-x-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-white text-[#2D2D2D] shadow-xs font-semibold'
                  : 'text-[#8A847E] hover:text-[#2D2D2D] hover:bg-white/60'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </button>

            <button
              id="nav-journal-btn"
              onClick={() => setActiveTab('journal')}
              className={`flex items-center space-x-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'journal'
                  ? 'bg-white text-[#2D2D2D] shadow-xs font-semibold'
                  : 'text-[#8A847E] hover:text-[#2D2D2D] hover:bg-white/60'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#7C8B82]" />
              <span>Journal Chat</span>
            </button>

            <button
              id="nav-ask-journal-btn"
              onClick={() => setActiveTab('ask-journal')}
              className={`flex items-center space-x-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'ask-journal'
                  ? 'bg-[#7C8B82] text-white shadow-xs font-semibold'
                  : 'text-[#5C5651] hover:text-[#2D2D2D] hover:bg-white/60'
              }`}
            >
              <Brain className={`w-3.5 h-3.5 ${activeTab === 'ask-journal' ? 'text-white' : 'text-[#7C8B82]'}`} />
              <span>Ask My Journal</span>
            </button>

            <button
              id="nav-memories-btn"
              onClick={() => setActiveTab('memories')}
              className={`flex items-center space-x-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'memories'
                  ? 'bg-white text-[#2D2D2D] shadow-xs font-semibold'
                  : 'text-[#8A847E] hover:text-[#2D2D2D] hover:bg-white/60'
              }`}
            >
              <Brain className="w-3.5 h-3.5 text-[#7C8B82]" />
              <span>Memories</span>
            </button>

            <button
              id="nav-reminders-btn"
              onClick={() => setActiveTab('reminders')}
              className={`flex items-center space-x-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'reminders'
                  ? 'bg-white text-[#2D2D2D] shadow-xs font-semibold'
                  : 'text-[#8A847E] hover:text-[#2D2D2D] hover:bg-white/60'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-[#7C8B82]" />
              <span>Reminders</span>
            </button>

            <button
              id="nav-summaries-btn"
              onClick={() => setActiveTab('summaries')}
              className={`flex items-center space-x-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'summaries'
                  ? 'bg-white text-[#2D2D2D] shadow-xs font-semibold'
                  : 'text-[#8A847E] hover:text-[#2D2D2D] hover:bg-white/60'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-[#7C8B82]" />
              <span>Summaries</span>
            </button>
          </nav>

          {/* Right Action Items */}
          <div className="flex items-center space-x-2.5 shrink-0">
            {/* Security Audit Button */}
            <button
              id="btn-security-suite"
              onClick={onOpenSecuritySuite}
              title="Inspect Firebase Security Rules & Isolation Suite"
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#EEF2F0] text-[#5C5651] border border-[#E5E1DD] hover:bg-[#E5E1DD]/60 transition-colors shadow-2xs cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#7C8B82]" />
              <span className="hidden xl:inline">Security Shield</span>
            </button>

            {/* User Profile & Logout */}
            <div className="flex items-center pl-2 border-l border-[#E5E1DD] space-x-2">
              <div className="flex items-center space-x-2 max-w-[140px] truncate" title={user?.email || 'User'}>
                <div className="w-7 h-7 rounded-full bg-[#F4F1EE] text-[#5C5651] flex items-center justify-center text-xs font-semibold overflow-hidden border border-[#E5E1DD] shrink-0">
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span>{user?.displayName?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}</span>
                  )}
                </div>
                <span className="text-xs font-medium text-[#5C5651] truncate hidden sm:block">
                  {user?.displayName || user?.email?.split('@')[0] || 'User'}
                </span>
              </div>

              <button
                id="btn-sign-out"
                onClick={logout}
                title="Sign Out"
                className="p-1.5 text-[#8A847E] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Bottom Bar navigation */}
        <div className="md:hidden flex items-center justify-around py-2 border-t border-[#E5E1DD] overflow-x-auto gap-1">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center py-1 px-1 text-[11px] font-medium ${
              activeTab === 'dashboard' ? 'text-[#7C8B82] font-semibold' : 'text-[#8A847E]'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 mb-0.5" />
            <span>Home</span>
          </button>
          <button
            onClick={() => setActiveTab('journal')}
            className={`flex flex-col items-center py-1 px-1 text-[11px] font-medium ${
              activeTab === 'journal' ? 'text-[#7C8B82] font-semibold' : 'text-[#8A847E]'
            }`}
          >
            <Sparkles className="w-4 h-4 mb-0.5 text-[#7C8B82]" />
            <span>Chat</span>
          </button>
          <button
            onClick={() => setActiveTab('ask-journal')}
            className={`flex flex-col items-center py-1 px-1 text-[11px] font-medium ${
              activeTab === 'ask-journal' ? 'text-[#7C8B82] font-semibold' : 'text-[#8A847E]'
            }`}
          >
            <Brain className="w-4 h-4 mb-0.5 text-[#7C8B82]" />
            <span>Ask</span>
          </button>
          <button
            onClick={() => setActiveTab('memories')}
            className={`flex flex-col items-center py-1 px-1 text-[11px] font-medium ${
              activeTab === 'memories' ? 'text-[#7C8B82] font-semibold' : 'text-[#8A847E]'
            }`}
          >
            <Brain className="w-4 h-4 mb-0.5 text-[#7C8B82]" />
            <span>Memories</span>
          </button>
          <button
            onClick={() => setActiveTab('reminders')}
            className={`flex flex-col items-center py-1 px-1 text-[11px] font-medium ${
              activeTab === 'reminders' ? 'text-[#7C8B82] font-semibold' : 'text-[#8A847E]'
            }`}
          >
            <Calendar className="w-4 h-4 mb-0.5 text-[#7C8B82]" />
            <span>Reminders</span>
          </button>
          <button
            onClick={() => setActiveTab('summaries')}
            className={`flex flex-col items-center py-1 px-1 text-[11px] font-medium ${
              activeTab === 'summaries' ? 'text-[#7C8B82] font-semibold' : 'text-[#8A847E]'
            }`}
          >
            <BookOpen className="w-4 h-4 mb-0.5 text-[#7C8B82]" />
            <span>Summaries</span>
          </button>
        </div>
      </div>
    </header>
  );
};
