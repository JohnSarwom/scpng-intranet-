# SCPNG Divisions & Units — Organizational Structure

> **Last Updated:** February 2026  
> **Source Files:** `OrgChart.tsx`, `Strategy.tsx`  
> **Rendered On:** Strategy Page → "Org Structure" tab

---

## Organizational Overview

The Securities Commission of Papua New Guinea (SCPNG) is structured under the **Chief Executive Officer (CEO)** with **5 Divisions** containing a total of **11 Units**. The hierarchy flows as:

```
CEO
 └── Office of the Chairman
      ├── Executive Division
      └── Secretariat Unit
 └── Corporate Services Division
      ├── Finance Unit
      ├── IT Unit
      └── Human Resource Unit
 └── Licensing, Market & Supervision Division
      ├── Licensing Unit
      ├── Supervision Unit
      ├── Market Data Unit
      └── Investigations Unit
 └── Legal Services Division
      └── Legal Advisory Unit
 └── Research & Publication Division
      ├── Research Unit
      └── Publication Unit
```

---

## 1. Office of the Chairman

**Head:** James Joshua — Acting Chief Executive Officer  
**Email:** jjoshua@scpng.gov.pg | **Phone:** +675 321 2223

Oversees the operations and strategic direction of the Commission. Responsible for regulatory oversight, stakeholder engagement, and organizational governance.

### Units

| Unit | Key Personnel | Role |
|------|--------------|------|
| **Executive Division** | James Joshua | Acting CEO — Executive leadership and strategy |
| **Secretariat Unit** ⭐ | Andy Ambulu | General Counsel — Legal counsel on regulatory and corporate matters |
| | Ninipe Gurumo | Executive Officer — Executive operations and coordination |

> **Note:** The Secretariat Unit is visually highlighted in the Org Chart (amber/cream styling) to denote its special advisory role.

### Strategic Alignment
- **Administrative Fundamentals** — Appoint new Board Members, finalize the Strategic Plan 2025–2030 with ADB and IFC, establish internal audit and risk frameworks.

---

## 2. Corporate Services Division (CSD)

**Director:** Sam Taki — Director Corporate Service  
**Email:** staki@scpng.gov.pg | **Phone:** +675 321 2223  
**Strategic Focus:** Administrative Fundamentals — Internal policies, governance, HR/Finance modernization, IT infrastructure.

### Finance Unit
| Officer | Title |
|---------|-------|
| Sam Taki | Director Corporate Service |
| Mercy Tipitap | Senior Finance Officer |
| Anita Kosnga | Finance Officer |
| Laviniah Michael | Intern - Part-Time |

**Responsibilities:** Budgeting, financial reporting, accounts management, audit preparation, compliance reporting.

### IT Unit
| Officer | Title |
|---------|-------|
| Eric Kipongi | Manager Information Technology |
| John Sarwom | Senior IT Database Officer |
| Donald Sinogerel Samson | IT Hardware Officer |
| Monica Abau-Sapulai | Senior Systems Analyst Consultant |

**Responsibilities:** Network infrastructure, systems administration, database management, IT security, software development, digital transformation, intranet modernization.

### Human Resource Unit
| Officer | Title |
|---------|-------|
| Thomas Mondaya | Senior HR Officer |
| Lovelyn Karlyo | Payroll Officer |
| Mark Timea | Admin Officer |
| Leah Samuel | Divisional Secretary |
| Sophia Marai | Receptionist |
| Lenome Rex MBalupa | Administrative Driver |

**Responsibilities:** Recruitment, performance management, payroll processing, staff welfare, office administration, facilities management.

---

## 3. Licensing, Market & Supervision Division (LMSD)

**Director:** Reports directly to CEO  
**Strategic Focus:** Expand Markets & Connectivity + Regulatory Framework Reform — Trading/Clearing/Settlement systems, broker expansion, Unit Trust and Fund Management Codes, Centurion Enterprise System.

### Licensing Unit
| Officer | Title |
|---------|-------|
| Leeroy Wambillie | Senior Licensing Officer |
| Kylie Karis | Licensing Officer |

**Responsibilities:** License application review, compliance assessment, license issuance for securities dealers and investment advisors, license register maintenance.

### Supervision Unit
| Officer | Title |
|---------|-------|
| Regina Wai | Senior Supervision Officer |

**Responsibilities:** Supervisory oversight of licensed entities, on-site inspections, monitoring of market participant activities, risk assessment.

### Market Data Unit
| Officer | Title |
|---------|-------|
| Zomay Apini | Market Data Manager |
| Esther Alia | Market Data Officer |

**Responsibilities:** Capital market data collection and analysis, market surveillance, statistical reporting, data dissemination, performance indicators.

### Investigations Unit
| Officer | Title |
|---------|-------|
| Jacob Kom | Senior Investigations Officer |

**Responsibilities:** Investigation of securities law violations, market misconduct and fraud detection, evidence gathering, investigation report preparation for enforcement actions.

---

## 4. Legal Services Division (LSD)

**Director:** Tyson Yapao — Legal Manager - Compliance & Enforcement  
**Email:** tyapao@scpng.gov.pg | **Phone:** +675 321 2223  
**Strategic Focus:** Regulatory Framework Reform — SC Act and Capital Market Act amendments, IOSCO MMOU engagement, legal enforcement & compliance.

### Legal Advisory Unit
| Officer | Title |
|---------|-------|
| Tyson Yapao | Legal Manager - Compliance & Enforcement |
| Isaac Mel | Senior Legal Officer |
| Tony Kawas | Senior Legal Officer |
| Immanuel Minoga | Legal Officer |

**Responsibilities:** Legal compliance and enforcement framework, litigation management, regulatory reform and legislative drafting, contract review, legal research and advisory services.

---

## 5. Research & Publication Division (RPD)

**Director:** Joy Komba — Director Research & Publication  
**Email:** jkomba@scpng.gov.pg | **Phone:** +675 321 2223  
**Strategic Focus:** Investor Education — Social media expansion (2–3M followers), quarterly investor bootcamps, regional roadshows, "Invest Smart PNG" campaign.

### Research Unit
| Officer | Title |
|---------|-------|
| Max Siwi | Senior Research Officer |

**Responsibilities:** Capital market trend research, policy analysis, regulatory impact assessments, research papers and policy briefs.

### Publication Unit
| Officer | Title |
|---------|-------|
| Rosie Stevenou | Publication Officer |

**Responsibilities:** Commission reports, newsletters, annual reports, public awareness materials, digital publishing, content distribution.

---

## Technical Implementation

### Source of Truth
The organizational structure is defined in two places:

1. **`OrgChart.tsx`** — Static structure & officer profiles
   - `CHAIRMAN_OFFICE` — Office of the Chairman hierarchy
   - `ORG_DIVISIONS` — Division → Unit structure (visual chart)
   - `PROFILE_DIVISIONS` — Division → Unit → Officer profiles
   - `CEO_OFFICER` / `CHAIRMAN_OFFICE_PROFILE` — Top-level officer data

2. **`Strategy.tsx`** — Dynamic hierarchy for strategy alignment
   - `ORG_STRUCTURE` — Pre-seeded Division → Unit map (hybrid approach)
   - `divisionHierarchy` — Dynamically built from SharePoint objectives
   - `divisionAlignment` — Static alignment of divisions to strategic objectives
   - `getDivisionMeta()` — Maps division names to icons and director titles

### Data Flow (Strategy Page Hierarchy)
```
SharePoint (Unit Objectives) 
  → useSharePointObjectives() hook
    → divisionHierarchy useMemo (filters non-org/strategic/board types)
      → Hybrid merge with ORG_STRUCTURE scaffold
        → Accordion UI: Division → Unit → Key Deliverable → Objectives
```

### Legacy Remapping
The `divisionHierarchy` builder includes remapping logic for legacy data:
- `"Executive Division"` → maps to `"Office of the Chairman"` parent
- `"Secretariat Unit"` → maps to `"Office of the Chairman"` parent
- Unknown units → fuzzy-matched against `ORG_STRUCTURE` to infer parent division

### Org Chart Views
The `OrgChart` component provides two toggle views:
- **Structure View** — Clean visual hierarchy with maroon-themed nodes
- **Profiles View** — Same hierarchy but with clickable officer cards showing name, title, email, and phone

Both views support zoom (30%–150%), fullscreen mode, and an officer profile modal on click.