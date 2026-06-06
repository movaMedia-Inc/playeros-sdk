# Publishing & registering (steps that need your accounts)

I built and verified everything below; these final steps require credentials/accounts that
only you should act on. Each one also advances an orank agent-readiness check.

## 1. Public GitHub repo  → "Public repo" + "Agent platform configs (AGENTS.md)"

This directory is already a local git repo with an initial commit. Create the remote and push:

```bash
cd playeros-sdk
gh repo create movaMedia-Inc/playeros-sdk --public --source=. --remote=origin --push
# or: git remote add origin git@github.com:movaMedia-Inc/playeros-sdk.git && git push -u origin main
```

The repo ships `AGENTS.md` (for coding agents) and `SKILL.md` (for skills.sh) at the root.

## 2. Publish to npm  → "NPM/PyPI SDK package" + "CLI tool available" + "Multi-language SDK"

```bash
cd playeros-sdk
npm login                       # needs the @playeros org (npm org create playeros) if scoped
npm publish --access public     # runs the build via prepublishOnly
```

Then verify: `npx @playeros/sdk --version` and `npm view @playeros/sdk`. If the `@playeros`
scope isn't available to you, rename `name` in package.json (e.g. `playeros-sdk`) — the CLI
bin stays `playeros`.

## 3. Register the MCP server  → "Listed in MCP registries"

Our MCP server is **remote** (HTTP), not a local stdio command.

- **Smithery** (https://smithery.ai/new): add a remote server, URL
  `https://api.playeros.ai/api/mcp`, transport `streamable-http`, auth `apiKey` header
  `X-Api-Key`. Point the listing at https://playeros.ai/.well-known/mcp.json.
- **mcp.so** (https://mcp.so/submit): submit URL `https://api.playeros.ai/api/mcp`,
  homepage https://playeros.ai, manifest https://playeros.ai/.well-known/mcp.json.
- **MCP registry** (modelcontextprotocol/registry): submit a `server.json` referencing the
  remote URL.

Link the registry entry from the homepage/docs for bi-directional verification (the
homepage already links the MCP server + manifest).

## 4. skills.sh  → "Listed on skills.sh" + "Skills.sh skill quality"

```bash
cd playeros-sdk
npx skills add        # registers the root SKILL.md (see https://skills.sh/docs)
```

The site already serves Agent Skills at https://playeros.ai/.well-known/agent-skills/index.json
(v0.2.0). Consider one SKILL.md per capability area for the "skill quality" check.

## 5. After 1–4: wire real `sameAs`  → "JSON-LD entity linking"

Once the GitHub org and any social/Wikidata URLs exist, add them to the JSON-LD `sameAs`
in `playeros/index.html` (the Organization node) and redeploy:

```jsonc
"sameAs": [
  "https://twitter.com/playeros",
  "https://x.com/playeros",
  "https://github.com/playeros",
  "https://www.wikidata.org/wiki/<QID>"   // once created
]
```

## 6. Wikipedia / Wikidata  → "Wikipedia/Wikidata entity presence" (needs notability first)

Wikidata entity is straightforward (set P856 = https://playeros.ai). A Wikipedia article
needs third-party press first (notability) — pursue G2/Capterra + gaming-press coverage,
then create the article, then add it to `sameAs` above.
