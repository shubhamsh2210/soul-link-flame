import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithQuery } from "@/test/helpers";

const h = vi.hoisted(() => ({
  getSessionRoom: vi.fn().mockResolvedValue({
    token: "lk-token",
    serverUrl: "wss://livekit.test",
    roomName: "session-s1",
    peerName: "Grace",
    isRound1Candidate: false,
    question: { prompt_text: "Design a metric for onboarding.", difficulty: "medium" },
    session: {
      id: "s1",
      status: "room_created",
      startedAt: new Date().toISOString(),
      roundSwapAt: null,
      endedAt: null,
    },
  }),
  advanceSession: vi.fn().mockResolvedValue({ status: "round_1" }),
  checkNoShow: vi.fn().mockResolvedValue(null),
}));

vi.mock("@tanstack/react-router", async () =>
  (await import("@/test/helpers")).routerMock({ sessionId: "s1" }),
);

vi.mock("@livekit/components-styles", () => ({}));
vi.mock("livekit-client", () => ({ Track: { Source: { Camera: "camera", ScreenShare: "screen" } } }));
vi.mock("@livekit/components-react", () => ({
  LiveKitRoom: ({ children, token, serverUrl }: React.PropsWithChildren<{ token: string; serverUrl: string }>) => (
    <div data-testid="livekit-room" data-token={token} data-server-url={serverUrl}>
      {children}
    </div>
  ),
  GridLayout: ({ children }: React.PropsWithChildren) => <div data-testid="grid">{children}</div>,
  ParticipantTile: () => <div data-testid="tile" />,
  RoomAudioRenderer: () => null,
  ControlBar: () => <div data-testid="controls" />,
  useTracks: () => [],
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel: () => ({ on: function () { return this; }, subscribe: function () { return this; } }),
    removeChannel: vi.fn(),
  },
}));

vi.mock("@/lib/session.functions", () => ({
  getSessionRoom: h.getSessionRoom,
  advanceSession: h.advanceSession,
  checkNoShow: h.checkNoShow,
}));

const { Route } = await import("@/routes/_authenticated/session.$sessionId");
const Page = (Route as unknown as { component: React.ComponentType }).component;

describe("LiveKit room smoke", () => {
  it("mints a room from the server function and connects", async () => {
    renderWithQuery(<Page />);
    const room = await screen.findByTestId("livekit-room");
    expect(h.getSessionRoom).toHaveBeenCalledWith({ data: { sessionId: "s1" } });
    expect(room).toHaveAttribute("data-token", "lk-token");
    expect(room).toHaveAttribute("data-server-url", "wss://livekit.test");
  });

  it("renders the waiting-room stage with peer name and start control", async () => {
    renderWithQuery(<Page />);
    expect(await screen.findByText(/with grace/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start round 1/i })).toBeInTheDocument();
    expect(screen.getByTestId("controls")).toBeInTheDocument();
  });
});
