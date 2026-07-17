import sitemap from "./sitemap";

describe("Sitemap", () => {
  it("returns entries for all expected public routes", () => {
    const entries = sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls).toContain("http://localhost:3000/");
    expect(urls).toContain("http://localhost:3000/invoices");
    expect(urls).toContain("http://localhost:3000/invest");
    expect(entries.length).toBe(3);
  });

  it("each entry has required sitemap fields", () => {
    const entries = sitemap();
    entries.forEach((entry) => {
      expect(entry).toHaveProperty("url");
      expect(entry).toHaveProperty("lastModified");
      expect(entry).toHaveProperty("changeFrequency");
      expect(entry).toHaveProperty("priority");
    });
  });
});
