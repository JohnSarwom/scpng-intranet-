# Unit Modal Implementation Guide

## 1. Objective
The goal was to implement a modal for individual units within the organizational chart (`OrgChart`), mirroring the functionality, layout, and design of the previously implemented `DivisionModal` and `OfficerProfileModal`. This allows users to click on a unit node in the hierarchy and view detailed, structured information about that specific unit.

## 2. Requirements & UI/UX Specifications
*   **Visual Consistency:** The `UnitModal` must share the exact aesthetic footprint as the `DivisionModal`.
*   **Height Constraint:** The modal must not exceed the viewport height. It should have a `max-h-[90vh]` constraint to prevent the main browser window from scrolling.
*   **Internal Scrolling:** If the content is longer than the modal's height, only the internal content area should scroll (`overflow-y-auto`), utilizing a custom scrollbar for better visual appeal.
*   **Sticky Header and Footer:** The modal must have a sticky header (with tabs) and a sticky footer (with action buttons and last updated stamp) that remain visible while the user scrolls through the content.
*   **Tabbed Interface:** The content area must feature a tabbed navigation system utilizing Headless UI or Shadcn Tabs, specifically dividing content into "Overview" and "Statutory Duty".
*   **Dark Backdrop:** The modal must employ a dark overlay backdrop (`bg-black/40` or similar with backdrop blur) to emphasize focus on the modal content.

## 3. Implementation Details

### 3.1. `UnitModal.tsx` Component Creation
A new component, `src/components/strategy/UnitModal.tsx`, was created from scratch, structured to address all UI requirements.

*   **Data Interface (`MockUnitData`):** Defined a comprehensive TypeScript interface to strongly type the data passed into the modal.
    ```typescript
    export interface MockUnitData {
        id: string;
        unitName: string;
        parentDivision: string;
        primaryContact: { label: string; email: string };
        location: string;
        totalStaff: number;
        manager: { quote: string; name: string };
        missionStatement: string;
        coreFunctions: { name: string; description: string; icon: string }[];
        achievements: { title: string; date: string; description: string; icon: string }[];
        statutoryDuties: string[];
    }
    ```
*   **Headless UI Dialog:** Utilized `@headlessui/react` `Dialog` and `Transition` components to handle the modal's open/close state, accessibility (focus trapping), and enter/leave animations.
*   **Layout Structure:**
    *   **Sidebar (Left):** A styled sidebar containing the Unit's name, parent division, primary contact, location, total staff, and a manager's quote. Styled with a dark red background (`bg-[#600018]`).
    *   **Main Content (Right):** A white background area featuring the sticky tabs, scrollable content panel, and sticky footer.
*   **Tabs Implementation:** Utilized standard application UI components (`Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`) to switch between the Overview (mission, core functions, achievements) and Statutory Duty (list of legal obligations).
*   **Dynamic Icons:** Implemented a `getIcon` helper function using `lucide-react` to dynamically render icons for core functions and achievements based on a string mapping (e.g., `'shield'` -> `Shield`).

### 3.2. `OrgChart.tsx` Integration
To make the unit nodes interactive, modifications were made to the core organizational chart component (`src/components/strategy/OrgChart.tsx`).

*   **Mock Data:** Added `MOCK_UNITS_DATA` containing sample information for various units (e.g., "Licensing Unit", "Finance Unit") to populate the modal during the UI testing phase.
*   **State Management:** Introduced a new state variable to track the currently selected unit.
    ```typescript
    const [selectedUnit, setSelectedUnit] = useState<MockUnitData | null>(null);
    ```
*   **Event Handler:** Created `handleUnitClick` to capture click events from the nodes, retrieve the corresponding unit data from the mock dataset (or generate a fallback for testing purposes), and set the state.
    ```typescript
    const handleUnitClick = (unitName: string) => {
        const unitData = MOCK_UNITS_DATA[unitName];
        if (unitData) {
            setSelectedUnit(unitData);
        } else {
            // Fallback object generator
        }
    };
    ```
*   **Component Rendering:** Appended the `<UnitModal />` component to the bottom of the `OrgChart` return statement, passing in the state flags:
    ```tsx
    <UnitModal
        isOpen={!!selectedUnit}
        onClose={() => setSelectedUnit(null)}
        unit={selectedUnit}
    />
    ```

### 3.3. Prop Drilling to Sub-views
The organizational structure has two primary view modes: "Structure" (hierarchical boxes) and "Profiles" (officer cards). The `onUnitClick` prop had to be correctly drilled down into both sub-components.

*   **`StructureView`:** The `onUnitClick` prop was added to the signature. Inside the mapping logic, the `<OrgNode type="unit" ... />` components were updated to include `onClick={() => onUnitClick(unit.unitName)}`.
*   **`ProfilesView`:** Similarly, the `onUnitClick` prop was added to the signature, and click handlers were attached to the unit boundary nodes (e.g., the "Executive Division" unit node beneath the Chairman profile).

## 4. Challenges Addressed
*   **TypeScript Enforcement:** Strict TypeScript definitions required coordinated updates across `StructureView`, `ProfilesView`, and their parent `OrgChart` to ensure the `onUnitClick` prop was recognized and correctly typed as `(unitName: string) => void`.
*   **Scrolling Mechanics:** Early iterations resulted in double-scrollbars (browser scrollbar + modal scrollbar) or clipped headers. By confining the `Dialog.Panel` to `max-h-[90vh]` and setting the central content `div` to `flex-1 overflow-y-auto`, the desired static outer frame with scrolling inner content was achieved.
*   **Sticky Integrity:** Ensuring the footer and tab lists remained sticky required careful attention to `flex` layouts and explicitly setting `sticky top-0 bg-white z-10` for the tabs and `sticky bottom-0 bg-white border-t` for the footer.

## 5. Next Steps / Future Enhancements
*   Currently, the modal relies on `MOCK_UNITS_DATA`. In the future, this should be hooked up to a live data fetching service (e.g., pulling from SharePoint or a Supabase backend).
*   The "Edit Unit" functionality has been implemented for administrators. See `EDITABLE_ORG_MODALS_IMPLEMENTATION.md` for full technical details.
