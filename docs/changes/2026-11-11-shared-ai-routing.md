# Shared AI provider routing

| | |
|---|---|
| **Date** | 2026-11-11 |
| **Status** | In review |
| **Programme step** | None |
| **Branch / PR / commits** | `feat/workflow-studio`, [PR #23](https://github.com/JohnSarwom/scpng-intranet-/pull/23), commit `f3acf50` |
| **Decisions used** | Workflow Studio must use the app's existing AI configuration (user, 2026-11-11) |

## Why

Workflow Studio needed AI, and the user asked for it to use the AI configuration the app already has. The routing code that does this (preferred provider, fallback, gateway) existed only in uncommitted work. Only its core went into this PR, so that Workflow Studio builds.

## What changed for users

Nothing visible on its own. AI features that use the shared hook show which provider and model answered.

## Technical changes

| Area | Change |
|---|---|
| `src/services/aiService.ts`, `src/hooks/useAiService.ts` | One hook that routes requests to the preferred provider (Gemini or Groq) with automatic fallback and a cooldown per provider. |
| `src/services/aiRequestPolicy.ts` | A 32,000-character request budget. |
| `src/services/aiGatewayClient.ts`, `src/services/cloudflareGatewayAdapter.ts`, `src/config/aiConnection.ts` | Optional authenticated gateways: the full AI gateway, or Cloudflare only. |
| `src/services/groqClient.ts`, `src/hooks/useGroqApiKey.ts`, `src/config/aiProviders.ts`, `src/hooks/useAiHubSettings.ts`, `src/hooks/useAiConversationLifecycle.ts` | Provider settings and keys. |
| `src/components/ai/AiProviderStatus.tsx` | Shows the provider and model in use. |
| `.env.example` | The AI gateway settings block. |

## Data and SharePoint changes

None.

## How it was checked

- `groqIntegration.test.cjs` and the strategy suites passed; the build passed.
- An AI draft in Workflow Studio was answered by Gemini in a local browser check.

## Follow-ups and open items

AI Hub, the other AI chats, the gateway worker, the Supabase function and the AI docs are still uncommitted local work. They need their own branch and change record.

## How to undo it

Revert commit `f3acf50`, which also needs Workflow Studio removed, since it depends on this.

## History

- 2026-11-11: committed.
- 2026-11-12: pushed in PR #23.
- 2026-11-13: record written.
