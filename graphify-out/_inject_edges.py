"""
Inject cross-layer edges into graphify graph.
This script ONLY modifies graphify-out/graph.json - no source code is touched.
"""
import json, os, re
os.environ['PYTHONUTF8'] = '1'
import networkx as nx
from networkx.readwrite import json_graph
from pathlib import Path

os.chdir(Path(__file__).resolve().parent.parent)

data = json.loads(Path('graphify-out/graph.json').read_text(encoding='utf-8'))
G = json_graph.node_link_graph(data, edges='links')
node_ids = set(G.nodes())
before = G.number_of_edges()
print(f'Before: {G.number_of_nodes()} nodes, {before} edges')

# ============================================
# PART 1: UI Component -> Hook edges
# ============================================
hooks = [
    'useSharePointTasks', 'useSharePointProjects', 'useSharePointRisks',
    'useSharePointTaskGroups', 'useSharePointCustomContacts', 'useSharePointSetup',
    'useAssetsSharePoint', 'useAssetSubSharePoint', 'useAssetState',
    'useDivisionData', 'useDivisionMetrics', 'useDivisionStaff',
    'useForms', 'useInternalNews', 'useMarketNews', 'useCompanyNews',
    'useHighPriorityNews', 'useMarketData', 'useLiveMarketUpdates',
    'useNotifications', 'useNoticeBoard', 'useProjectState', 'useRiskState',
    'useRegulatoryCases', 'useAllSlideshows', 'useMSOffice365Tips',
    'useCapitalMarketNews', 'useCapitalMarketActs', 'useStaffByDepartment',
    'useStaffMembers', 'useWorkPlans', 'useUnitRoster', 'useCountdown',
    'useCsvEntityData', 'useTaskState', 'useKraState', 'useKraModals',
    'useIsMobile', 'useSupabaseData', 'useTasksData', 'useProjectsData',
    'useRisksData', 'useKRAsData', 'useKPIsData', 'useObjectivesData',
    'useApps', 'useCalendarEvents', 'useComponentVisibility', 'useDivisions',
    'useEmployeePhotos', 'useGraphProfile', 'useHrService', 'useLeaveBalances',
    'useLeaveRequests', 'useOfficerProfiles', 'usePaymentsSharePoint',
    'useRoleBasedAuth', 'useStrategySharePoint', 'useTaskGroupPreferences',
    'useUnits', 'useMicrosoftGraph', 'useSlideshows',
]

ui_hook_added = 0
for hook_name in hooks:
    for f in list(Path('src').rglob('*.tsx')) + list(Path('src').rglob('*.ts')):
        f_str = str(f).replace('\\', '/')
        if '/hooks/' in f_str:
            continue
        try:
            content = f.read_text(encoding='utf-8', errors='ignore')
        except:
            continue
        if hook_name not in content:
            continue

        fname = f.name.rsplit('.', 1)[0].lower().replace('-', '_')
        consumer_ids = [nid for nid in node_ids
                        if nid.endswith('_' + fname + '_tsx') or nid.endswith('_' + fname + '_ts')]

        hook_lower = hook_name.lower()
        hook_ids = [nid for nid in node_ids if hook_lower in nid.lower() and 'use' in nid.lower()]

        if consumer_ids and hook_ids:
            src_id = consumer_ids[0]
            tgt_id = hook_ids[0]
            if src_id != tgt_id and not G.has_edge(src_id, tgt_id):
                G.add_edge(src_id, tgt_id, relation='calls',
                           confidence='INFERRED', confidence_score=0.9, weight=2.0)
                ui_hook_added += 1

print(f'UI -> Hook edges added: {ui_hook_added}')

# ============================================
# PART 2: Hook -> Service edges
# ============================================
hook_files = list(Path('src/hooks').glob('*.ts')) + list(Path('src/hooks').glob('*.tsx'))
hook_svc_added = 0

for hf in hook_files:
    try:
        content = hf.read_text(encoding='utf-8', errors='ignore')
    except:
        continue

    hf_name = hf.name.rsplit('.', 1)[0].lower().replace('-', '_')
    hf_ids = [nid for nid in node_ids if nid.startswith('src_hooks_') and hf_name in nid]
    if not hf_ids:
        continue
    hf_id = hf_ids[0]

    for line in content.split('\n'):
        if 'from' in line and '/services/' in line and 'import' in line:
            match = re.search(r'/services/([^\'\"]+)', line)
            if match:
                svc_name = match.group(1).rsplit('.', 1)[0].lower().replace('-', '_')
                svc_ids = [nid for nid in node_ids
                           if svc_name in nid.lower()
                           and ('service' in nid.lower() or nid.startswith('src_services'))]
                if svc_ids:
                    file_svc = [s for s in svc_ids if s.startswith('src_services_')]
                    svc_id = file_svc[0] if file_svc else svc_ids[0]
                    if not G.has_edge(hf_id, svc_id):
                        G.add_edge(hf_id, svc_id, relation='imports_from',
                                   confidence='EXTRACTED', confidence_score=1.0, weight=2.5)
                        hook_svc_added += 1

print(f'Hook -> Service edges added: {hook_svc_added}')

# ============================================
# PART 3: Page -> Tab/Component edges
# ============================================
page_tab_added = 0
for f in Path('src/pages').rglob('*.tsx'):
    try:
        content = f.read_text(encoding='utf-8', errors='ignore')
    except:
        continue
    fname = f.name.rsplit('.', 1)[0].lower().replace('-', '_')
    page_ids = [nid for nid in node_ids if nid.endswith('_' + fname + '_tsx')]
    if not page_ids:
        continue
    page_id = page_ids[0]

    imports = re.findall(r'from [\'"].*?/components/.*?/([^\'"]+)[\'"]', content)
    for imp in imports:
        imp_base = imp.rsplit('.', 1)[0].lower().replace('-', '_')
        comp_ids = [nid for nid in node_ids if imp_base in nid and nid.startswith('src_components')]
        if comp_ids:
            comp_id = comp_ids[0]
            if not G.has_edge(page_id, comp_id):
                G.add_edge(page_id, comp_id, relation='references',
                           confidence='INFERRED', confidence_score=0.9, weight=2.0)
                page_tab_added += 1

print(f'Page -> Component edges added: {page_tab_added}')

# ============================================
# PART 4: Context -> Hook/Service edges
# ============================================
ctx_added = 0
for f in Path('src/contexts').rglob('*.tsx'):
    try:
        content = f.read_text(encoding='utf-8', errors='ignore')
    except:
        continue
    fname = f.name.rsplit('.', 1)[0].lower().replace('-', '_')
    ctx_ids = [nid for nid in node_ids
               if fname in nid and ('context' in nid or nid.startswith('src_contexts'))]
    if not ctx_ids:
        continue
    ctx_id = ctx_ids[0]

    for line in content.split('\n'):
        if 'from' in line and ('services/' in line or 'hooks/' in line) and 'import' in line:
            match = re.search(r'/(?:services|hooks)/([^\'\"]+)', line)
            if match:
                dep_name = match.group(1).rsplit('.', 1)[0].lower().replace('-', '_')
                dep_ids = [nid for nid in node_ids if dep_name in nid]
                if dep_ids:
                    file_deps = [d for d in dep_ids if d.startswith('src_')]
                    dep_id = file_deps[0] if file_deps else dep_ids[0]
                    if not G.has_edge(ctx_id, dep_id):
                        G.add_edge(ctx_id, dep_id, relation='imports_from',
                                   confidence='EXTRACTED', confidence_score=1.0, weight=2.0)
                        ctx_added += 1

print(f'Context -> Hook/Service edges added: {ctx_added}')

total_added = ui_hook_added + hook_svc_added + page_tab_added + ctx_added
print(f'\nTotal new edges: {total_added}')
print(f'After: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges')

orphans = len([n for n in G.nodes() if G.degree(n) == 0])
print(f'Remaining orphans: {orphans}')

# Save
graph_data = json_graph.node_link_data(G, edges='links')
graph_data['hyperedges'] = data.get('hyperedges', [])
Path('graphify-out/graph.json').write_text(
    json.dumps(graph_data, indent=2, ensure_ascii=False), encoding='utf-8')
print('graph.json saved')
