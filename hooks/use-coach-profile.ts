import { useAuth } from "@clerk/clerk-expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

import type { CoachProfileData } from "../components/CoachProfileForm";
import { apiRequest } from "../lib/api-client";

const COACH_PROFILE_QUERY_KEY = ["coach-profile"] as const;

export type UseCoachProfileResult = {
  profile: CoachProfileData | null | undefined;
  loadingProfile: boolean;
  profileChecked: boolean;
  needsProfile: boolean;
  showProfileModal: boolean;
  setShowProfileModal: (visible: boolean) => void;
  openProfileModal: () => void;
  closeProfileModal: () => void;
  dismissProfileModal: () => void;
  handleProfileSave: (data: CoachProfileData) => Promise<void>;
  profileSaving: boolean;
  profileSaveError: Error | null;
};

export function useCoachProfile(): UseCoachProfileResult {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [showProfileModal, setShowProfileModalState] = useState(false);
  const [profilePromptDismissed, setProfilePromptDismissed] = useState(false);

  const {
    data: profile,
    isLoading: loadingProfile,
  } = useQuery<CoachProfileData | null>({
    queryKey: COACH_PROFILE_QUERY_KEY,
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      return apiRequest<CoachProfileData | null>("/api/coach/profile", {
        token,
      });
    },
  });

  const profileChecked = !loadingProfile && profile !== undefined;
  const needsProfile = profileChecked && profile === null;

  useEffect(() => {
    if (profile != null) {
      setProfilePromptDismissed(false);
    }
  }, [profile]);

  useEffect(() => {
    if (needsProfile && !showProfileModal && !profilePromptDismissed) {
      setShowProfileModalState(true);
    }
  }, [needsProfile, profilePromptDismissed, showProfileModal]);

  const setShowProfileModal = useCallback(
    (visible: boolean) => {
      if (!visible && needsProfile) {
        setProfilePromptDismissed(true);
      }
      setShowProfileModalState(visible);
    },
    [needsProfile]
  );

  const saveProfileMutation = useMutation({
    mutationFn: async (data: CoachProfileData) => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      return apiRequest<CoachProfileData>("/api/coach/profile", {
        method: "PUT",
        token,
        body: JSON.stringify(data),
      });
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(COACH_PROFILE_QUERY_KEY, updated);
      setProfilePromptDismissed(false);
      setShowProfileModalState(false);
    },
  });

  const openProfileModal = useCallback(() => {
    saveProfileMutation.reset();
    setShowProfileModalState(true);
  }, [saveProfileMutation]);

  const dismissProfileModal = useCallback(() => {
    saveProfileMutation.reset();
    setProfilePromptDismissed(true);
    setShowProfileModalState(false);
  }, [saveProfileMutation]);

  const closeProfileModal = useCallback(() => {
    saveProfileMutation.reset();
    if (needsProfile) {
      setProfilePromptDismissed(true);
    }
    setShowProfileModalState(false);
  }, [needsProfile, saveProfileMutation]);

  const handleProfileSave = useCallback(
    async (data: CoachProfileData) => {
      try {
        await saveProfileMutation.mutateAsync(data);
      } catch {
        // The mutation stores the error for the form to render inline.
      }
    },
    [saveProfileMutation]
  );

  const profileSaveError = saveProfileMutation.error instanceof Error
    ? saveProfileMutation.error
    : null;

  return {
    profile,
    loadingProfile,
    profileChecked,
    needsProfile,
    showProfileModal,
    setShowProfileModal,
    openProfileModal,
    closeProfileModal,
    dismissProfileModal,
    handleProfileSave,
    profileSaving: saveProfileMutation.isPending,
    profileSaveError,
  };
}
