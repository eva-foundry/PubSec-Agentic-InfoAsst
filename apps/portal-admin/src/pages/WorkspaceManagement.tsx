// ---------------------------------------------------------------------------
// WorkspaceManagement — Provisioning, status monitoring, decommissioning
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  listWorkspaces,
  listModels,
  provisionWorkspace,
  decommissionWorkspace,
  getWorkspacePrompt,
  updateWorkspacePrompt,
  rollbackWorkspacePrompt,
  type AdminWorkspace,
  type ModelConfig,
  type ProvisionPlan,
  type DecommissionPlan,
  type ProvisionRequest,
  type WorkspacePromptData,
  type BusinessPromptHistoryEntry,
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
    title: 'Workspace Management',
    subtitle: 'Provision, monitor, and decommission EVA workspaces',
    provision: 'Provision New Workspace',
    decommission: 'Decommission',
    loading: 'Loading workspaces...',
    error: 'Failed to load workspaces',
    retry: 'Retry',
    empty: 'No workspaces provisioned yet.',
    name: 'Name',
    client: 'Client',
    type: 'Type',
    status: 'Status',
    health: 'Health',
    capacity: 'Capacity',
    documents: 'Documents',
    model: 'Model',
    created: 'Created',
    ready: 'Ready',
    provisioning: 'Provisioning',
    archived: 'Archived',
    // Provision dialog
    provisionTitle: 'Provision New Workspace',
    workspaceType: 'Workspace Type',
    capacityLimit: 'Capacity Limit (documents)',
    selectModel: 'Model',
    escalationTier: 'Escalation Tier',
    tierAuto: 'Auto (Level 1)',
    tierReview: 'Review (Level 2)',
    tierHuman: 'Human (Level 3+)',
    chunkingStrategy: 'Chunking Strategy',
    chunkDefault: 'Default',
    chunkLegislation: 'Legislation',
    chunkCaseLaw: 'Case Law',
    preview: 'Preview Plan',
    confirmDeploy: 'Confirm & Deploy',
    cancel: 'Cancel',
    previewTitle: 'Provisioning Plan',
    resource: 'Resource',
    resourceType: 'Type',
    resourceStatus: 'Status',
    estimatedCost: 'Estimated Monthly Cost',
    deploying: 'Deploying...',
    // Decommission dialog
    decommissionTitle: 'Decommission Workspace',
    membersToRemove: 'Members to remove',
    docsToDelete: 'Documents to delete',
    indexToPurge: 'Index entries to purge',
    gateMembersReviewed: 'Member removal reviewed',
    gateDocsReviewed: 'Document deletion reviewed',
    gateIrreversible: 'I understand this is irreversible',
    typeNameToConfirm: 'Type workspace name to confirm',
    confirmDecommission: 'Decommission',
    decommissioning: 'Decommissioning...',
    typeStandard: 'Standard',
    typePremium: 'Premium',
    typeSandbox: 'Sandbox',
    typeRestricted: 'Restricted',
    typeShared: 'Shared',
    // Prompt management
    promptTitle: 'Business Prompt',
    promptCurrent: 'Current Prompt',
    promptVersion: 'Version',
    promptHistory: 'Version History',
    promptSave: 'Save New Version',
    promptRollback: 'Rollback',
    promptRationale: 'Rationale for change',
    promptAuthor: 'Author',
    promptDate: 'Date',
    promptNoHistory: 'No version history available.',
    promptSaving: 'Saving...',
    promptRollingBack: 'Rolling back...',
    promptClose: 'Close',
    promptManage: 'Prompt',
  },
  fr: {
    title: 'Gestion des espaces de travail',
    subtitle: 'Provisionner, surveiller et desactiver les espaces EVA',
    provision: 'Provisionner un espace',
    decommission: 'Desactiver',
    loading: 'Chargement des espaces...',
    error: 'Echec du chargement des espaces',
    retry: 'Reessayer',
    empty: 'Aucun espace provisionne.',
    name: 'Nom',
    client: 'Client',
    type: 'Type',
    status: 'Statut',
    health: 'Sante',
    capacity: 'Capacite',
    documents: 'Documents',
    model: 'Modele',
    created: 'Cree',
    ready: 'Pret',
    provisioning: 'En cours',
    archived: 'Archive',
    provisionTitle: 'Provisionner un espace de travail',
    workspaceType: 'Type d\'espace',
    capacityLimit: 'Limite de capacite (documents)',
    selectModel: 'Modele',
    escalationTier: 'Niveau d\'escalade',
    tierAuto: 'Auto (Niveau 1)',
    tierReview: 'Revision (Niveau 2)',
    tierHuman: 'Humain (Niveau 3+)',
    chunkingStrategy: 'Strategie de decoupage',
    chunkDefault: 'Par defaut',
    chunkLegislation: 'Legislation',
    chunkCaseLaw: 'Jurisprudence',
    preview: 'Apercu du plan',
    confirmDeploy: 'Confirmer et deployer',
    cancel: 'Annuler',
    previewTitle: 'Plan de provisionnement',
    resource: 'Ressource',
    resourceType: 'Type',
    resourceStatus: 'Statut',
    estimatedCost: 'Cout mensuel estime',
    deploying: 'Deploiement...',
    decommissionTitle: 'Desactiver l\'espace de travail',
    membersToRemove: 'Membres a retirer',
    docsToDelete: 'Documents a supprimer',
    indexToPurge: 'Entrees d\'index a purger',
    gateMembersReviewed: 'Retrait des membres verifie',
    gateDocsReviewed: 'Suppression des documents verifiee',
    gateIrreversible: 'Je comprends que c\'est irreversible',
    typeNameToConfirm: 'Tapez le nom de l\'espace pour confirmer',
    confirmDecommission: 'Desactiver',
    decommissioning: 'Desactivation...',
    typeStandard: 'Standard',
    typePremium: 'Premium',
    typeSandbox: 'Bac a sable',
    typeRestricted: 'Restreint',
    typeShared: 'Partage',
    promptTitle: 'Invite metier',
    promptCurrent: 'Invite actuelle',
    promptVersion: 'Version',
    promptHistory: 'Historique des versions',
    promptSave: 'Enregistrer nouvelle version',
    promptRollback: 'Restaurer',
    promptRationale: 'Justification du changement',
    promptAuthor: 'Auteur',
    promptDate: 'Date',
    promptNoHistory: 'Aucun historique de version disponible.',
    promptSaving: 'Enregistrement...',
    promptRollingBack: 'Restauration...',
    promptClose: 'Fermer',
    promptManage: 'Invite',
  },
};

// ---------------------------------------------------------------------------
// Status / Health badge helpers
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<string, string> = {
  ready: 'bg-green-100 text-green-800',
  provisioning: 'bg-amber-100 text-amber-800',
  archived: 'bg-gray-100 text-gray-500',
};

const HEALTH_COLORS: Record<string, string> = {
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
};

const WORKSPACE_TYPES = ['standard', 'premium', 'sandbox', 'restricted', 'shared'] as const;

// ---------------------------------------------------------------------------
// Modal wrapper
// ---------------------------------------------------------------------------

function Dialog({
  open,
  onClose,
  children,
  title,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title: string;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ duration: 0.2 }}
        className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
      >
        <h3 className="mb-4 text-lg font-semibold text-gray-900">{title}</h3>
        {children}
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WorkspaceManagement({ lang }: Props) {
  const t = S[lang];

  const [workspaces, setWorkspaces] = useState<AdminWorkspace[]>([]);
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Provision dialog state
  const [provisionOpen, setProvisionOpen] = useState(false);
  const [provisionForm, setProvisionForm] = useState<ProvisionRequest>({
    workspace_type: 'standard',
    capacity_limit: 500,
    model_id: '',
    escalation_tier: 'auto',
    chunking_strategy: 'default',
  });
  const [provisionPlan, setProvisionPlan] = useState<ProvisionPlan | null>(null);
  const [provisionSubmitting, setProvisionSubmitting] = useState(false);

  // Decommission dialog state
  const [decommTarget, setDecommTarget] = useState<AdminWorkspace | null>(null);
  const [decommPlan, setDecommPlan] = useState<DecommissionPlan | null>(null);
  const [decommGates, setDecommGates] = useState({ members: false, docs: false, irreversible: false });
  const [decommNameConfirm, setDecommNameConfirm] = useState('');
  const [decommSubmitting, setDecommSubmitting] = useState(false);

  // Prompt dialog state
  const [promptTarget, setPromptTarget] = useState<AdminWorkspace | null>(null);
  const [promptData, setPromptData] = useState<WorkspacePromptData | null>(null);
  const [promptDraft, setPromptDraft] = useState('');
  const [promptRationale, setPromptRationale] = useState('');
  const [promptSubmitting, setPromptSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ws, mods] = await Promise.all([listWorkspaces(), listModels()]);
      setWorkspaces(ws);
      setModels(mods);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    } finally {
      setLoading(false);
    }
  }, [t.error]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Provision handlers
  const handlePreview = async () => {
    setProvisionSubmitting(true);
    try {
      const plan = await provisionWorkspace(provisionForm, true);
      setProvisionPlan(plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    } finally {
      setProvisionSubmitting(false);
    }
  };

  const handleDeploy = async () => {
    setProvisionSubmitting(true);
    try {
      await provisionWorkspace(provisionForm, false);
      setProvisionOpen(false);
      setProvisionPlan(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    } finally {
      setProvisionSubmitting(false);
    }
  };

  // Decommission handlers
  const openDecommission = async (ws: AdminWorkspace) => {
    setDecommTarget(ws);
    setDecommGates({ members: false, docs: false, irreversible: false });
    setDecommNameConfirm('');
    try {
      const plan = await decommissionWorkspace(ws.id, true);
      setDecommPlan(plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    }
  };

  const handleDecommission = async () => {
    if (!decommTarget) return;
    setDecommSubmitting(true);
    try {
      await decommissionWorkspace(decommTarget.id, false);
      setDecommTarget(null);
      setDecommPlan(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    } finally {
      setDecommSubmitting(false);
    }
  };

  // Prompt handlers
  const openPromptDialog = async (ws: AdminWorkspace) => {
    setPromptTarget(ws);
    setPromptRationale('');
    setPromptSubmitting(false);
    try {
      const data = await getWorkspacePrompt(ws.id);
      setPromptData(data);
      setPromptDraft(data.business_prompt);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    }
  };

  const handlePromptSave = async () => {
    if (!promptTarget || !promptDraft.trim()) return;
    setPromptSubmitting(true);
    try {
      const data = await updateWorkspacePrompt(promptTarget.id, promptDraft, promptRationale);
      setPromptData(data);
      setPromptDraft(data.business_prompt);
      setPromptRationale('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    } finally {
      setPromptSubmitting(false);
    }
  };

  const handlePromptRollback = async (version: number) => {
    if (!promptTarget) return;
    setPromptSubmitting(true);
    try {
      const data = await rollbackWorkspacePrompt(promptTarget.id, version);
      setPromptData(data);
      setPromptDraft(data.business_prompt);
      setPromptRationale('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    } finally {
      setPromptSubmitting(false);
    }
  };

  const decommAllGatesChecked =
    decommGates.members &&
    decommGates.docs &&
    decommGates.irreversible &&
    decommTarget !== null &&
    decommNameConfirm === decommTarget.name;

  const statusLabel = (s: string) => {
    const map: Record<string, string> = { ready: t.ready, provisioning: t.provisioning, archived: t.archived };
    return map[s] ?? s;
  };

  const typeLabel = (tp: string) => {
    const map: Record<string, string> = {
      standard: t.typeStandard,
      premium: t.typePremium,
      sandbox: t.typeSandbox,
      restricted: t.typeRestricted,
      shared: t.typeShared,
    };
    return map[tp] ?? tp;
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 h-8 w-64 animate-pulse rounded bg-gray-200" />
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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t.title}</h2>
          <p className="mt-1 text-sm text-gray-500">{t.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setProvisionOpen(true);
            setProvisionPlan(null);
            if (models.length > 0 && !provisionForm.model_id) {
              setProvisionForm((p) => ({ ...p, model_id: models[0].id }));
            }
          }}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {t.provision}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
          <button type="button" onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {workspaces.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border border-dashed border-gray-300 py-20">
          <p className="text-gray-500">{t.empty}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">{t.name}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">{t.client}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">{t.type}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">{t.status}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">{t.health}</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">{t.documents}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">{t.created}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {workspaces.map((ws) => (
                <motion.tr
                  key={ws.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-gray-50"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{ws.name}</td>
                  <td className="px-4 py-3 text-gray-600">{ws.client_name}</td>
                  <td className="px-4 py-3 text-gray-600">{typeLabel(ws.type)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[ws.status] ?? ''}`}>
                      {statusLabel(ws.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5">
                      <span
                        className={`inline-block h-2.5 w-2.5 rounded-full ${HEALTH_COLORS[ws.health] ?? 'bg-gray-300'}`}
                        aria-label={ws.health}
                      />
                      <span className="text-xs text-gray-500 capitalize">{ws.health}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                    {ws.document_count}/{ws.capacity_limit}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(ws.created_at).toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openPromptDialog(ws)}
                        className="rounded border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1"
                      >
                        {t.promptManage}
                      </button>
                      {ws.status !== 'archived' && (
                        <button
                          type="button"
                          onClick={() => openDecommission(ws)}
                          className="rounded border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1"
                        >
                          {t.decommission}
                        </button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Provision Dialog */}
      <AnimatePresence>
        {provisionOpen && (
          <Dialog
            open={provisionOpen}
            onClose={() => { setProvisionOpen(false); setProvisionPlan(null); }}
            title={t.provisionTitle}
          >
            <div className="space-y-4">
              <div>
                <label htmlFor="prov-type" className="mb-1 block text-sm font-medium text-gray-700">
                  {t.workspaceType}
                </label>
                <select
                  id="prov-type"
                  value={provisionForm.workspace_type}
                  onChange={(e) => setProvisionForm((p) => ({ ...p, workspace_type: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {WORKSPACE_TYPES.map((tp) => (
                    <option key={tp} value={tp}>{typeLabel(tp)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="prov-capacity" className="mb-1 block text-sm font-medium text-gray-700">
                  {t.capacityLimit}
                </label>
                <input
                  id="prov-capacity"
                  type="number"
                  min={10}
                  max={10000}
                  value={provisionForm.capacity_limit}
                  onChange={(e) => setProvisionForm((p) => ({ ...p, capacity_limit: Number(e.target.value) }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="prov-model" className="mb-1 block text-sm font-medium text-gray-700">
                  {t.selectModel}
                </label>
                <select
                  id="prov-model"
                  value={provisionForm.model_id}
                  onChange={(e) => setProvisionForm((p) => ({ ...p, model_id: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {models.filter((m) => m.active).map((m) => (
                    <option key={m.id} value={m.id}>{m.name} ({m.provider})</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="prov-tier" className="mb-1 block text-sm font-medium text-gray-700">
                  {t.escalationTier}
                </label>
                <select
                  id="prov-tier"
                  value={provisionForm.escalation_tier}
                  onChange={(e) => setProvisionForm((p) => ({ ...p, escalation_tier: e.target.value as ProvisionRequest['escalation_tier'] }))}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="auto">{t.tierAuto}</option>
                  <option value="review">{t.tierReview}</option>
                  <option value="human">{t.tierHuman}</option>
                </select>
              </div>

              <div>
                <label htmlFor="prov-chunk" className="mb-1 block text-sm font-medium text-gray-700">
                  {t.chunkingStrategy}
                </label>
                <select
                  id="prov-chunk"
                  value={provisionForm.chunking_strategy}
                  onChange={(e) => setProvisionForm((p) => ({ ...p, chunking_strategy: e.target.value as ProvisionRequest['chunking_strategy'] }))}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="default">{t.chunkDefault}</option>
                  <option value="legislation">{t.chunkLegislation}</option>
                  <option value="case_law">{t.chunkCaseLaw}</option>
                </select>
              </div>

              {/* Preview plan */}
              {provisionPlan && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <h4 className="mb-2 text-sm font-semibold text-blue-800">{t.previewTitle}</h4>
                  <table className="mb-3 w-full text-xs">
                    <thead>
                      <tr className="text-left text-blue-600">
                        <th className="pb-1">{t.resource}</th>
                        <th className="pb-1">{t.resourceType}</th>
                        <th className="pb-1">{t.resourceStatus}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {provisionPlan.resources.map((r, i) => (
                        <tr key={i} className="text-blue-900">
                          <td className="py-0.5">{r.name}</td>
                          <td className="py-0.5">{r.type}</td>
                          <td className="py-0.5">{r.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-sm font-medium text-blue-800">
                    {t.estimatedCost}: ${provisionPlan.estimated_cost_monthly.toLocaleString()}/mo
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setProvisionOpen(false); setProvisionPlan(null); }}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {t.cancel}
                </button>
                {!provisionPlan ? (
                  <button
                    type="button"
                    onClick={handlePreview}
                    disabled={provisionSubmitting || !provisionForm.model_id}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {t.preview}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleDeploy}
                    disabled={provisionSubmitting}
                    className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    {provisionSubmitting ? t.deploying : t.confirmDeploy}
                  </button>
                )}
              </div>
            </div>
          </Dialog>
        )}
      </AnimatePresence>

      {/* Prompt Dialog */}
      <AnimatePresence>
        {promptTarget && promptData && (
          <Dialog
            open={!!promptTarget}
            onClose={() => { setPromptTarget(null); setPromptData(null); }}
            title={`${t.promptTitle} — ${promptTarget.name}`}
          >
            <div className="space-y-4">
              {/* Current prompt editor */}
              <div>
                <label htmlFor="prompt-content" className="mb-1 block text-sm font-medium text-gray-700">
                  {t.promptCurrent} ({t.promptVersion} {promptData.business_prompt_version})
                </label>
                <textarea
                  id="prompt-content"
                  rows={8}
                  value={promptDraft}
                  onChange={(e) => setPromptDraft(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Rationale input */}
              <div>
                <label htmlFor="prompt-rationale" className="mb-1 block text-sm font-medium text-gray-700">
                  {t.promptRationale}
                </label>
                <input
                  id="prompt-rationale"
                  type="text"
                  value={promptRationale}
                  onChange={(e) => setPromptRationale(e.target.value)}
                  placeholder="e.g., Added OAS Regulation cross-references"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Save button */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handlePromptSave}
                  disabled={promptSubmitting || promptDraft === promptData.business_prompt || !promptDraft.trim()}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {promptSubmitting ? t.promptSaving : t.promptSave}
                </button>
              </div>

              {/* Version history */}
              <div>
                <h4 className="mb-2 text-sm font-semibold text-gray-700">{t.promptHistory}</h4>
                {promptData.business_prompt_history.length === 0 ? (
                  <p className="text-xs text-gray-400">{t.promptNoHistory}</p>
                ) : (
                  <div className="max-h-48 space-y-2 overflow-y-auto">
                    {[...promptData.business_prompt_history].reverse().map((entry) => (
                      <div
                        key={entry.version}
                        className={`rounded border p-2 text-xs ${
                          entry.version === promptData.business_prompt_version
                            ? 'border-blue-300 bg-blue-50'
                            : 'border-gray-200 bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-800">
                            v{entry.version}
                            {entry.version === promptData.business_prompt_version && (
                              <span className="ml-1.5 rounded-full bg-blue-200 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800">
                                current
                              </span>
                            )}
                          </span>
                          {entry.version !== promptData.business_prompt_version && (
                            <button
                              type="button"
                              onClick={() => handlePromptRollback(entry.version)}
                              disabled={promptSubmitting}
                              className="rounded border border-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                            >
                              {t.promptRollback}
                            </button>
                          )}
                        </div>
                        <div className="mt-1 text-gray-500">
                          <span>{t.promptAuthor}: {entry.author}</span>
                          <span className="mx-1.5">|</span>
                          <span>{t.promptDate}: {new Date(entry.created_at).toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA')}</span>
                        </div>
                        {entry.rationale && (
                          <p className="mt-1 text-gray-600 italic">{entry.rationale}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Close */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => { setPromptTarget(null); setPromptData(null); }}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {t.promptClose}
                </button>
              </div>
            </div>
          </Dialog>
        )}
      </AnimatePresence>

      {/* Decommission Dialog */}
      <AnimatePresence>
        {decommTarget && decommPlan && (
          <Dialog
            open={!!decommTarget}
            onClose={() => { setDecommTarget(null); setDecommPlan(null); }}
            title={t.decommissionTitle}
          >
            <div className="space-y-4">
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="mb-1 text-sm font-semibold text-red-800">{decommTarget.name}</p>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-red-700">
                  <dt className="font-medium">{t.membersToRemove}</dt>
                  <dd>{decommPlan.members_to_remove}</dd>
                  <dt className="font-medium">{t.docsToDelete}</dt>
                  <dd>{decommPlan.documents_to_delete}</dd>
                  <dt className="font-medium">{t.indexToPurge}</dt>
                  <dd>{decommPlan.index_entries_to_purge}</dd>
                </dl>
              </div>

              {/* Safety gates */}
              <div className="space-y-2">
                {([
                  { key: 'members' as const, label: t.gateMembersReviewed },
                  { key: 'docs' as const, label: t.gateDocsReviewed },
                  { key: 'irreversible' as const, label: t.gateIrreversible },
                ]).map((gate) => (
                  <label key={gate.key} className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={decommGates[gate.key]}
                      onChange={(e) => setDecommGates((g) => ({ ...g, [gate.key]: e.target.checked }))}
                      className="rounded border-gray-300"
                    />
                    {gate.label}
                  </label>
                ))}
              </div>

              <div>
                <label htmlFor="decomm-name" className="mb-1 block text-sm font-medium text-gray-700">
                  {t.typeNameToConfirm}
                </label>
                <input
                  id="decomm-name"
                  type="text"
                  value={decommNameConfirm}
                  onChange={(e) => setDecommNameConfirm(e.target.value)}
                  placeholder={decommTarget.name}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setDecommTarget(null); setDecommPlan(null); }}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  onClick={handleDecommission}
                  disabled={!decommAllGatesChecked || decommSubmitting}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {decommSubmitting ? t.decommissioning : t.confirmDecommission}
                </button>
              </div>
            </div>
          </Dialog>
        )}
      </AnimatePresence>
    </div>
  );
}
