"""In-memory survey store. Replaced by Cosmos DB adapter in production."""

from __future__ import annotations

from ..models.workspace import EntrySurvey, ExitSurvey


class SurveyStore:
    """In-memory store for entry and exit surveys."""

    def __init__(self) -> None:
        self._entry_surveys: dict[str, EntrySurvey] = {}
        self._exit_surveys: dict[str, ExitSurvey] = {}

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
