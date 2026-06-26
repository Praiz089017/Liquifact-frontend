/**
 * @file components/InvoiceListSkeleton.test.jsx
 * Keeps the skeleton test suite green after the column-width sync refactor.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import InvoiceListSkeleton from "./InvoiceListSkeleton";

expect.extend(toHaveNoViolations);

describe("InvoiceListSkeleton", () => {
  it("renders the default number of rows (3)", () => {
    render(<InvoiceListSkeleton />);
    // Each row is aria-hidden; count by the animate-pulse divs inside the container
    const rows = document.querySelectorAll(".animate-pulse");
    expect(rows).toHaveLength(3);
  });

  it("renders a custom number of rows", () => {
    render(<InvoiceListSkeleton rows={5} />);
    const rows = document.querySelectorAll(".animate-pulse");
    expect(rows).toHaveLength(5);
  });

  it("has role='status' with an accessible label on the container", () => {
    render(<InvoiceListSkeleton />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-label", "Loading invoices");
  });

  it("has an sr-only loading message for screen readers", () => {
    render(<InvoiceListSkeleton />);
    expect(screen.getByText(/loading invoices, please wait/i)).toBeInTheDocument();
  });

  it("has aria-live='polite' on the container", () => {
    render(<InvoiceListSkeleton />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });

  it("marks skeleton rows as aria-hidden to avoid noise for screen readers", () => {
    render(<InvoiceListSkeleton rows={2} />);
    const hiddenRows = document.querySelectorAll("[aria-hidden='true']");
    expect(hiddenRows).toHaveLength(2);
  });

  it("has no axe accessibility violations", async () => {
    const { container } = render(<InvoiceListSkeleton />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("matches snapshot", () => {
    const { asFragment } = render(<InvoiceListSkeleton rows={2} />);
    expect(asFragment()).toMatchSnapshot();
  });
});