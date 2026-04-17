// ---------------------------------------------------------------------------
// PromptVersioning — Prompt management with version history, diff, rollback
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  listPrompts,
  rollbackPrompt,
  createPromptVersion,
  type PromptInfo,
  type PromptVersion,
} from '../api/client';

type Lang = 'en' | 'fr';

interface Props {
  lang: Lang;
}

// ---------------------------------------------------------------------------
// Bilingual strings
// ---------------------------------------------------------------------------

const S = {
  en: {
    title: 'Prompt Versioning',
    subtitle: 'Manage system prompts with version history and rollback',
    loading: 'Loading prompts...',
    error: 'Failed to load prompts',
    retry: 'Retry',
    empty: 'No prompts registered.',
    prompts: 'Prompts',
    versions: 'Version History',
    version: 'Version',
    author: 'Author',
    date: 'Date',
    rationale: 'Rationale',
    active: 'Active',
    rollback: 'Rollback to this version',
    rollbackConfirm: 'Are you sure you want to rollback?',
    rollingBack: 'Rolling back...',
    createNew: 'Create New Version',
    content: 'Prompt Content',
    contentPlaceholder: 'Enter the new prompt content...',
    rationalePlaceholder: 'Why is this change needed?',
    create: 'Create Version',
    creating: 'Creating...',
    diff: 'Diff View',
    current: 'Current (Active)',
    selected: 'Selected',
    noVersionSelected: 'Select a version to view details',
    close: 'Close',
  },
  fr: {
    title: 'Gestion des prompts',
    subtitle: 'Gerer les prompts systeme avec historique et retour en arriere',
    loading: 'Chargement des prompts...',
    error: 'Echec du chargement des prompts',
    retry: 'Reessayer',
    empty: 'Aucun prompt enregistre.',
    prompts: 'Prompts',
    versions: 'Historique des versions',
    version: 'Version',
    author: 'Auteur',
    date: 'Date',
    rationale: 'Justification',
    active: 'Actif',
    rollback: 'Revenir a cette version',
    rollbackConfirm: 'Etes-vous sur de vouloir revenir en arriere?',
    rollingBack: 'Retour en cours...',
    createNew: 'Creer une nouvelle version',
    content: 'Contenu du prompt',
    contentPlaceholder: 'Entrez le nouveau contenu du prompt...',
    rationalePlaceholder: 'Pourquoi ce changement est-il necessaire?',
    create: 'Creer la version',
    creating: 'Creation...',
    diff: 'Vue comparative',
    current: 'Actuel (Actif)',
    selected: 'Selectionne',
    noVersionSelected: 'Selectionnez une version pour voir les details',
    close: 'Fermer',
  },
};

// ---------------------------------------------------------------------------
// Simple line-by-line diff
// ---------------------------------------------------------------------------

interface DiffLine {
  type: 'same' | 'added' | 'removed';
  content: string;
}

function computeDiff(a: string, b: string): DiffLine[] {
  const linesA = a.split('\n');
  const linesB = b.split('\n');
  const result: DiffLine[] = [];
  const maxLen = Math.max(linesA.length, linesB.length);

  for (let i = 0; i < maxLen; i++) {
    const lineA = linesA[i];
    const lineB = linesB[i];
    if (lineA === lineB) {
      result.push({ type: 'same', content: lineA ?? '' });
    } else {
      if (lineA !== undefined) {
        result.push({ type: 'removed', content: lineA });
      }
      if (lineB !== undefined) {
        result.push({ type: 'added', content: lineB });
      }
    }
  }
  return result;
}

const DIFF_STYLES: Record<string, string> = {
  same: 'text-gray-700 bg-white',
  added: 'text-green-800 bg-green-50',
  removed: 'text-red-800 bg-red-50 line-through',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PromptVersioning({ lang }: Props) {
  const t = S[lang];

  const [prompts, setPrompts] = useState<PromptInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedPrompt, setSelectedPrompt] = useState<PromptInfo | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<PromptVersion | null>(null);
  const [rollingBack, setRollingBack] = useState(false);

  // New version form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newRationale, setNewRationale] = useState('');
  const [creating, setCreating] = useState(false);

  const loadPrompts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listPrompts();
      setPrompts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    } finally {
      setLoading(false);
    }
  }, [t.error]);

  useEffect(() => {
    loadPrompts();
  }, [loadPrompts]);

  const selectPrompt = (prompt: PromptInfo) => {
    setSelectedPrompt(prompt);
    setSelectedVersion(null);
    setShowCreateForm(false);
  };

  const activeVersion = useMemo(() => {
    if (!selectedPrompt) return null;
    return selectedPrompt.versions.find((v) => v.is_active) ?? null;
  }, [selectedPrompt]);

  const diffLines = useMemo(() => {
    if (!selectedVersion || !activeVersion) return [];
    if (selectedVersion.version === activeVersion.version) return [];
    return computeDiff(selectedVersion.content, activeVersion.content);
  }, [selectedVersion, activeVersion]);

  const handleRollback = async () => {
    if (!selectedPrompt || !selectedVersion) return;
    if (!window.confirm(t.rollbackConfirm)) return;
    setRollingBack(true);
    try {
      await rollbackPrompt(selectedPrompt.name, selectedVersion.version);
      await loadPrompts();
      // Re-select prompt to refresh versions
      const updated = prompts.find((p) => p.name === selectedPrompt.name);
      if (updated) setSelectedPrompt(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    } finally {
      setRollingBack(false);
    }
  };

  const handleCreateVersion = async () => {
    if (!selectedPrompt || !newContent.trim()) return;
    setCreating(true);
    try {
      await createPromptVersion(selectedPrompt.name, newContent, newRationale);
      setNewContent('');
      setNewRationale('');
      setShowCreateForm(false);
      await loadPrompts();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    } finally {
      setCreating(false);
    }
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="flex gap-6">
          <div className="w-1/4 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
          <div className="flex-1 h-64 animate-pulse rounded bg-gray-100" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{t.title}</h2>
        <p className="mt-1 text-sm text-gray-500">{t.subtitle}</p>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
          <button type="button" onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {prompts.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border border-dashed border-gray-300 py-20">
          <p className="text-gray-500">{t.empty}</p>
        </div>
      ) : (
        <div className="flex gap-6">
          {/* Prompt list sidebar */}
          <div className="w-1/4 flex-shrink-0">
            <h3 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
              {t.prompts}
            </h3>
            <nav className="space-y-1" aria-label={t.prompts}>
              {prompts.map((prompt) => (
                <button
                  key={prompt.name}
                  type="button"
                  onClick={() => selectPrompt(prompt)}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    selectedPrompt?.name === prompt.name
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  aria-current={selectedPrompt?.name === prompt.name ? 'true' : undefined}
                >
                  <div className="font-medium">{prompt.display_name}</div>
                  <div className="text-xs text-gray-400">{prompt.name}</div>
                  <div className="text-xs text-gray-400">
                    v{prompt.current_version} &middot; {prompt.versions.length} {t.versions.toLowerCase()}
                  </div>
                </button>
              ))}
            </nav>
          </div>

          {/* Version detail area */}
          <div className="flex-1">
            <AnimatePresence mode="wait">
              {selectedPrompt ? (
                <motion.div
                  key={selectedPrompt.name}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {selectedPrompt.display_name}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(!showCreateForm)}
                      className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                      {t.createNew}
                    </button>
                  </div>

                  {/* Create new version form */}
                  <AnimatePresence>
                    {showCreateForm && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-4 overflow-hidden rounded-lg border border-blue-200 bg-blue-50 p-4"
                      >
                        <h4 className="mb-3 text-sm font-semibold text-blue-800">{t.createNew}</h4>
                        <div className="space-y-3">
                          <div>
                            <label htmlFor="new-content" className="mb-1 block text-sm font-medium text-gray-700">
                              {t.content}
                            </label>
                            <textarea
                              id="new-content"
                              rows={8}
                              value={newContent}
                              onChange={(e) => setNewContent(e.target.value)}
                              placeholder={t.contentPlaceholder}
                              className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label htmlFor="new-rationale" className="mb-1 block text-sm font-medium text-gray-700">
                              {t.rationale}
                            </label>
                            <input
                              id="new-rationale"
                              type="text"
                              value={newRationale}
                              onChange={(e) => setNewRationale(e.target.value)}
                              placeholder={t.rationalePlaceholder}
                              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setShowCreateForm(false)}
                              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              {t.close}
                            </button>
                            <button
                              type="button"
                              onClick={handleCreateVersion}
                              disabled={creating || !newContent.trim()}
                              className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                            >
                              {creating ? t.creating : t.create}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Version timeline */}
                  <div className="mb-4">
                    <h4 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
                      {t.versions}
                    </h4>
                    <div className="space-y-1">
                      {selectedPrompt.versions
                        .slice()
                        .sort((a, b) => b.version - a.version)
                        .map((ver) => (
                          <button
                            key={ver.version}
                            type="button"
                            onClick={() => setSelectedVersion(ver)}
                            className={`w-full rounded-md px-3 py-2.5 text-left text-sm transition-colors ${
                              selectedVersion?.version === ver.version
                                ? 'bg-blue-50 border border-blue-200'
                                : 'hover:bg-gray-50 border border-transparent'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {/* Timeline dot */}
                                <div className="relative">
                                  <div className={`h-2.5 w-2.5 rounded-full ${
                                    ver.is_active ? 'bg-green-500' : 'bg-gray-300'
                                  }`} />
                                </div>
                                <span className="font-medium text-gray-900">
                                  v{ver.version}
                                </span>
                                {ver.is_active && (
                                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                                    {t.active}
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-gray-400">
                                {new Date(ver.created_at).toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA')}
                              </span>
                            </div>
                            <div className="ml-5 mt-0.5">
                              <span className="text-xs text-gray-500">{ver.author}</span>
                              {ver.rationale && (
                                <span className="text-xs text-gray-400"> &mdash; {ver.rationale}</span>
                              )}
                            </div>
                          </button>
                        ))}
                    </div>
                  </div>

                  {/* Selected version detail + diff */}
                  {selectedVersion && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-lg border border-gray-200 bg-white p-4"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-gray-700">
                          v{selectedVersion.version} &mdash; {selectedVersion.rationale}
                        </h4>
                        {!selectedVersion.is_active && (
                          <button
                            type="button"
                            onClick={handleRollback}
                            disabled={rollingBack}
                            className="rounded border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                          >
                            {rollingBack ? t.rollingBack : t.rollback}
                          </button>
                        )}
                      </div>

                      {/* Side-by-side diff or full content */}
                      {diffLines.length > 0 ? (
                        <div>
                          <h5 className="mb-2 text-xs font-medium text-gray-500">{t.diff}</h5>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <p className="mb-1 text-xs font-medium text-gray-400">{t.selected} (v{selectedVersion.version})</p>
                              <pre className="max-h-64 overflow-auto rounded border border-gray-200 bg-gray-50 p-2 text-xs leading-5">
                                {selectedVersion.content}
                              </pre>
                            </div>
                            <div>
                              <p className="mb-1 text-xs font-medium text-gray-400">{t.current}</p>
                              <pre className="max-h-64 overflow-auto rounded border border-gray-200 bg-gray-50 p-2 text-xs leading-5">
                                {activeVersion?.content}
                              </pre>
                            </div>
                          </div>
                          <div className="mt-3">
                            <p className="mb-1 text-xs font-medium text-gray-400">{t.diff}</p>
                            <div className="max-h-48 overflow-auto rounded border border-gray-200 bg-white p-2 font-mono text-xs leading-5">
                              {diffLines.map((line, i) => (
                                <div key={i} className={`px-1 ${DIFF_STYLES[line.type]}`}>
                                  <span className="mr-2 select-none text-gray-300">
                                    {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                                  </span>
                                  {line.content}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <pre className="max-h-64 overflow-auto rounded border border-gray-200 bg-gray-50 p-3 text-xs leading-5">
                          {selectedVersion.content}
                        </pre>
                      )}
                    </motion.div>
                  )}

                  {!selectedVersion && (
                    <div className="flex items-center justify-center rounded-lg border border-dashed border-gray-200 py-12">
                      <p className="text-sm text-gray-400">{t.noVersionSelected}</p>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-center rounded-lg border border-dashed border-gray-200 py-20"
                >
                  <p className="text-sm text-gray-400">{t.noVersionSelected}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
