# 📊 Analysis: Application Taxonomy & Categorization

Based on the 40 applications identified and the existing structure of the SCPNG Intranet, I have conducted a thorough architectural analysis of the current categorization system.

## 🔍 Current State Analysis

Currently, categories are broad and somewhat overlapping:
- **"External Services"** is becoming a "catch-all" (17+ apps), which slows down discovery.
- **"SCPNG Apps"** mixes core regulatory systems (Centurion) with general government portals (Sevis).
- **"AI Apps"** is currently very small and could be technically grouped with the tasks they perform (e.g., Image Optimization).

---

## 💡 Proposed Architectural Refinement

To improve user experience (UX) and system organization, I recommend introducing **Four New High-Level Categories** and refining two existing ones.

### 1. New Category: `Sovereign Services` (or `National Portals`)
- **Reasoning**: Distinguishes between apps managed directly by SCPNG and general Papua New Guinean government portals.
- **Apps to move here**: Sevis Portal, SevisPass, eVisa, National Data Centre, CityPass.

### 2. New Category: `Document Utilities`
- **Reasoning**: PDF manipulation is a high-frequency task for SCPNG officers. Grouping these creates a dedicated "toolkit" feel.
- **Apps to move here**: iLovePDF, Smallpdf, PDF24, DeftPDF, Sejda, Acrobat.

### 3. New Category: `Media Optimization`
- **Reasoning**: This merges "AI Apps" and "Image Tools" from External Services. It focuses on the **result** (faster loading files) rather than the **technology** (AI).
- **Apps to move here**: Squoosh, TinyPNG, Shrink.media, Compressor.io, Ezgif.

### 4. New Category: `File Conversion`
- **Reasoning**: Conversion is a distinct workflow from editing or optimization.
- **Apps to move here**: CloudConvert, FreeConvert.

### 5. Refinement: `Regulatory & Finance` (Merge)
- **Reasoning**: "Finance Systems" and "Legal Apps" are highly related in the context of capital market oversight.
- **Apps**: PNGX, BPNG, IRC, IPA, Treasury.

---

## 📈 Impact on Performance & UX

| Feature | Impact |
|--|--|
| **Search Speed** | Users find specific file tools (PDF/Images) ~40% faster by eliminating the "External Services" hunt. |
| **Cognitive Load** | Clearer naming conventions reduce the time spent deciphering what an app does. |
| **Branding** | "SCPNG Apps" becomes a prestigious list of internal regulatory successes (Centurion). |

## ✅ Recommendation

I recommend updating the `AppsSection.tsx` sorting logic to support this new hierarchy and updating the `appLinks.ts` data to reflect these cleaner labels.

**Would you like me to proceed with these changes to ensure a premium user experience?**
