"""In-memory survey store. Replaced by Cosmos DB adapter in production."""

from __future__ import annotations

from ..models.workspace import EntrySurvey, ExitSurvey


class SurveyStore:
    """In-memory store for entry and exit surveys."""

    def __init__(self) -> None:
        self._entry_surveys: dict[str, EntrySurvey] = {}
        self._exit_surveys: dict[str, ExitSurvey] = {}
        self._seed()

    def _seed(self) -> None:
        """Pre-populate with surveys matching the demo walkthrough bookings."""
        # Entry surveys for all 3 seeded bookings
        entry_surveys = [
            EntrySurvey(
                id="es-alice-oas",
                booking_id="bk-alice-oas",
                use_case="Legislative analysis of Old Age Security Act provisions for adjudicators",
                expected_users=8,
                expected_data_volume_gb=2.5,
                data_classification="protected_b",
                business_justification="OAS adjudicators need AI-assisted search across the Act and regulations to resolve complex eligibility questions faster.",
                completed_at="2026-01-25T14:30:00Z",
            ),
            EntrySurvey(
                id="es-alice-faq",
                booking_id="bk-alice-faq",
                use_case="General FAQ for onboarding new team members to EVA platform",
                expected_users=15,
                expected_data_volume_gb=0.5,
                data_classification="unclassified",
                business_justification="New hires need self-service access to platform documentation and common procedures.",
                completed_at="2026-02-26T10:00:00Z",
            ),
            EntrySurvey(
                id="es-eve-ei",
                booking_id="bk-eve-ei",
                use_case="EI tribunal decision research and case law analysis",
                expected_users=5,
                expected_data_volume_gb=4.0,
                data_classification="protected_b",
                business_justification="Appeals officers require citation-aware search across EI tribunal decisions to identify precedents and maintain consistency.",
                completed_at="2026-03-12T09:15:00Z",
            ),
        ]
        for s in entry_surveys:
            self._entry_surveys[s.id] = s

        # Exit survey for the completed bk-alice-faq booking
        exit_surveys = [
            ExitSurvey(
                id="xs-alice-faq",
                booking_id="bk-alice-faq",
                satisfaction_rating=4,
                objectives_met=True,
                data_disposition="archive",
                feedback="Good experience overall. The FAQ workspace helped new team members get up to speed quickly. Would benefit from better bilingual support.",
                would_recommend=True,
                completed_at="2026-03-31T16:00:00Z",
            ),
        ]
        for s in exit_surveys:
            self._exit_surveys[s.id] = s

    def create_entry(self, survey: EntrySurvey) -> EntrySurvey:
        """Store an entry survey."""
        self._entry_surveys[survey.id] = survey
        return survey

    def create_exit(self, survey: ExitSurvey) -> ExitSurvey:
        """Store an exit survey."""
        self._exit_surveys[survey.id] = survey
        return survey

    def get_entry_by_booking(self, booking_id: str) -> EntrySurvey | None:
        """Find an entry survey by its booking_id."""
        for s in self._entry_surveys.values():
            if s.booking_id == booking_id:
                return s
        return None

    def get_exit_by_booking(self, booking_id: str) -> ExitSurvey | None:
        """Find an exit survey by its booking_id."""
        for s in self._exit_surveys.values():
            if s.booking_id == booking_id:
                return s
        return None
