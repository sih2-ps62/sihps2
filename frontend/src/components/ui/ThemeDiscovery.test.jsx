import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ThemeProvider } from "../../context/ThemeContext";
import ThemeDiscovery from "./ThemeDiscovery";
import ClickParticles from "./ClickParticles";

beforeEach(() => {
  vi.useFakeTimers(); localStorage.clear(); sessionStorage.clear();
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it("offers Aurora at six seconds and once more at three minutes", () => {
  render(<ThemeProvider><ThemeDiscovery /></ThemeProvider>);
  act(() => vi.advanceTimersByTime(5999));
  expect(screen.queryByLabelText("Try another theme")).toBeNull();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByLabelText("Try another theme")).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(18000));
  expect(screen.queryByLabelText("Try another theme")).toBeNull();
  act(() => vi.advanceTimersByTime(156000));
  expect(screen.getByLabelText("Try another theme")).toBeInTheDocument();
});

it("honors dismissal for the session and persists a selected theme", () => {
  render(<ThemeProvider><ThemeDiscovery /></ThemeProvider>);
  act(() => vi.advanceTimersByTime(6000));
  fireEvent.click(screen.getByRole("button", { name: /Try Aurora/ }));
  expect(localStorage.getItem("polarops.theme")).toBe("dark");
  expect(document.documentElement).toHaveClass("dark");
  act(() => vi.advanceTimersByTime(180000));
  expect(screen.queryByLabelText("Try another theme")).toBeNull();
});

it("cleans falling particles after two seconds and honors reduced motion", () => {
  const { container } = render(<ThemeProvider><ClickParticles /></ThemeProvider>);
  fireEvent.click(document, { clientX: 30, clientY: 40, detail: 1 });
  expect(container.querySelector(".click-snow")).not.toBeNull();
  act(() => vi.advanceTimersByTime(2000));
  expect(container.querySelector(".click-particle")).toBeNull();
  cleanup();
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
  const reduced = render(<ThemeProvider><ClickParticles /></ThemeProvider>);
  fireEvent.click(document, { detail: 1 });
  expect(reduced.container.querySelector(".click-particle")).toBeNull();
});
