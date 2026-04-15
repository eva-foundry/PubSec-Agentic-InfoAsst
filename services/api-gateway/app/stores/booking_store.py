"""In-memory booking store. Replaced by Cosmos DB adapter in production."""

from __future__ import annotations

from ..models.workspace import Booking


class BookingStore:
    """In-memory store for workspace bookings."""

    def __init__(self) -> None:
        self._bookings: dict[str, Booking] = {}
        self._seed()

    def _seed(self) -> None:
        """Pre-populate with bookings matching the demo walkthrough story."""
        seed = [
            Booking(
                id="bk-alice-oas",
                workspace_id="ws-oas-act",
                requester_id="demo-alice",
                status="active",
                start_date="2026-02-01",
                end_date="2026-06-30",
                entry_survey_completed=True,
                exit_survey_completed=False,
                created_at="2026-01-20T00:00:00Z",
                updated_at="2026-02-01T00:00:00Z",
            ),
            Booking(
                id="bk-alice-faq",
                workspace_id="ws-faq",
                requester_id="demo-alice",
                status="completed",
                start_date="2026-03-01",
                end_date="2026-03-31",
                entry_survey_completed=True,
                exit_survey_completed=True,
                created_at="2026-02-25T00:00:00Z",
                updated_at="2026-03-31T00:00:00Z",
            ),
            Booking(
                id="bk-eve-ei",
                workspace_id="ws-ei-juris",
                requester_id="demo-eve",
                status="active",
                start_date="2026-03-15",
                end_date="2026-07-31",
                entry_survey_completed=True,
                exit_survey_completed=False,
                created_at="2026-03-10T00:00:00Z",
                updated_at="2026-03-15T00:00:00Z",
            ),
        ]
        for bk in seed:
            self._bookings[bk.id] = bk

    def create(self, booking: Booking) -> Booking:
        """Store a new booking."""
        self._bookings[booking.id] = booking
        return booking

    def list_by_user(self, user_id: str) -> list[Booking]:
        """List all bookings for a specific user."""
        return [b for b in self._bookings.values() if b.requester_id == user_id]

    def list_by_workspace(self, workspace_id: str) -> list[Booking]:
        """List all bookings for a specific workspace."""
        return [b for b in self._bookings.values() if b.workspace_id == workspace_id]

    def list_all(self) -> list[Booking]:
        """List every booking."""
        return list(self._bookings.values())

    def get(self, booking_id: str) -> Booking | None:
        """Get a single booking by ID."""
        return self._bookings.get(booking_id)

    def update(self, booking_id: str, updates: dict) -> Booking | None:
        """Partially update a booking. Returns None if not found."""
        bk = self._bookings.get(booking_id)
        if bk is None:
            return None
        data = bk.model_dump()
        data.update(updates)
        updated = Booking(**data)
        self._bookings[booking_id] = updated
        return updated

    def delete(self, booking_id: str) -> bool:
        """Remove a booking from the store. Returns True if it existed."""
        return self._bookings.pop(booking_id, None) is not None
