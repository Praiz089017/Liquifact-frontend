import robots from "./robots";

describe("Robots", () => {
  it("returns proper robots.txt content with default base URL", () => {
    const config = robots();
    expect(config.rules).toBeDefined();
    expect(config.rules.userAgent).toBe("*");
    expect(config.rules.allow).toBe("/");
    expect(config.sitemap).toBe("http://localhost:3000/sitemap.xml");
  });
});
