## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"` to keep the graph current

## Change documentation (required for every change)

The owner wants every change documented, so that anyone can see where things stand. Before a change is committed:

1. **Change record.** Copy `docs/changes/_TEMPLATE.md` to `docs/changes/YYYY-MM-DD-short-slug.md`, using one file per change. Fill in every section: write "None" rather than deleting one, and be honest about what was not checked. Add a row at the top of the index in `docs/changes/README.md`. On a parallel branch, if the index might conflict, write the record and say in the summary that the index row is still to be added.
2. **Programme tracker.** If the change belongs to a programme (currently `docs/programmes/org-and-approvals/README.md`), update its "Where we are" section, the step status, and the decisions register when a decision is made or used.
3. **Module doc.** Update the feature's doc under `docs/modules/` when behaviour changes.
4. **Workflow Studio designs.** When the code catches up with a target design, update the affected `appStatus` and `details.today` in `src/workflows/definitions/` in the same change.
5. **Keep records current.** When a change is pushed, merged, deployed or its data is applied on production, update the record's Status and History lines.

Never put staff names, emails or other personal data in change records. Describe roles instead.
