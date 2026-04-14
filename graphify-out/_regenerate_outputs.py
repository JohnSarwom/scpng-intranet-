"""
Regenerate all graphify outputs (HTML, Obsidian vault, wiki, GRAPH_REPORT).
This script ONLY writes to graphify-out/ - no source code is touched.
"""
import json, os, shutil
os.environ['PYTHONUTF8'] = '1'
import networkx as nx
from networkx.readwrite import json_graph
from graphify.export import to_obsidian, to_html
from graphify.wiki import to_wiki
from graphify.cluster import score_all
from graphify.analyze import god_nodes
from graphify.report import generate as generate_report
from pathlib import Path

os.chdir(Path(__file__).resolve().parent.parent)

data = json.loads(Path('graphify-out/graph.json').read_text(encoding='utf-8'))
G = json_graph.node_link_graph(data, edges='links')
print(f'Graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges')

# Rebuild communities
communities = {}
for nid, nd in G.nodes(data=True):
    cid = nd.get('community')
    if cid is not None:
        communities.setdefault(cid, []).append(nid)
print(f'Communities: {len(communities)}')

cohesion = score_all(G, communities)
gods = god_nodes(G)

labels = {
    0: 'SharePoint List Setup', 1: 'SharePoint Operations CRUD', 2: 'TestGround Admin',
    3: 'Ticket Manager', 4: 'HR Service', 5: 'Document Management',
    6: 'Strategy Service', 7: 'Doc Analyst AI Prompt', 8: 'KRA/KPI Tab',
    9: 'Reports Tab', 10: 'Visitor Management', 11: 'AI Hub Chat',
    12: 'Meeting Minutes Form', 13: 'Org Strategy Editor', 14: 'Payments Service',
    15: 'User Management Service', 16: 'License Preview', 17: 'SharePoint Explorer UI',
    18: 'General Inquiries', 19: 'Gallery Management', 20: 'Applications Service',
    21: 'Market Data Service', 22: 'Asset Management UI', 23: 'Assets Service',
    24: 'Market News Service', 25: 'Power Automate Service', 26: 'SharePoint Explorer Service',
    27: 'Slideshow Service', 28: 'Task Dialog', 29: 'Division Service',
}
for cid in communities:
    if cid not in labels:
        labels[cid] = f'Module {cid}'

# 1. Regenerate HTML
to_html(G, communities, str(Path('graphify-out/graph.html')), community_labels=labels)
print('HTML regenerated')

# 2. Regenerate Obsidian vault
vault_path = Path('graphify-out/obsidian-vault')
if vault_path.exists():
    shutil.rmtree(vault_path)
vault_count = to_obsidian(G, communities, str(vault_path), community_labels=labels, cohesion=cohesion)
print(f'Obsidian vault: {vault_count} notes')

# 3. Regenerate wiki
wiki_path = Path('graphify-out/wiki')
if wiki_path.exists():
    shutil.rmtree(wiki_path)
wiki_count = to_wiki(G, communities, wiki_path, community_labels=labels,
                     cohesion=cohesion, god_nodes_data=gods)
print(f'Wiki: {wiki_count} articles')

# 4. Regenerate GRAPH_REPORT.md
hyperedges = data.get('hyperedges', [])
report_md = generate_report(G, communities, labels, cohesion, gods, hyperedges)
Path('graphify-out/GRAPH_REPORT.md').write_text(report_md, encoding='utf-8')
print('GRAPH_REPORT.md regenerated')

print('\nAll outputs regenerated successfully.')
