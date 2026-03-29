# Meeting Minutes Module — HTML Preview (DISCONTINUED)

> [!WARNING]
> **This component was decommissioned in March 2026.**
> The "Live HTML Preview" feature was replaced by a high-fidelity, single-view vertical form to streamline the user experience and ensure that the only source of truth for "Live Preview" is the native PDF/Word export pipeline.

## Historical Context

Previously, `MeetingPreview.tsx` was used to show a CSS-replicated version of the SCPNG letterhead and meeting structure. This was removed because:
1. **Redundancy**: Users preferred a direct form-to-document workflow.
2. **Fidelity Mismatch**: Maintaining two separate styling layers (Web CSS vs Word .docx styling) led to minor visual discrepancies.
3. **UX Overhaul**: The module moved to a "Dark Luxury" vertical form where the form itself is the primary interface.

## Design Patterns

(For reference only)
The component used an A4 layout simulation with:
- Fixed 210mm width
- `flex-col` for meeting topics
- Base64 embedded logos to bypass `html2canvas` CORS issues

**Current Logic**: All visual feedback is now integrated directly into `MeetingMinutesForm.tsx` using glassmorphic cards and real-time status indicators in the sidebar.
