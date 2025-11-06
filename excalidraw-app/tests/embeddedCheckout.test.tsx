import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

import { SubscribeScreen } from "../auth-shell/AuthGate";
import type { AuthShellConfig } from "../auth-shell/config";
import { AuthShellProvider } from "../auth-shell/AuthShellContext";

const mockGetToken = vi.fn();
const mockSignOut = vi.fn();
const mockUser = { primaryEmailAddress: { emailAddress: "test@example.com" } };

vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({ getToken: mockGetToken }),
  useUser: () => ({ user: mockUser }),
}));

const originalFetch = global.fetch;
const originalLocation = window.location;

const mockInitialize = vi.fn();
const mockCheckoutOpen = vi.fn();
const mockCheckoutClose = vi.fn();

const successResponse = {
  clientToken: "client_sbx_123",
  priceId: "pri_123",
  billingInterval: "month",
  environment: "sandbox",
  customerEmail: "test@example.com",
  successUrl: "http://localhost?subscribed=true",
  cancelUrl: "http://localhost/pricing",
};

const mockConfig: AuthShellConfig = {
  enabled: true,
  publishableKey: "pk_test_123",
  redirectUrl: "http://localhost",
  apiBaseUrl: "http://localhost:8787",
  sessionEndpoint: "/session",
  premiumCookieName: "embplus-auth",
};

function renderSubscribe() {
  return render(
    <AuthShellProvider value={{ signOut: mockSignOut, hasActiveSubscription: false }}>
      <SubscribeScreen config={mockConfig} onSignOut={mockSignOut} />
    </AuthShellProvider>,
  );
}

describe("SubscribeScreen Paddle Drop-in", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetToken.mockResolvedValue("test-token");

    (global.fetch as unknown as typeof fetch) = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => successResponse,
    });

    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...originalLocation,
        assign: vi.fn(),
        origin: "http://localhost",
        search: "",
        href: "http://localhost/subscribe",
      },
    });

    (window as any).Paddle = {
      Initialize: mockInitialize,
      Checkout: {
        open: mockCheckoutOpen,
        close: mockCheckoutClose,
      },
    };

    mockCheckoutOpen.mockImplementation(({ eventCallback }) => {
      eventCallback?.({ name: "checkout.loaded" });
    });
  });

  afterEach(() => {
    (global.fetch as unknown as typeof fetch) = originalFetch;
    Object.defineProperty(window, "location", { value: originalLocation });
    delete (window as any).Paddle;
  });

  it("initializes Paddle Drop-in when monthly plan selected", async () => {
    renderSubscribe();

    const monthlyButton = await screen.findByRole("button", { name: /monthly plan/i });
    fireEvent.click(monthlyButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/subscription/checkout"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ billingInterval: "month" }),
        }),
      );
    });

    await waitFor(() => {
      expect(mockInitialize).toHaveBeenCalledWith({
        token: "client_sbx_123",
        environment: "sandbox",
      });
      expect(mockCheckoutOpen).toHaveBeenCalled();
    });
  });

  it("renders the payment container once Drop-in is visible", async () => {
    renderSubscribe();
    const monthlyButton = await screen.findByRole("button", { name: /monthly plan/i });
    fireEvent.click(monthlyButton);

    await waitFor(() => {
      expect(screen.getByText(/enter payment details/i)).toBeInTheDocument();
      expect(document.getElementById("paddle-dropin")).toBeTruthy();
    });
  });

  it("shows API errors inline", async () => {
    (global.fetch as unknown as typeof fetch) = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: "Paddle payment provider not configured yet" }),
    });

    renderSubscribe();
    const monthlyButton = await screen.findByRole("button", { name: /monthly plan/i });
    fireEvent.click(monthlyButton);

    await waitFor(() => {
      expect(
        screen.getByText(/paddle payment provider not configured yet/i),
      ).toBeInTheDocument();
    });
  });

  it("only disables the selected plan button while loading", async () => {
    renderSubscribe();

    const monthlyButton = await screen.findByRole("button", { name: /monthly plan/i });
    const yearlyButton = await screen.findByRole("button", { name: /yearly plan/i });

    fireEvent.click(monthlyButton);

    await waitFor(() => {
      expect(monthlyButton).toBeDisabled();
      expect(yearlyButton).not.toBeDisabled();
    });
  });

  it("redirects to success URL when checkout completes", async () => {
    mockCheckoutOpen.mockImplementation(({ eventCallback }) => {
      eventCallback?.({ name: "checkout.loaded" });
      eventCallback?.({ name: "checkout.completed" });
    });

    renderSubscribe();
    const yearlyButton = await screen.findByRole("button", { name: /yearly plan/i });
    fireEvent.click(yearlyButton);

    await waitFor(() => {
      expect(window.location.assign).toHaveBeenCalledWith(successResponse.successUrl);
    });
  });
});
