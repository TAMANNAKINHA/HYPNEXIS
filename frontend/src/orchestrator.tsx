/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { initialState, reducer, type Action } from './state';
import { initializeSocket, disconnectSocket } from './services/socket';
import * as api from './services/api';
import type { AegisState } from './types';

type AegisContextType = {
  state: AegisState;
  dispatch: React.Dispatch<Action>;
};

const AegisContext = createContext<AegisContextType | undefined>(undefined);

export function AegisProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState());

  useEffect(() => {
    initializeSocket(dispatch);
    return () => {
      disconnectSocket();
    };
  }, []);

  return (
    <AegisContext.Provider value={{ state, dispatch }}>
      {children}
    </AegisContext.Provider>
  );
}

export function useAegis() {
  const context = useContext(AegisContext);
  if (context === undefined) {
    throw new Error('useAegis must be used within an AegisProvider');
  }
  return context;
}

export function useOrchestrator() {
  const { state, dispatch } = useAegis();

  const createMission = async (userPrompt: string) => {
    try {
      const res = await api.createMission(userPrompt);
      // Now res is typed as CreateMissionResponse, so res.mission.id exists
      if (res.mission?.id) {
        dispatch({ type: 'SELECT_MISSION', payload: res.mission.id });
      }
    } catch (error) {
      console.error('Failed to create mission:', error);
      throw error;
    }
  };

  const executeMission = async (missionId: string) => {
    try {
      await api.executeMission(missionId);
    } catch (error) {
      console.error('Failed to execute mission:', error);
      throw error;
    }
  };

  const cancelMission = async (missionId: string) => {
    try {
      await api.cancelMission(missionId);
    } catch (error) {
      console.error('Failed to cancel mission:', error);
      throw error;
    }
  };

  const freezeWallet = async (missionId: string) => {
    try {
      await api.freezeWallet(missionId);
    } catch (error) {
      console.error('Failed to freeze wallet:', error);
      throw error;
    }
  };

  const unfreezeWallet = async (missionId: string) => {
    try {
      await api.unfreezeWallet(missionId);
    } catch (error) {
      console.error('Failed to unfreeze wallet:', error);
      throw error;
    }
  };

  const nukeWallet = async (missionId: string) => {
    try {
      await api.nukeWallet(missionId);
    } catch (error) {
      console.error('Failed to nuke wallet:', error);
      throw error;
    }
  };

  const rotateSessionKey = async (missionId: string) => {
    try {
      await api.rotateSessionKey(missionId);
    } catch (error) {
      console.error('Failed to rotate session key:', error);
      throw error;
    }
  };

  const cancelPendingTx = async () => {
    try {
      await api.cancelPendingTx();
    } catch (error) {
      console.error('Failed to cancel pending transaction:', error);
      throw error;
    }
  };

  const togglePolicy = async (policyId: string) => {
    try {
      await api.togglePolicy(policyId);
    } catch (error) {
      console.error('Failed to toggle policy:', error);
      throw error;
    }
  };

  const resetDemo = async () => {
    try {
      await api.resetDemo();
    } catch (error) {
      console.error('Failed to reset demo:', error);
      throw error;
    }
  };

  const verifyOtp = async (missionId: string, otp: string) => {
    try {
      await api.verifyOtp(missionId, otp);
    } catch (error) {
      console.error('Failed to verify OTP:', error);
      throw error;
    }
  };

  const rejectVerification = async (missionId: string) => {
    try {
      await api.rejectVerification(missionId);
    } catch (error) {
      console.error('Failed to reject verification:', error);
      throw error;
    }
  };

  const approveVerification = async (missionId: string) => {
    try {
      await api.approveVerification(missionId);
    } catch (error) {
      console.error('Failed to approve verification:', error);
      throw error;
    }
  };

  const simulatePromptInjection = async (missionId?: string) => {
    try {
      await api.simulatePromptInjection(missionId);
    } catch (error) {
      console.error('Failed to simulate prompt injection:', error);
      throw error;
    }
  };

  const simulateStolenKey = async (missionId?: string) => {
    try {
      await api.simulateStolenKey(missionId);
    } catch (error) {
      console.error('Failed to simulate stolen key:', error);
      throw error;
    }
  };

  const launchSpamAttack = async (missionId?: string) => {
    try {
      await api.launchSpamAttack(missionId);
    } catch (error) {
      console.error('Failed to launch spam attack:', error);
      throw error;
    }
  };

  return {
    createMission,
    executeMission,
    cancelMission,
    freezeWallet,
    unfreezeWallet,
    nukeWallet,
    rotateSessionKey,
    cancelPendingTx,
    togglePolicy,
    resetDemo,
    verifyOtp,
    rejectVerification,
    approveVerification,
    simulatePromptInjection,
    simulateStolenKey,
    launchSpamAttack,
    state,
    dispatch,
  };
}