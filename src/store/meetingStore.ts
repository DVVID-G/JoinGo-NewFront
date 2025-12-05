import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Lifecycle status for a meeting. */
export type MeetingStatus = 'active' | 'inactive' | 'closed';

/** Feature toggles per meeting as returned by backend metadata. */
export interface MeetingSettings {
  chat?: boolean;
  waitingRoom?: boolean;
  privateRoom?: boolean;
  screenSharing?: boolean;
  requirePassword?: boolean;
}

/**
 * Normalized meeting shape used across the client.
 */
export interface Meeting {
  id: string;
  code: string;
  meetingName: string;
  name: string;
  date: string;
  startTime: string;
  endTime: string;
  createdBy?: string;
  hostUid?: string;
  createdAt?: string;
  status?: MeetingStatus;
  maxParticipants?: number;
  participants?: string[];
  description?: string;
  duration?: string;
  settings?: MeetingSettings;
  metadata?: Record<string, unknown>;
  voiceRoomId?: string;
}

interface MeetingState {
  meetings: Meeting[];
  setMeetings: (meetings: Meeting[]) => void;
  upsertMeeting: (meeting: Meeting) => void;
  addMeeting: (meeting: Meeting) => void;
  removeMeeting: (id: string) => void;
  clearMeetings: () => void;
  getMeetingByCode: (code: string) => Meeting | undefined;
  getMeetingById: (id: string) => Meeting | undefined;
  getMeetingByIdOrCode: (idOrCode: string) => Meeting | undefined;
  getUpcomingMeetings: () => Meeting[];
}

/**
 * Persisted meeting store with helpers to upsert and query meetings.
 */
export const useMeetingStore = create<MeetingState>()(
  persist(
    (set, get) => ({
      meetings: [],
      setMeetings: (meetings) => set({ meetings }),
      upsertMeeting: (meeting) =>
        set((state) => {
          const index = state.meetings.findIndex((m) => m.id === meeting.id);
          if (index === -1) {
            return { meetings: [...state.meetings, meeting] };
          }
          const next = [...state.meetings];
          next[index] = { ...next[index], ...meeting };
          return { meetings: next };
        }),
      addMeeting: (meeting) =>
        set((state) => {
          const exists = state.meetings.some((m) => m.id === meeting.id);
          return {
            meetings: exists
              ? state.meetings.map((m) => (m.id === meeting.id ? meeting : m))
              : [...state.meetings, meeting],
          };
        }),
      removeMeeting: (id) =>
        set((state) => ({
          meetings: state.meetings.filter((m) => m.id !== id),
        })),
      clearMeetings: () => set({ meetings: [] }),
      getMeetingByCode: (code) => get().meetings.find((m) => m.code === code),
      getMeetingById: (id) => get().meetings.find((m) => m.id === id),
      getMeetingByIdOrCode: (idOrCode) => 
        get().meetings.find((m) => m.id === idOrCode || m.code === idOrCode),
      getUpcomingMeetings: () => {
        const now = new Date();
        return get()
          .meetings.filter((m) => {
            const meetingDate = new Date(`${m.date}T${m.endTime}`);
            return meetingDate >= now;
          })
          .sort((a, b) => {
            const dateA = new Date(`${a.date}T${a.startTime}`);
            const dateB = new Date(`${b.date}T${b.startTime}`);
            return dateA.getTime() - dateB.getTime();
          });
      },
    }),
    {
      name: 'joingo-meetings',
    }
  )
);
