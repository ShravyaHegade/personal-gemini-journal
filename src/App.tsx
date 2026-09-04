import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Navbar } from './components/Navbar';
import { AuthView } from './components/AuthView';
import { DashboardView } from './components/DashboardView';
import { JournalChatView } from './components/JournalChatView';
import { AskJournalView } from './components/AskJournalView';
import { MemoriesView } from './components/MemoriesView';
import { RemindersView } from './components/RemindersView';
import { SummariesView } from './components/SummariesView';
import { SecuritySuiteModal } from './components/SecuritySuiteModal';
import { BookOpen, Loader2 } from 'lucide-react';

function MainApp() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'journal' | 'ask-journal' | 'memories' | 'reminders' | 'summaries'>('dashboard');
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [newSessionTrigger, setNewSessionTrigger] = useState<number>(0);
  const [initialPromptData, setInitialPromptData] = useState<{ title?: string; message?: string } | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFCFB] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-[#EEF2F0] text-[#7C8B82] flex items-center justify-center border border-[#E5E1DD] shadow-xs">
          <BookOpen className="w-6 h-6 text-[#7C8B82] animate-pulse" />
        </div>
        <div className="flex items-center space-x-2 text-xs text-[#8A847E] font-medium">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#7C8B82]" />
          <span>Opening your private journal...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthView />;
  }

  const handleStartNewJournal = (title?: string, initialMessage?: string) => {
    setSelectedConversationId(null);
    setInitialPromptData(title || initialMessage ? { title, message: initialMessage } : null);
    setNewSessionTrigger(prev => prev + 1);
    setActiveTab('journal');
  };

  const handleOpenConversation = (convId: string) => {
    setSelectedConversationId(convId);
    setInitialPromptData(null);
    setActiveTab('journal');
  };

  return (
    <div className="min-h-screen bg-[#FDFCFB] flex flex-col text-[#2D2D2D] font-sans selection:bg-[#EBEFEA]">
      
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onNewJournal={() => handleStartNewJournal()}
        onOpenSecuritySuite={() => setIsSecurityModalOpen(true)}
      />

      {/* Main View Area */}
      <main className="flex-1 flex flex-col min-h-0">
        {activeTab === 'dashboard' && (
          <DashboardView
            onStartNewJournal={handleStartNewJournal}
            onOpenConversation={handleOpenConversation}
            onOpenTab={setActiveTab}
            onOpenSecuritySuite={() => setIsSecurityModalOpen(true)}
          />
        )}

        {activeTab === 'journal' && (
          <JournalChatView
            initialConversationId={selectedConversationId}
            newSessionTrigger={newSessionTrigger}
            initialPromptData={initialPromptData}
            onOpenMemoriesView={() => setActiveTab('memories')}
            onOpenRemindersView={() => setActiveTab('reminders')}
            onOpenSummaryView={() => setActiveTab('summaries')}
          />
        )}

        {activeTab === 'ask-journal' && (
          <AskJournalView />
        )}

        {activeTab === 'memories' && (
          <MemoriesView />
        )}

        {activeTab === 'reminders' && (
          <RemindersView />
        )}

        {activeTab === 'summaries' && (
          <SummariesView onOpenConversation={handleOpenConversation} />
        )}
      </main>

      {/* Security & Isolation Verification Suite Modal */}
      <SecuritySuiteModal
        isOpen={isSecurityModalOpen}
        onClose={() => setIsSecurityModalOpen(false)}
      />

    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
