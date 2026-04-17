// ---------------------------------------------------------------------------
// ClientOnboarding — Multi-step client onboarding wizard
// ---------------------------------------------------------------------------

import { useCallback, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { onboardClient, submitInterview } from '../api/client';

type Lang = 'en' | 'fr';

interface Props {
  lang: Lang;
}

// ---------------------------------------------------------------------------
// Bilingual strings
// ---------------------------------------------------------------------------

const S = {
  en: {
    title: 'Client Onboarding',
    subtitle: 'Register a new business client for EVA services',
    step1: 'Organization',
    step2: 'Identity',
    step3: 'Classification',
    step4: 'Interview',
    orgName: 'Organization Name',
    orgNamePlaceholder: 'e.g. ESDC Benefits Branch',
    billingEmail: 'Billing Contact Email',
    billingEmailPlaceholder: 'billing@example.gc.ca',
    entraGroup: 'Entra ID Group',
    entraGroupPlaceholder: 'SG-EVA-ClientName-Users',
    entraGroupHint: 'Azure AD security group for access control',
    classification: 'Data Classification Level',
    unclassified: 'Unclassified',
    protectedA: 'Protected A',
    protectedB: 'Protected B',
    classHintUnclassified: 'Public information with no security impact',
    classHintProtectedA: 'Could cause injury to an individual',
    classHintProtectedB: 'Could cause serious injury to an individual or organization',
    useCase: 'Use Case Description',
    useCasePlaceholder: 'Describe the primary use case for EVA...',
    dataSources: 'Data Sources',
    dataSourcesPlaceholder: 'List data sources, one per line...',
    expectedVolume: 'Expected Volume',
    volumeLow: 'Low (< 100 queries/day)',
    volumeMedium: 'Medium (100-1000 queries/day)',
    volumeHigh: 'High (> 1000 queries/day)',
    compliance: 'Compliance Requirements',
    compliancePlaceholder: 'Any specific compliance or regulatory requirements...',
    aicmNotes: 'AICM Assessment Notes',
    aicmNotesPlaceholder: 'Initial assessment notes for AI Competency Model...',
    recommendation: 'System Recommendation',
    archetype: 'Recommended Archetype',
    escalationTier: 'Escalation Tier',
    adjustBeforeConfirm: 'Adjust the recommendation before confirming if needed.',
    next: 'Next',
    back: 'Back',
    confirm: 'Confirm & Onboard',
    submitting: 'Submitting...',
    success: 'Client onboarded successfully!',
    error: 'Failed to onboard client',
    startAnother: 'Onboard Another Client',
    archetypeFaq: 'FAQ / Knowledge Base',
    archetypeAssistme: 'AssistMe / Legislation',
    archetypeJurisprudence: 'Jurisprudence / Case Law',
    archetypeEquivision: 'Equi\'Vision / Analytics',
    archetypeGovops: 'GovOps / Decision Support',
    tierAuto: 'Auto (Level 1 - Advisory)',
    tierReview: 'Review (Level 2 - Decision Informing)',
    tierHuman: 'Human (Level 3+ - Decision Making)',
    required: 'This field is required',
    invalidEmail: 'Enter a valid email address',
  },
  fr: {
    title: 'Integration du client',
    subtitle: 'Enregistrer un nouveau client pour les services EVA',
    step1: 'Organisation',
    step2: 'Identite',
    step3: 'Classification',
    step4: 'Entrevue',
    orgName: 'Nom de l\'organisation',
    orgNamePlaceholder: 'ex. Direction des prestations EDSC',
    billingEmail: 'Courriel de facturation',
    billingEmailPlaceholder: 'facturation@exemple.gc.ca',
    entraGroup: 'Groupe Entra ID',
    entraGroupPlaceholder: 'SG-EVA-NomClient-Utilisateurs',
    entraGroupHint: 'Groupe de securite Azure AD pour le controle d\'acces',
    classification: 'Niveau de classification des donnees',
    unclassified: 'Non classifie',
    protectedA: 'Protege A',
    protectedB: 'Protege B',
    classHintUnclassified: 'Information publique sans impact sur la securite',
    classHintProtectedA: 'Pourrait causer un prejudice a un individu',
    classHintProtectedB: 'Pourrait causer un prejudice grave a un individu ou une organisation',
    useCase: 'Description du cas d\'utilisation',
    useCasePlaceholder: 'Decrivez le cas d\'utilisation principal pour EVA...',
    dataSources: 'Sources de donnees',
    dataSourcesPlaceholder: 'Listez les sources de donnees, une par ligne...',
    expectedVolume: 'Volume prevu',
    volumeLow: 'Faible (< 100 requetes/jour)',
    volumeMedium: 'Moyen (100-1000 requetes/jour)',
    volumeHigh: 'Eleve (> 1000 requetes/jour)',
    compliance: 'Exigences de conformite',
    compliancePlaceholder: 'Exigences specifiques de conformite ou reglementaires...',
    aicmNotes: 'Notes d\'evaluation MCIA',
    aicmNotesPlaceholder: 'Notes initiales pour le Modele de competence en IA...',
    recommendation: 'Recommandation du systeme',
    archetype: 'Archetype recommande',
    escalationTier: 'Niveau d\'escalade',
    adjustBeforeConfirm: 'Ajustez la recommandation avant de confirmer si necessaire.',
    next: 'Suivant',
    back: 'Retour',
    confirm: 'Confirmer et integrer',
    submitting: 'Soumission...',
    success: 'Client integre avec succes!',
    error: 'Echec de l\'integration du client',
    startAnother: 'Integrer un autre client',
    archetypeFaq: 'FAQ / Base de connaissances',
    archetypeAssistme: 'AssistMe / Legislation',
    archetypeJurisprudence: 'Jurisprudence / Droit',
    archetypeEquivision: 'Equi\'Vision / Analytique',
    archetypeGovops: 'GovOps / Aide a la decision',
    tierAuto: 'Auto (Niveau 1 - Consultatif)',
    tierReview: 'Revision (Niveau 2 - Eclairage decisionnnel)',
    tierHuman: 'Humain (Niveau 3+ - Prise de decision)',
    required: 'Ce champ est requis',
    invalidEmail: 'Entrez une adresse courriel valide',
  },
};

// ---------------------------------------------------------------------------
// Archetype / escalation inference from use case keywords
// ---------------------------------------------------------------------------

const ARCHETYPE_KEYWORDS: Array<{ keywords: string[]; archetype: string; tier: string }> = [
  { keywords: ['decision', 'approve', 'reject', 'adjudic', 'ruling', 'tribunal'], archetype: 'govops', tier: 'human' },
  { keywords: ['jurisprudence', 'case law', 'court', 'appeal', 'precedent'], archetype: 'jurisprudence', tier: 'review' },
  { keywords: ['legislation', 'act', 'regulation', 'statute', 'section'], archetype: 'assistme', tier: 'review' },
  { keywords: ['dashboard', 'analytics', 'power bi', 'chart', 'metric', 'report'], archetype: 'equivision', tier: 'auto' },
  { keywords: ['faq', 'knowledge base', 'help', 'question', 'answer', 'search'], archetype: 'faq', tier: 'auto' },
];

function inferRecommendation(useCase: string): { archetype: string; tier: string } {
  const lower = useCase.toLowerCase();
  for (const rule of ARCHETYPE_KEYWORDS) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return { archetype: rule.archetype, tier: rule.tier };
    }
  }
  return { archetype: 'faq', tier: 'auto' };
}

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface FormState {
  // Step 1
  orgName: string;
  billingEmail: string;
  // Step 2
  entraGroup: string;
  // Step 3
  classification: 'unclassified' | 'protected_a' | 'protected_b';
  // Step 4
  useCase: string;
  dataSources: string;
  expectedVolume: 'low' | 'medium' | 'high';
  compliance: string;
  aicmNotes: string;
  // Recommendation (editable)
  archetype: string;
  escalationTier: string;
}

const INITIAL_FORM: FormState = {
  orgName: '',
  billingEmail: '',
  entraGroup: '',
  classification: 'unclassified',
  useCase: '',
  dataSources: '',
  expectedVolume: 'low',
  compliance: '',
  aicmNotes: '',
  archetype: 'faq',
  escalationTier: 'auto',
};

// ---------------------------------------------------------------------------
// Animation config
// ---------------------------------------------------------------------------

const pageVariants = {
  enter: { opacity: 0, y: 12 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ClientOnboarding({ lang }: Props) {
  const t = S[lang];
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [direction, setDirection] = useState(1);

  const STEPS = [t.step1, t.step2, t.step3, t.step4];

  const update = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  // After step 4, compute recommendation
  const recommendation = useMemo(
    () => inferRecommendation(form.useCase),
    [form.useCase],
  );

  const goNext = () => {
    if (step === 3) {
      // Apply system recommendation (user can override)
      setForm((prev) => ({
        ...prev,
        archetype: recommendation.archetype,
        escalationTier: recommendation.tier,
      }));
    }
    setDirection(1);
    setStep((s) => Math.min(s + 1, 4));
  };

  const goBack = () => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const client = await onboardClient({
        org_name: form.orgName,
        billing_contact_email: form.billingEmail,
        entra_id_group: form.entraGroup,
        data_classification: form.classification,
      });
      await submitInterview({
        client_id: client.id,
        use_case_description: form.useCase,
        data_sources: form.dataSources,
        expected_volume: form.expectedVolume,
        compliance_requirements: form.compliance,
        aicm_assessment_notes: form.aicmNotes,
        recommended_archetype: form.archetype,
        escalation_tier: form.escalationTier,
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setForm(INITIAL_FORM);
    setStep(0);
    setSuccess(false);
    setError(null);
  };

  // Validation per step
  const isStepValid = useMemo(() => {
    switch (step) {
      case 0:
        return form.orgName.trim().length > 0 && /^[^@]+@[^@]+\.[^@]+$/.test(form.billingEmail);
      case 1:
        return form.entraGroup.trim().length > 0;
      case 2:
        return true;
      case 3:
        return form.useCase.trim().length > 0;
      default:
        return true;
    }
  }, [step, form]);

  const archetypeLabels: Record<string, string> = {
    faq: t.archetypeFaq,
    assistme: t.archetypeAssistme,
    jurisprudence: t.archetypeJurisprudence,
    equivision: t.archetypeEquivision,
    govops: t.archetypeGovops,
  };

  const tierLabels: Record<string, string> = {
    auto: t.tierAuto,
    review: t.tierReview,
    human: t.tierHuman,
  };

  // Success screen
  if (success) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-lg border border-green-200 bg-green-50 p-8 text-center"
        >
          <div className="mb-4 text-4xl" aria-hidden="true">&#10003;</div>
          <h2 className="mb-2 text-xl font-semibold text-green-800">{t.success}</h2>
          <button
            type="button"
            onClick={resetForm}
            className="mt-6 rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {t.startAnother}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">{t.title}</h2>
        <p className="mt-1 text-sm text-gray-500">{t.subtitle}</p>
      </div>

      {/* Step indicator */}
      <nav aria-label="Progress" className="mb-8">
        <ol className="flex items-center">
          {STEPS.map((label, i) => (
            <li key={i} className="relative flex flex-1 items-center">
              {/* Connector line */}
              {i > 0 && (
                <div className="absolute left-0 right-1/2 top-4 -translate-y-1/2">
                  <div className="h-0.5 w-full bg-gray-200">
                    <motion.div
                      className="h-full bg-blue-600"
                      initial={{ width: 0 }}
                      animate={{ width: i <= step ? '100%' : '0%' }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>
              )}
              {i < STEPS.length - 1 && (
                <div className="absolute left-1/2 right-0 top-4 -translate-y-1/2">
                  <div className="h-0.5 w-full bg-gray-200">
                    <motion.div
                      className="h-full bg-blue-600"
                      initial={{ width: 0 }}
                      animate={{ width: i < step ? '100%' : '0%' }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>
              )}
              {/* Node */}
              <div className="relative z-10 flex w-full flex-col items-center">
                <motion.div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors ${
                    i <= step
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-gray-300 bg-white text-gray-400'
                  }`}
                  animate={{ scale: i === step ? 1.1 : 1 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                  aria-current={i === step ? 'step' : undefined}
                >
                  {i < step ? '\u2713' : i + 1}
                </motion.div>
                <span
                  className={`mt-1.5 text-xs font-medium ${
                    i <= step ? 'text-blue-600' : 'text-gray-400'
                  }`}
                >
                  {label}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </nav>

      {/* Step content with animation */}
      <AnimatePresence mode="wait" custom={direction}>
        {step === 0 && (
          <motion.div
            key="step0"
            custom={direction}
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2 }}
            className="space-y-5"
          >
            <div>
              <label htmlFor="org-name" className="mb-1 block text-sm font-medium text-gray-700">
                {t.orgName} <span className="text-red-500">*</span>
              </label>
              <input
                id="org-name"
                type="text"
                value={form.orgName}
                onChange={(e) => update('orgName', e.target.value)}
                placeholder={t.orgNamePlaceholder}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label htmlFor="billing-email" className="mb-1 block text-sm font-medium text-gray-700">
                {t.billingEmail} <span className="text-red-500">*</span>
              </label>
              <input
                id="billing-email"
                type="email"
                value={form.billingEmail}
                onChange={(e) => update('billingEmail', e.target.value)}
                placeholder={t.billingEmailPlaceholder}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div
            key="step1"
            custom={direction}
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2 }}
            className="space-y-5"
          >
            <div>
              <label htmlFor="entra-group" className="mb-1 block text-sm font-medium text-gray-700">
                {t.entraGroup} <span className="text-red-500">*</span>
              </label>
              <input
                id="entra-group"
                type="text"
                value={form.entraGroup}
                onChange={(e) => update('entraGroup', e.target.value)}
                placeholder={t.entraGroupPlaceholder}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
              <p className="mt-1 text-xs text-gray-400">{t.entraGroupHint}</p>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            custom={direction}
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2 }}
            className="space-y-5"
          >
            <fieldset>
              <legend className="mb-3 text-sm font-medium text-gray-700">
                {t.classification} <span className="text-red-500">*</span>
              </legend>
              {([
                { value: 'unclassified', label: t.unclassified, hint: t.classHintUnclassified },
                { value: 'protected_a', label: t.protectedA, hint: t.classHintProtectedA },
                { value: 'protected_b', label: t.protectedB, hint: t.classHintProtectedB },
              ] as const).map((opt) => (
                <label
                  key={opt.value}
                  className={`mb-2 flex cursor-pointer items-start rounded-lg border p-4 transition-colors ${
                    form.classification === opt.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="classification"
                    value={opt.value}
                    checked={form.classification === opt.value}
                    onChange={() => update('classification', opt.value)}
                    className="mt-0.5 mr-3"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">{opt.label}</span>
                    <p className="mt-0.5 text-xs text-gray-500">{opt.hint}</p>
                  </div>
                </label>
              ))}
            </fieldset>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            key="step3"
            custom={direction}
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2 }}
            className="space-y-5"
          >
            <div>
              <label htmlFor="use-case" className="mb-1 block text-sm font-medium text-gray-700">
                {t.useCase} <span className="text-red-500">*</span>
              </label>
              <textarea
                id="use-case"
                rows={3}
                value={form.useCase}
                onChange={(e) => update('useCase', e.target.value)}
                placeholder={t.useCasePlaceholder}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label htmlFor="data-sources" className="mb-1 block text-sm font-medium text-gray-700">
                {t.dataSources}
              </label>
              <textarea
                id="data-sources"
                rows={3}
                value={form.dataSources}
                onChange={(e) => update('dataSources', e.target.value)}
                placeholder={t.dataSourcesPlaceholder}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="expected-volume" className="mb-1 block text-sm font-medium text-gray-700">
                {t.expectedVolume}
              </label>
              <select
                id="expected-volume"
                value={form.expectedVolume}
                onChange={(e) => update('expectedVolume', e.target.value as FormState['expectedVolume'])}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="low">{t.volumeLow}</option>
                <option value="medium">{t.volumeMedium}</option>
                <option value="high">{t.volumeHigh}</option>
              </select>
            </div>
            <div>
              <label htmlFor="compliance" className="mb-1 block text-sm font-medium text-gray-700">
                {t.compliance}
              </label>
              <textarea
                id="compliance"
                rows={2}
                value={form.compliance}
                onChange={(e) => update('compliance', e.target.value)}
                placeholder={t.compliancePlaceholder}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="aicm-notes" className="mb-1 block text-sm font-medium text-gray-700">
                {t.aicmNotes}
              </label>
              <textarea
                id="aicm-notes"
                rows={2}
                value={form.aicmNotes}
                onChange={(e) => update('aicmNotes', e.target.value)}
                placeholder={t.aicmNotesPlaceholder}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </motion.div>
        )}

        {/* Step 4 (index 4): Recommendation review */}
        {step === 4 && (
          <motion.div
            key="step4"
            custom={direction}
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2 }}
            className="space-y-5"
          >
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-5">
              <h3 className="mb-3 text-sm font-semibold text-blue-800">{t.recommendation}</h3>
              <p className="mb-4 text-xs text-blue-600">{t.adjustBeforeConfirm}</p>
              <div className="space-y-4">
                <div>
                  <label htmlFor="archetype" className="mb-1 block text-sm font-medium text-gray-700">
                    {t.archetype}
                  </label>
                  <select
                    id="archetype"
                    value={form.archetype}
                    onChange={(e) => update('archetype', e.target.value)}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {Object.entries(archetypeLabels).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="escalation-tier" className="mb-1 block text-sm font-medium text-gray-700">
                    {t.escalationTier}
                  </label>
                  <select
                    id="escalation-tier"
                    value={form.escalationTier}
                    onChange={(e) => update('escalationTier', e.target.value)}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {Object.entries(tierLabels).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="font-medium text-gray-500">{t.orgName}</dt>
                <dd className="text-gray-900">{form.orgName}</dd>
                <dt className="font-medium text-gray-500">{t.billingEmail}</dt>
                <dd className="text-gray-900">{form.billingEmail}</dd>
                <dt className="font-medium text-gray-500">{t.entraGroup}</dt>
                <dd className="text-gray-900">{form.entraGroup}</dd>
                <dt className="font-medium text-gray-500">{t.classification}</dt>
                <dd className="text-gray-900">{form.classification}</dd>
                <dt className="font-medium text-gray-500">{t.expectedVolume}</dt>
                <dd className="text-gray-900">{form.expectedVolume}</dd>
              </dl>
            </div>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
                {error}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation buttons */}
      <div className="mt-8 flex justify-between">
        {step > 0 ? (
          <button
            type="button"
            onClick={goBack}
            className="rounded-md border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {t.back}
          </button>
        ) : (
          <div />
        )}
        {step < 4 ? (
          <button
            type="button"
            onClick={goNext}
            disabled={!isStepValid}
            className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t.next}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-md bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? t.submitting : t.confirm}
          </button>
        )}
      </div>
    </div>
  );
}
