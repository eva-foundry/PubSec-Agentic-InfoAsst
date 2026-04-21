import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/contexts/ApiProvider";
import type { Booking, TeamMember } from "@/lib/api/types";
import { qk } from "@/lib/api/keys";

export const useBookings = () => {
  const client = useApiClient();
  return useQuery({
    queryKey: qk.bookings.list(),
    queryFn: () => client.get<Booking[]>("/v1/aia/bookings"),
  });
};

export const useTeamMembers = (bookingId: string | null) => {
  const client = useApiClient();
  return useQuery({
    queryKey: qk.teams.members(bookingId ?? "__none__"),
    queryFn: () =>
      client.get<TeamMember[]>(`/v1/aia/teams/${bookingId}/members`),
    enabled: !!bookingId,
  });
};

export interface AddMemberInput {
  bookingId: string;
  email: string;
  name: string;
  role: "reader" | "contributor" | "admin";
}

export const useAddTeamMember = () => {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, email, name, role }: AddMemberInput) =>
      client.post<TeamMember>(`/v1/aia/teams/${bookingId}/members`, {
        email, name, role,
      }),
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: qk.teams.members(vars.bookingId) }),
  });
};

export interface UpdateRoleInput {
  bookingId: string;
  userId: string;
  role: "reader" | "contributor" | "admin";
}

export const useUpdateMemberRole = () => {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, userId, role }: UpdateRoleInput) =>
      client.patch<TeamMember>(
        `/v1/aia/teams/${bookingId}/members/${userId}`,
        { role },
      ),
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: qk.teams.members(vars.bookingId) }),
  });
};

export interface RemoveMemberInput {
  bookingId: string;
  userId: string;
}

export const useRemoveTeamMember = () => {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, userId }: RemoveMemberInput) =>
      client.del<void>(`/v1/aia/teams/${bookingId}/members/${userId}`),
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: qk.teams.members(vars.bookingId) }),
  });
};
