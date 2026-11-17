// SAM chat stop control (Lunar behavioural UX batch 8, optimize_15): a person can stop a running SAM turn from the
// composer without losing their message, the outcome is announced, and the message action row shows on keyboard
// focus and on touch screens.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hook = vi.hoisted(() => ({
  status: "streaming" as string,
  stop: vi.fn(async () => {}),
  setMessages: vi.fn(),
  composerProps: null as null | Record<string, unknown>,
}));

vi.mock("agents/react", () => ({ useAgent: () => ({}) }));
vi.mock("@cloudflare/think/react", () => ({
  useAgentChat: () => ({
    messages: [{ id: "u1", role: "user", parts: [{ type: "text", text: "Find quick wins" }] }],
    sendMessage: vi.fn(),
    setMessages: hook.setMessages,
    clearHistory: vi.fn(),
    status: hook.status,
    stop: hook.stop,
  }),
}));
vi.mock("@/client/features/sam/samQueries", () => ({ invalidateSamSessions: vi.fn() }));
vi.mock("@/client/components/chat/useStickToBottom", () => ({
  useStickToBottom: () => ({ scrollRef: { current: null }, onScroll: () => {}, pinToBottom: () => {} }),
}));
vi.mock("@/client/components/Markdown", () => ({ Markdown: ({ children }: { children: string }) => children }));

const { ChatComposer } = await import("@/client/features/onboarding/OnboardingChatParts");
const { ChatMessage, humanizeToolLabel } = await import("@/client/components/chat/ChatMessage");

describe("chat composer stop button", () => {
  it("shows an enabled, labelled Stop button while busy when a stop handler is given", () => {
    const html = renderToStaticMarkup(createElement(ChatComposer, { busy: true, onSend: () => {}, onStop: () => {} }));
    const button = html.match(/<button[^>]*aria-label="Stop SAM"[^>]*>/)?.[0];
    expect(button).toBeDefined();
    expect(button).toContain('type="button"');
    expect(button).not.toMatch(/disabled/);
    expect(html).not.toContain('aria-label="Send message"');
  });

  it("keeps the send button when idle", () => {
    const html = renderToStaticMarkup(createElement(ChatComposer, { busy: false, onSend: () => {}, onStop: () => {} }));
    expect(html).toContain('aria-label="Send message"');
    expect(html).not.toContain("Stop SAM");
  });
});

describe("SAM conversation stop", () => {
  beforeEach(() => {
    hook.stop.mockClear();
    hook.setMessages.mockClear();
    hook.status = "streaming";
  });

  it("wires the composer stop to the chat hook's own stop, not the rewind that deletes messages", async () => {
    vi.resetModules();
    vi.doMock("@/client/features/onboarding/OnboardingChatParts", () => ({
      ChatComposer: (props: Record<string, unknown>) => {
        hook.composerProps = props;
        return null;
      },
    }));
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { SamConversation } = await import("@/client/features/sam/SamConversation");
    renderToStaticMarkup(createElement(SamConversation, { projectId: "p1", sessionId: "s1" }));
    const onStop = hook.composerProps?.onStop as (() => void) | undefined;
    expect(typeof onStop).toBe("function");
    onStop?.();
    expect(hook.stop).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(hook.setMessages).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
    vi.doUnmock("@/client/features/onboarding/OnboardingChatParts");
  });

  it("keeps an always-mounted polite status region for the stop outcome", async () => {
    vi.resetModules();
    const { SamConversation } = await import("@/client/features/sam/SamConversation");
    const html = renderToStaticMarkup(createElement(SamConversation, { projectId: "p1", sessionId: "s1" }));
    expect(html).toMatch(/role="status"[^>]*aria-live="polite"|aria-live="polite"[^>]*role="status"/);
  });
});

describe("message action row", () => {
  it("is shown on keyboard focus and on touch screens, not only on mouse hover", () => {
    const html = renderToStaticMarkup(
      createElement(ChatMessage, {
        message: { id: "u1", role: "user", parts: [{ type: "text", text: "hi" }] },
        resolveToolLabel: humanizeToolLabel,
        onUndo: () => {},
      } as never),
    );
    const row = html.match(/<div class="([^"]*opacity-0[^"]*)"/)?.[1] ?? "";
    expect(row).toContain("group-focus-within:opacity-100");
    expect(row).toContain("pointer-coarse:opacity-100");
  });
});
