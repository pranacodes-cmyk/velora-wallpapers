import { createContext, useContext } from "react";

interface OnboardingContextType {
  isOnboardingActive: boolean;
}

export const OnboardingContext = createContext<OnboardingContextType>({ isOnboardingActive: false });

export function useIsOnboardingActive() {
  return useContext(OnboardingContext).isOnboardingActive;
}
