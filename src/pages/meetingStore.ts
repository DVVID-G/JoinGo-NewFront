import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Meeting {
  id: string;
  code: string;
  name: string;
  date: string;
  startTime: string;
  endTime: string;
  createdBy: string;
  createdAt: string;
}

interface MeetingState {
  meetings: Meeting[];
  addMeeting: (meeting: Meeting) => void;
  removeMeeting: (id: string) => void;
  getMeetingByCode: (code: string) => Meeting | undefined;
  getUpcomingMeetings: () => Meeting[];
}

export const useMeetingStore = create<MeetingState>()(
  persist(
    (set, get) => ({
      meetings: [],
      addMeeting: (meeting) =>
        set((state) => ({
          meetings: [...state.meetings, meeting],
        })),
      removeMeeting: (id) =>
        set((state) => ({
          meetings: state.meetings.filter((m) => m.id !== id),
        })),
      getMeetingByCode: (code) => get().meetings.find((m) => m.code === code),
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
