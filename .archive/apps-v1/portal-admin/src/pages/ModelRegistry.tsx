// ---------------------------------------------------------------------------
// ModelRegistry — Model management with enable/disable, parameter overrides,
// access grants, and capability tags
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  listModels,
  toggleModel,
  updateModelOverrides,
  type ModelConfig,
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
    title: 'Model Registry',
    subtitle: 'Manage AI models, parameter overrides, and access grants',
    loading: 'Loading models...',
    error: 'Failed to load models',
    retry: 'Retry',
    empty: 'No models registered.',
    name: 'Name',
    provider: 'Provider',
    deployment: 'Deployment',
    capabilities: 'Capabilities',
    classification: 'Classification Ceiling',
    status: 'Status',
    enabled: 'Enabled',
    disabled: 'Disabled',
    details: 'Model Details',
    parameterOverrides: 'Parameter Overrides',
    paramKey: 'Key',
    paramValue: 'Value',
    addParam: 'Add Parameter',
    removeParam: 'Remove',
    saveOverrides: 'Save Overrides',
    saving: 'Saving...',
    saved: 'Saved',
    accessGrants: 'Access Grants',
    grantType: 'Type',
    grantName: 'Name',
    noGrants: 'No access grants configured.',
    close: 'Close',
    unclassified: 'Unclassified',
    protectedA: 'Protected A',
    protectedB: 'Protected B',
  },
  fr: {
    title: 'Registre des modeles',
    subtitle: 'Gerer les modeles IA, les parametres et les acces',
    loading: 'Chargement des modeles...',
    error: 'Echec du chargement des modeles',
    retry: 'Reessayer',
    empty: 'Aucun modele enregistre.',
    name: 'Nom',
    provider: 'Fournisseur',
    deployment: 'Deploiement',
    capabilities: 'Capacites',
    classification: 'Plafond de classification',
    status: 'Statut',
    enabled: 'Active',
    disabled: 'Desactive',
    details: 'Details du modele',
    parameterOverrides: 'Parametres personnalises',
    paramKey: 'Cle',
    paramValue: 'Valeur',
    addParam: 'Ajouter un parametre',
    removeParam: 'Retirer',
    saveOverrides: 'Enregistrer',
    saving: 'Enregistrement...',
    saved: 'Enregistre',
    accessGrants: 'Autorisations d\'acces',
    grantType: 'Type',
    grantName: 'Nom',
    noGrants: 'Aucune autorisation d\'acces configuree.',
    close: 'Fermer',
    unclassified: 'Non classifie',
    protectedA: 'Protege A',
    protectedB: 'Protege B',
  },
};

const CLASSIFICATION_LABELS: Record<string, Record<Lang, string>> = {
  unclassified: { en: 'Unclassified', fr: 'Non classifie' },
  protected_a: { en: 'Protected A', fr: 'Protege A' },
  protected_b: { en: 'Protected B', fr: 'Protege B' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ModelRegistry({ lang }: Props) {
  const t = S[lang];

  const [models, setModels] = useState<ModelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<ModelConfig | null>(null);

  // Override editing state
  const [overrideEntries, setOverrideEntries] = useState<Array<{ key: string; value: string }>>([]);
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [overrideSaved, setOverrideSaved] = useState(false);

  const loadModels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listModels();
      setModels(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    } finally {
      setLoading(false);
    }
  }, [t.error]);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const openDetail = (model: ModelConfig) => {
    setSelectedModel(model);
    setOverrideSaved(false);
    // Convert overrides object to editable entries
    const entries = Object.entries(model.parameter_overrides).map(([key, value]) => ({
      key,
      value: typeof value === 'string' ? value : JSON.stringify(value),
    }));
    setOverrideEntries(entries.length > 0 ? entries : [{ key: '', value: '' }]);
  };

  const handleToggle = async (model: ModelConfig) => {
    const newActive = !model.active;
    try {
      await toggleModel(model.id, newActive);
      setModels((prev) =>
        prev.map((m) => (m.id === model.id ? { ...m, active: newActive } : m)),
      );
      if (selectedModel?.id === model.id) {
        setSelectedModel((prev) => (prev ? { ...prev, active: newActive } : prev));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    }
  };

  const handleSaveOverrides = async () => {
    if (!selectedModel) return;
    setOverrideSaving(true);
    try {
      const overrides: Record<string, unknown> = {};
      for (const entry of overrideEntries) {
        if (entry.key.trim()) {
          try {
            overrides[entry.key] = JSON.parse(entry.value);
          } catch {
            overrides[entry.key] = entry.value;
          }
        }
      }
      await updateModelOverrides(selectedModel.id, overrides);
      setModels((prev) =>
        prev.map((m) => (m.id === selectedModel.id ? { ...m, parameter_overrides: overrides } : m)),
      );
      setOverrideSaved(true);
      setTimeout(() => setOverrideSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    } finally {
      setOverrideSaving(false);
    }
  };

  const addOverrideEntry = () => {
    setOverrideEntries((prev) => [...prev, { key: '', value: '' }]);
  };

  const removeOverrideEntry = (index: number) => {
    setOverrideEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const updateOverrideEntry = (index: number, field: 'key' | 'value', val: string) => {
    setOverrideEntries((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, [field]: val } : entry)),
    );
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded bg-gray-100" />
          ))}
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

      <div className="flex gap-6">
        {/* Model table */}
        <div className={`${selectedModel ? 'w-1/2' : 'w-full'} transition-all duration-200`}>
          {models.length === 0 ? (
            <div className="flex items-center justify-center rounded-lg border border-dashed border-gray-300 py-20">
              <p className="text-gray-500">{t.empty}</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">{t.name}</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">{t.provider}</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">{t.capabilities}</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">{t.classification}</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-500">{t.status}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {models.map((model) => (
                    <tr
                      key={model.id}
                      onClick={() => openDetail(model)}
                      className={`cursor-pointer transition-colors ${
                        selectedModel?.id === model.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter') openDetail(model); }}
                      role="button"
                      aria-label={`${t.details}: ${model.name}`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{model.name}</div>
                        <div className="text-xs text-gray-400">{model.deployment}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{model.provider}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {model.capabilities.map((cap) => (
                            <span
                              key={cap}
                              className="inline-flex rounded-md bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600"
                            >
                              {cap}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {CLASSIFICATION_LABELS[model.classification_ceiling]?.[lang] ?? model.classification_ceiling}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleToggle(model); }}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                            model.active ? 'bg-blue-600' : 'bg-gray-300'
                          }`}
                          role="switch"
                          aria-checked={model.active}
                          aria-label={model.active ? t.enabled : t.disabled}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                              model.active ? 'translate-x-4.5' : 'translate-x-0.5'
                            }`}
                          />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detail panel */}
        <AnimatePresence>
          {selectedModel && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="w-1/2"
            >
              <div className="rounded-lg border border-gray-200 bg-white p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">{selectedModel.name}</h3>
                  <button
                    type="button"
                    onClick={() => setSelectedModel(null)}
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    aria-label={t.close}
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <dl className="mb-5 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <dt className="font-medium text-gray-500">{t.provider}</dt>
                  <dd className="text-gray-900">{selectedModel.provider}</dd>
                  <dt className="font-medium text-gray-500">{t.deployment}</dt>
                  <dd className="text-gray-900">{selectedModel.deployment}</dd>
                  <dt className="font-medium text-gray-500">{t.classification}</dt>
                  <dd className="text-gray-900">
                    {CLASSIFICATION_LABELS[selectedModel.classification_ceiling]?.[lang] ?? selectedModel.classification_ceiling}
                  </dd>
                  <dt className="font-medium text-gray-500">{t.status}</dt>
                  <dd>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      selectedModel.active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {selectedModel.active ? t.enabled : t.disabled}
                    </span>
                  </dd>
                </dl>

                {/* Parameter Overrides */}
                <div className="mb-5">
                  <h4 className="mb-2 text-sm font-semibold text-gray-700">{t.parameterOverrides}</h4>
                  <div className="space-y-2">
                    {overrideEntries.map((entry, i) => (
                      <div key={i} className="flex gap-2">
                        <input
                          type="text"
                          value={entry.key}
                          onChange={(e) => updateOverrideEntry(i, 'key', e.target.value)}
                          placeholder={t.paramKey}
                          className="w-1/3 rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          aria-label={`${t.paramKey} ${i + 1}`}
                        />
                        <input
                          type="text"
                          value={entry.value}
                          onChange={(e) => updateOverrideEntry(i, 'value', e.target.value)}
                          placeholder={t.paramValue}
                          className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-xs font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          aria-label={`${t.paramValue} ${i + 1}`}
                        />
                        <button
                          type="button"
                          onClick={() => removeOverrideEntry(i)}
                          className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-400 hover:bg-gray-50 hover:text-red-500"
                          aria-label={`${t.removeParam} ${entry.key}`}
                        >
                          {t.removeParam}
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={addOverrideEntry}
                      className="rounded border border-dashed border-gray-300 px-3 py-1 text-xs text-gray-500 hover:border-gray-400 hover:text-gray-600"
                    >
                      + {t.addParam}
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveOverrides}
                      disabled={overrideSaving}
                      className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {overrideSaving ? t.saving : overrideSaved ? t.saved : t.saveOverrides}
                    </button>
                  </div>
                </div>

                {/* Access Grants */}
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-gray-700">{t.accessGrants}</h4>
                  {selectedModel.access_grants.length === 0 ? (
                    <p className="text-xs text-gray-400">{t.noGrants}</p>
                  ) : (
                    <div className="rounded border border-gray-200">
                      <table className="min-w-full divide-y divide-gray-100 text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-gray-500">{t.grantType}</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-500">{t.grantName}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {selectedModel.access_grants.map((grant) => (
                            <tr key={`${grant.type}-${grant.id}`}>
                              <td className="px-3 py-1.5 capitalize text-gray-600">{grant.type}</td>
                              <td className="px-3 py-1.5 text-gray-900">{grant.name}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
