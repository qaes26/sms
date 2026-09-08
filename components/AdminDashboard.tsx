'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
} from 'lucide-react';

interface AdminDashboardProps {
  onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  
  // Track sessions that are streaming to auto-focus immediately when user approves camera
  const prevStreamingIdsRef = useRef<Set<string>>(new Set());
  const selectedSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    selectedSessionIdRef.current = selectedSessionId;
  }, [selectedSessionId]);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions');
      if (res.status === 401) {
        onLogout();
        return;
      }

      if (res.ok) {
        const data = await res.json();
        const activeList: UserSession[] = data.sessions || [];
        setSessions(activeList);
        setLastRefreshed(new Date());

        // Find sessions currently in streaming status (camera approved by user)
        const streamingSessions = activeList.filter((s) => s.streamStatus === 'streaming');
        const currentStreamingIds = new Set(streamingSessions.map((s) => s.id));

        // Check if a new session just started streaming that wasn't previously streaming
        const newlyStreaming = streamingSessions.find(
          (s) => !prevStreamingIdsRef.current.has(s.id)
        );

        if (newlyStreaming) {
          // Immediately auto-open the new stream without any sound/alert
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
      setIsLoading(false);
    }
  }, [onLogout]);

  // Periodic polling for active sessions every 1000ms for fast stream reaction
  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 1000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  const handleTerminateSession = async (sessionId: string) => {
    try {
      await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (selectedSessionId === sessionId) {
        setSelectedSessionId(null);
      }
    } catch (e) {
      console.error('Error terminating session', e);
    }
  };

  const selectedSession = sessions.find((s) => s.id === selectedSessionId);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Navigation Bar */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight">Admin-Kontrollzentrum</h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                WebRTC Live-Streaming & Sitzungsverwaltung
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchSessions}
              title="Aktualisieren"
              className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-all text-xs flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Aktualisieren</span>
            </button>

            <button
              onClick={onLogout}
              className="p-2 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 transition-all text-xs flex items-center gap-1.5 font-medium"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Abmelden</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
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

            <div className="flex items-center gap-2">
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
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                          {session.id.substring(0, 8)}...
                        </span>
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
