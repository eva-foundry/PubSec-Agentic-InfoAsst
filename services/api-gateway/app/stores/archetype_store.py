"""In-memory archetype catalog. Ops can add/retire archetypes without a UI release."""

from __future__ import annotations

from ..models.archetype import ArchetypeDefinition


class ArchetypeStore:
    """Seeded with the five archetypes the platform supports today."""

    def __init__(self) -> None:
        self._archetypes: dict[str, ArchetypeDefinition] = {}
        self._seed()

    def _seed(self) -> None:
        seed: list[ArchetypeDefinition] = [
            ArchetypeDefinition(
                key="kb",
                name="Knowledge Base",
                name_fr="Base de connaissances",
                description="FAQ-style retrieval over a curated corpus.",
                description_fr="Recuperation de type FAQ sur un corpus organise.",
                assurance="Advisory",
                cost_band="$49-$120/mo",
                sample_questions=[
                    "What is the parental leave policy?",
                    "How do I request a new laptop?",
                ],
                sample_questions_fr=[
                    "Quelle est la politique de conge parental?",
                    "Comment demander un nouvel ordinateur portable?",
                ],
                default_capacity=25,
            ),
            ArchetypeDefinition(
                key="policy",
                name="Policy Library",
                name_fr="Bibliotheque de politiques",
                description="Hierarchical document retrieval with section-level citations.",
                description_fr="Recuperation hierarchique avec citations au niveau de la section.",
                assurance="Decision-informing",
                cost_band="$120-$340/mo",
                sample_questions=[
                    "Which runbook applies to a Postgres failover?",
                    "Show me incident severity definitions.",
                ],
                sample_questions_fr=[
                    "Quel manuel s'applique a une bascule Postgres?",
                    "Montrez-moi les definitions de severite des incidents.",
                ],
                default_capacity=15,
            ),
            ArchetypeDefinition(
                key="case",
                name="Case Archive",
                name_fr="Archives de cas",
                description="Citation graphs + precedent ranking across long-form documents.",
                description_fr=(
                    "Graphes de citations et classement des precedents sur documents longs."
                ),
                assurance="Decision-informing",
                cost_band="$340-$1.2K/mo",
                sample_questions=[
                    "Find precedents for force-majeure clauses in SaaS contracts.",
                    "Summarize prior rulings on data-residency.",
                ],
                sample_questions_fr=[
                    "Trouver les precedents sur les clauses de force majeure.",
                    "Resumer les decisions anterieures sur la residence des donnees.",
                ],
                default_capacity=10,
            ),
            ArchetypeDefinition(
                key="bi",
                name="BI Copilot",
                name_fr="Copilote BI",
                description="Dashboard interpretation, metric explanations, anomaly drill-downs.",
                description_fr=(
                    "Interpretation de tableaux de bord, explications de metriques, "
                    "analyses d'anomalies."
                ),
                assurance="Advisory",
                cost_band="$220-$680/mo",
                sample_questions=[
                    "Why did Q1 ARR dip in EMEA?",
                    "Explain the churn cohort chart.",
                ],
                sample_questions_fr=[
                    "Pourquoi le RRA du T1 a-t-il baisse en EMEA?",
                    "Expliquez le graphique de cohorte de desabonnement.",
                ],
                default_capacity=20,
            ),
            ArchetypeDefinition(
                key="decision",
                name="Decision Support",
                name_fr="Aide a la decision",
                description="Rule-engine-backed answers with mandatory HITL gates.",
                description_fr=(
                    "Reponses soutenues par un moteur de regles avec controles "
                    "humains obligatoires."
                ),
                assurance="Decision-informing",
                cost_band="$480-$2.4K/mo",
                sample_questions=[
                    "Should we onboard vendor X under SOC2 type-1 only?",
                    "Approve cross-border data transfer for EU customer?",
                ],
                sample_questions_fr=[
                    "Devrions-nous integrer le fournisseur X uniquement en SOC2 type-1?",
                    "Approuver le transfert de donnees transfrontalier pour un client UE?",
                ],
                default_capacity=8,
            ),
        ]
        for a in seed:
            self._archetypes[a.key] = a

    def list(self) -> list[ArchetypeDefinition]:
        return list(self._archetypes.values())

    def get(self, key: str) -> ArchetypeDefinition | None:
        return self._archetypes.get(key)
