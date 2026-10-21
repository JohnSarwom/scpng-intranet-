"""Native Power Automate + SharePoint newsletter backend; no external runtime.

Build review JSON with --definitions, or NEW import packages from an owner's
export with --owner-export. Import defaults to changes disabled.
"""
import argparse
import copy
import json
import re
import uuid
import zipfile
from pathlib import Path

ROOT = Path(__file__).parent
DIVISION_ALIASES = json.loads((ROOT.parent.parent / "src/config/newsletterDivisionAliases.json").read_text(encoding="utf-8"))
ORGANIZATION_DIVISIONS = ["Office of the Chairman", "Corporate Services Division", "Licensing, Market & Supervision Division", "Legal Services Division", "Research & Publication Division"]
MAIN = "@outputs('Deployment_settings')?['mainSite']"
PRIVATE = "@outputs('Deployment_settings')?['privateSite']"
PRIVATE_LISTS = ['Newsletter_Configuration', 'Newsletter_Routing', 'Newsletter_Submissions', 'Newsletter_Publications', 'Newsletter_Notifications', 'Newsletter_Attachments', 'Newsletter_RequestLedger']
MAIN_LISTS = ['Newsletter_Requests', 'Newsletter_RequestParts']
SECURE = {'secureData': {'properties': ['inputs', 'outputs']}}


def q(value): return "'" + str(value).replace("'", "''") + "'"
def ex(value): return '@' + value
def v(name): return "variables(" + q(name) + ")"
def out(name): return "outputs(" + q(name) + ")"
def body(name): return "body(" + q(name) + ")"
def directory_value(label):
    return "item()?[coalesce(outputs('Deployment_settings')?['directoryFields']?[" + q(label) + "]," + q(label) + ")]"
def lit(value): return "json(" + q(json.dumps(value, separators=(',', ':'))) + ")"
def obj(fields):
    value = "json('{}')"
    for key, field in fields.items(): value = f'setProperty({value}, {q(key)}, {field})'
    return value
def norm(value): return f"toLower(trim(coalesce({value}, '')))"
def canonical(value):
    key = f"replace(replace(replace(replace({norm(value)}, '&', 'and'), ' ', ''), ',', ''), '-', '')"
    standard = f"if(contains(createArray('executivedivision','officeofthechairman','executive'), {key}), 'Office of the Chairman', if(startsWith({key}, 'corporateservice'), 'Corporate Services Division', if(and(startsWith({key}, 'licensing'), contains({key}, 'supervision')), 'Licensing, Market & Supervision Division', if(startsWith({key}, 'legalservice'), 'Legal Services Division', if(and(startsWith({key}, 'research'), contains({key}, 'publication')), 'Research & Publication Division', trim(coalesce({value},'')))))))"
    return f"coalesce({lit(DIVISION_ALIASES)}?[{key}],{standard})"

def known_division(value): return f"contains({lit(ORGANIZATION_DIVISIONS)},{canonical(value)})"

def action(kind, inputs, **extra):
    # Built-in variable actions do not support secureData. Compose/ParseJson/
    # Response support secure inputs only, which also masks their outputs.
    result = {'type': kind, 'inputs': inputs, 'runAfter': {}, **extra}
    if kind in ['Compose', 'ParseJson', 'Response']:
        result['runtimeConfiguration'] = {'secureData': {'properties': ['inputs']}}
    elif kind in ['OpenApiConnection', 'Select', 'Query']:
        result['runtimeConfiguration'] = copy.deepcopy(SECURE)
    return result
def compose(value): return action('Compose', ex(value))
def setvar(name, value):
    # The cloud designer drops a bare @'' when round-tripping required Value fields.
    # Keep the empty result as a nonempty expression so edited flows remain valid.
    if value == "''": value = "concat('','')"
    return action('SetVariable', {'name': name, 'value': ex(value)})
def select(source, fields): return action('Select', {'from': ex(source), 'select': {key: ex(value) for key, value in fields.items()}})
def query(source, where): return action('Query', {'from': ex(source), 'where': ex(where)})
def chain(actions):
    expanded={}
    for name,value in actions.items():
        bypass=value.pop('_allowError',False)
        inputs=value.get('inputs',{})
        method=inputs.get('parameters',{}).get('parameters/method','GET') if isinstance(inputs,dict) else 'GET'
        if value.get('type')=='OpenApiConnection' and method!='GET' and not bypass:
            expanded['Gate_'+name]=compose("if(empty(variables('Error')),true,div(1,0))")
        expanded[name]=value
    actions.clear();actions.update(expanded)
    previous = None
    for name, value in actions.items():
        if previous and not value.get('runAfter'): value['runAfter'] = {previous: ['Succeeded']}
        previous = name
    return actions
def condition(test, yes, no=None): return {'type': 'If', 'expression': ex(test), 'actions': chain(yes), 'else': {'actions': chain(no or {})}, 'runAfter': {}}
def loop(source, actions): return {'type': 'Foreach', 'foreach': ex(source), 'actions': chain(actions), 'runAfter': {}, 'runtimeConfiguration': {'concurrency': {'repetitions': 1}}}
def guard(test, message):
    # Accumulate a safe validation message. Every connector mutation and successful
    # response is gated centrally, so a denied operation cannot write or leak data.
    return action('AppendToStringVariable',{'name':'Error','value':ex(f"if({test},'',{q(message + ' ')})")})
def http(uri, method='GET', payload=None, site=PRIVATE, headers=None, binary=False):
    parameters = {'dataset': site, 'parameters/uri': ex(uri) if not uri.startswith('_api/') else uri, 'parameters/method': method,
                  'parameters/headers': {'Accept': 'application/json;odata=verbose', **(headers or {})}}
    if payload is not None:
        parameters['parameters/body'] = ex(payload) if binary else ex('string(' + payload + ')')
        if not binary: parameters['parameters/headers']['Content-Type'] = 'application/json;odata=verbose'
    return action('OpenApiConnection', {'host': {'apiId': '/providers/Microsoft.PowerApps/apis/shared_sharepointonline', 'connectionName': 'shared_sharepointonline', 'operationId': 'HttpRequest'}, 'parameters': parameters, 'authentication': "@parameters('$authentication')", **({'retryPolicy': {'type': 'none'}} if method != 'GET' else {})})
def endpoint(name, tail=''): return "_api/web/lists/getbytitle('" + name + "')" + tail
def schema_name(name): return 'Schema_' + name
def fields(name, values): return obj({'__metadata': obj({'type': body(schema_name(name)) + "?['d']?['ListItemEntityTypeFullName']"}), **values})
def payload_fields(name, title, payload): return fields(name, {'Title': title, 'Payload': f'string({payload})'})
def find_record(name, title, site=PRIVATE):
    uri = f"concat({q(endpoint(name, '/items?$filter=Title eq '))}, decodeUriComponent('%27'), replace(string({title}), decodeUriComponent('%27'), decodeUriComponent('%27%27')), decodeUriComponent('%27'), '&$top=2')"
    return http(uri, site=site)
def write_item(name, item_id, data, etag):
    return http(f"concat({q(endpoint(name, '/items('))}, string({item_id}), ')')", 'POST', data, headers={'X-HTTP-Method': 'MERGE', 'IF-MATCH': ex(etag)})
def patch_record(label, changes, remove=()):
    result = v('Record')
    for key in remove: result = f'removeProperty({result}, {q(key)})'
    for key, value in changes.items(): result = f'setProperty({result}, {q(key)}, {value})'
    return {label: compose(result), label + '_set': setvar('Record', out(label))}
def item_payload(): return "json(item()?['Payload'])"
def role_match(role, oid=None, division=None, exclude_author=False):
    a = 'item()'
    oid_clause = f"""equals({norm(a + '?["oid"]')}, {norm(oid)})""" if oid else 'true'
    # Single-quoted WDL selectors (double quotes are not WDL string delimiters).
    oid_clause = oid_clause.replace('["oid"]', "['oid']")
    checks = [f"equals({a}?['role'], {role})", oid_clause,
              f"""or(empty({a}?['division']), equals({canonical(a + '?["division"]')}, {canonical(division or v('Record') + '?["division"]')}))""".replace('["division"]', "['division']"),
              f"lessOrEquals(ticks(coalesce({a}?['startsAt'], '0001-01-01T00:00:00Z')), ticks(utcNow()))",
              f"greater(ticks(coalesce({a}?['endsAt'], '9999-12-31T00:00:00Z')), ticks(utcNow()))",
              f"contains({body('Roster_ids')}, {a}?['oid'])"]
    if exclude_author: checks += [f"not(equals({a}?['oid'], {v('Record')}?['authorOid']))", f"or(not(equals({role}, 'publication_approver')), not(equals({a}?['oid'], {v('Record')}?['editorOid'])))"]
    return 'and(' + ', '.join(checks) + ')'
def role_query(role, oid=None, division=None, exclude_author=False): return query(v('Routing') + "?['assignments']", role_match(role, oid, division, exclude_author))
def array_projection(source, field): return action('Select', {'from': ex(source), 'select': ex(field)})


def preflight():
    actions = {}
    for name in PRIVATE_LISTS:
        actions[schema_name(name)] = http(endpoint(name, '?$select=Id,ListItemEntityTypeFullName,HasUniqueRoleAssignments'))
        actions['Restricted_' + name] = guard(body(schema_name(name)) + "?['d']?['HasUniqueRoleAssignments']", 'Newsletter private stores must have verified restricted permissions.')
    for name in MAIN_LISTS:
        actions[schema_name(name)] = http(endpoint(name, '?$select=Id,ListItemEntityTypeFullName,ReadSecurity,WriteSecurity,HasUniqueRoleAssignments'), site=MAIN)
        actions['Own_items_' + name] = guard(f"and(equals({body(schema_name(name))}?['d']?['ReadSecurity'], 2), equals({body(schema_name(name))}?['d']?['WriteSecurity'], 2), {body(schema_name(name))}?['d']?['HasUniqueRoleAssignments'])", 'The request lists must restrict staff to their own items.')
    actions['Download_library'] = http(endpoint('NewsletterDownloads', '?$select=Id,HasUniqueRoleAssignments'), site=MAIN)
    actions['Download_library_is_private'] = guard(body('Download_library') + "?['d']?['HasUniqueRoleAssignments']", 'The download library must remain private; individual results are granted to their requester.')
    actions['Read_runtime_configuration'] = find_record('Newsletter_Configuration', q('settings'))
    actions['Runtime_configuration'] = setvar('Config', "json(first(body('Read_runtime_configuration')?['d']?['results'])?['Payload'])")
    actions['Enabled_configuration'] = guard(v('Config') + "?['enabled']", 'Newsletter processing is disabled in the protected configuration.')
    actions['Read_routing'] = find_record('Newsletter_Routing', q('settings'))
    actions['Routing_defaults'] = setvar('Routing', f"if(empty({body('Read_routing')}?['d']?['results']), {lit({'staff': [], 'assignments': [], 'rpDivision': 'Research & Publication Division', 'reviewDays': 2, 'audit': []})}, json(first({body('Read_routing')}?['d']?['results'])?['Payload']))")
    for listname, label in [('SCPNG Staff Directory', 'Directory'), ('Employee_Profiles', 'Profiles')]:
        actions['Read_' + label] = http(endpoint(listname, '/items?$top=5000&$orderby=Id asc'), site=MAIN)
        actions['Complete_' + label] = guard(f"empty({body('Read_' + label)}?['d']?['__next'])", 'The synchronized staff source is truncated. No requests were processed.')
    actions['Profile_fields'] = http(endpoint('Employee_Profiles', '/fields?$select=InternalName,Title&$top=5000'), site=MAIN)
    actions['Department_field'] = query(body('Profile_fields') + "?['d']?['results']", "or(equals(item()?['InternalName'], 'Department'), equals(toLower(trim(item()?['Title'])), 'department'))")
    actions['One_department_field'] = guard("equals(length(body('Department_field')), 1)", 'The synchronized department field is missing or ambiguous.')
    department = "first(body('Department_field'))?['InternalName']"
    actions['Complete_profiles'] = query(body('Read_Profiles') + "?['d']?['results']", f"and(not(empty(item()?['EntraUserId'])), not(empty(trim(coalesce(item()?[{department}], '')))))")
    actions['Profile_ids'] = array_projection(body('Complete_profiles'), norm("item()?['EntraUserId']"))
    division, email = directory_value('Division'), directory_value('Email')
    actions['Eligible_directory'] = query(body('Read_Directory') + "?['d']?['results']", f"""and(contains({body('Profile_ids')}, {norm("item()?['EntraUserId']")}), equals(length(coalesce(item()?['EntraUserId'], '')), 36), not(empty(trim(coalesce(item()?['Title'], '')))), not(empty(trim(coalesce({division}, '')))), endsWith({norm(email)}, '@scpng.gov.pg'), not(contains(createArray('automation@scpng.gov.pg','allstaff@scpng.gov.pg','allofficers@scpng.gov.pg','boardroom@scpng.gov.pg'), {norm(email)})))""")
    actions['Current_roster'] = select(body('Eligible_directory'), {'oid': norm("item()?['EntraUserId']"), 'name': "trim(item()?['Title'])", 'email': norm(email), 'division': canonical(division), 'active': 'true'})
    actions['Roster_ids'] = array_projection(body('Current_roster'), "item()?['oid']")
    actions['Roster_has_members'] = guard("greater(length(body('Current_roster')), 0)", 'The synchronized staff roster is empty.')
    actions['Departed_staff'] = query(v('Routing') + "?['staff']", "not(contains(body('Roster_ids'), item()?['oid']))")
    actions['Inactive_history'] = array_projection(body('Departed_staff'), "setProperty(item(), 'active', false)")
    actions['Routing_with_current_staff'] = compose(f"""setProperty(setProperty({v('Routing')}, 'staff', union(body('Current_roster'), body('Inactive_history'))), 'rpDivision', {canonical(v('Routing') + '?["rpDivision"]')})""".replace('["rpDivision"]', "['rpDivision']"))
    actions['Set_current_routing'] = setvar('Routing', out('Routing_with_current_staff'))
    actions['Private_folder'] = http(endpoint('NewsletterFiles', '/RootFolder?$select=ServerRelativeUrl'))
    actions['Downloads_folder'] = http(endpoint('NewsletterDownloads', '/RootFolder?$select=ServerRelativeUrl'), site=MAIN)
    actions['Validated_preflight'] = compose("if(empty(variables('Error')),true,div(1,0))")
    return actions


def read_record():
    return {'Find_record': find_record('Newsletter_Submissions', v('Input') + "?['id']"),
            'One_record': guard("equals(length(body('Find_record')?['d']?['results']), 1)", 'Newsletter not found.'),
            'Load_record': setvar('Record', "json(first(body('Find_record')?['d']?['results'])?['Payload'])"),
            'Record_id': setvar('RecordItemId', "int(first(body('Find_record')?['d']?['results'])?['Id'])"),
            'Record_etag': setvar('RecordETag', "first(body('Find_record')?['d']?['results'])?['__metadata']?['etag']")}
def can_read():
    return {'Read_authority': query(v('Routing') + "?['assignments']", role_match("item()?['role']", v('Actor') + "?['oid']")),
            'Allowed_to_read': guard(f"or(equals({v('Record')}?['authorOid'], {v('Actor')}?['oid']), greater(length(body('Read_authority')), 0))", 'You cannot access this newsletter.')}
def editable(): return f"and(equals({v('Record')}?['authorOid'], {v('Actor')}?['oid']), contains(createArray('draft','returned'), {v('Record')}?['status']))"
def commit(label='Commit_record', new=False):
    return {label + '_capacity': guard(f"less(length(string({v('Record')})), 60000)", 'This newsletter history has reached capacity. Contact IT.'),
            label + '_started': setvar('MutationStarted', 'true'),
            label: http(endpoint('Newsletter_Submissions', '/items'), 'POST', payload_fields('Newsletter_Submissions', v('Record') + "?['id']", v('Record'))) if new else write_item('Newsletter_Submissions', v('RecordItemId'), payload_fields('Newsletter_Submissions', v('Record') + "?['id']", v('Record')), v('RecordETag')),
            label + '_result': setvar('Output', v('Record'))}
def add_event():
    event = obj({'at': v('Now'), 'actor': v('Actor') + "?['oid']", 'name': v('Actor') + "?['name']", 'action': v('Input') + "?['action']", 'comment': "trim(coalesce(variables('Input')?['comment'], ''))", 'version': v('Record') + "?['version']"})
    return patch_record('Append_event', {'updatedAt': v('Now'), 'revision': f"add(int({v('Record')}?['revision']), 1)", 'events': f"union({v('Record')}?['events'], createArray({event}))"})
def assign_stage():
    role = "if(equals(variables('NextStage'), 'division_review'), 'division_approver', if(equals(variables('NextStage'), 'editorial_review'), 'editor', if(equals(variables('NextStage'), 'clearance'), 'clearance', 'publication_approver')))"
    yes = {'Candidates': role_query(role, exclude_author=True), 'Candidate_ids': array_projection(body('Candidates'), "item()?['oid']"),
           'Exactly_one_reviewer': guard("equals(length(union(body('Candidate_ids'),body('Candidate_ids'))), 1)", 'Configure exactly one eligible reviewer; authors cannot review themselves and alternate dates must not overlap.'),
           **patch_record('Assign_reviewer', {'status': v('NextStage'), 'assignedOid': "first(body('Candidate_ids'))"}, ['dueAt']),
           'Deadline_start': setvar('Deadline', v('Now')), 'Working_days_start': setvar('WorkingDays', '0'),
           'Working_day_deadline': {'type': 'Until', 'expression': ex(f"greaterOrEquals({v('WorkingDays')}, int({v('Routing')}?['reviewDays']))"), 'limit': {'count': 50, 'timeout': 'PT1M'}, 'actions': chain({
               'Next_day': compose(f"addDays({v('Deadline')}, 1)"), 'Set_next_day': setvar('Deadline', out('Next_day')),
               'Count_weekday': action('IncrementVariable',{'name':'WorkingDays','value':ex(f"if(contains(createArray(0,6),dayOfWeek(addHours({v('Deadline')},10))),0,1)")})}), 'runAfter': {}},
           **patch_record('Set_deadline', {'dueAt': v('Deadline')})}
    no = patch_record('Set_unassigned_stage', {'status': v('NextStage')}, ['assignedOid', 'dueAt'])
    return {'Assign_stage': condition(f"contains(createArray('division_review','editorial_review','clearance','publication_review'), {v('NextStage')})", yes, no)}
def snapshot_record():
    filename = f"concat('newsletter-', {v('Record')}?['id'], '-version-', {v('Record')}?['version'], '.json')"
    return file_write('Write_version_snapshot', filename, f"""string({obj({'version': v('Record') + '?["version"]', 'content': v('Record') + '?["content"]', 'at': v('Now')})})""".replace('["', "['").replace('"]', "']"))
def file_write(label, name, content, site=PRIVATE, folder='Private_folder'):
    uri = f"concat('_api/web/GetFolderByServerRelativeUrl(', decodeUriComponent('%27'), {body(folder)}?['d']?['ServerRelativeUrl'], decodeUriComponent('%27'), ')/Files/add(url=', decodeUriComponent('%27'), {name}, decodeUriComponent('%27'), ',overwrite=false)')"
    return {label: http(uri, 'POST', content, site=site, binary=True)}


def validate_content():
    c = v('Record') + "?['content']"
    return {'Valid_content': guard(f"and(lessOrEquals(length(coalesce({c}?['title'], '')),180), lessOrEquals(length(coalesce({c}?['summary'], '')),500), lessOrEquals(length(coalesce({c}?['body'], '')),16000), lessOrEquals(length(coalesce({c}?['category'], '')),80), or(empty({c}?['imageUrl']), startsWith({c}?['imageUrl'], 'https://')), lessOrEquals(length({c}?['attachments']),5))", 'Check newsletter content lengths, cover URL and attachments.'),
            'Attachment_ids':array_projection(c + "?['attachments']","item()?['id']"),
            'Unique_attachment_ids':guard("equals(length(union(body('Attachment_ids'),body('Attachment_ids'))),length(body('Attachment_ids')))",'An attachment can appear only once.'),
            'Check_attachments': loop(c + "?['attachments']", {'Find_content_attachment': find_record('Newsletter_Attachments', "items('Check_attachments')?['id']"),
                 'Attachment_belongs_to_record': guard(f"and(equals(length(body('Find_content_attachment')?['d']?['results']),1), equals(json(first(body('Find_content_attachment')?['d']?['results'])?['Payload'])?['submissionId'], {v('Record')}?['id']),equals(json(first(body('Find_content_attachment')?['d']?['results'])?['Payload'])?['name'],items('Check_attachments')?['name']),equals(json(first(body('Find_content_attachment')?['d']?['results'])?['Payload'])?['size'],items('Check_attachments')?['size']))", 'An attachment does not belong to this newsletter.')})}


def project_publication():
    n = v('Record'); c = n + "?['content']"
    projection = obj({'id': n + "?['id']", 'title': c + "?['title']", 'summary': c + "?['summary']", 'body': f"if(equals({n}?['status'],'withdrawn'), '', {c}?['body'])", 'imageUrl': c + "?['imageUrl']", 'category': c + "?['category']", 'division': n + "?['division']", 'authorName': n + "?['authorName']", 'attachments': f"if(equals({n}?['status'],'withdrawn'), json('[]'), {c}?['attachments'])", 'publishedAt': n + "?['publishedAt']", 'firstPublishedAt': n + "?['firstPublishedAt']", 'version': n + "?['publishedVersion']", 'status': n + "?['status']", 'notice': f"if(equals({n}?['status'],'withdrawn'), 'This newsletter has been withdrawn by Research & Publication.', '')"})
    # On withdrawal preserve the previously published headline/metadata, including during a correction draft.
    return {'Publication_change_started':setvar('MutationStarted','true'), 'Find_projection': find_record('Newsletter_Publications', n + "?['id']"),
            'Publication_data': compose(f"if(and(equals({n}?['status'],'withdrawn'),not(empty(body('Find_projection')?['d']?['results']))), setProperty(setProperty(setProperty(setProperty(json(first(body('Find_projection')?['d']?['results'])?['Payload']),'status','withdrawn'),'body',''),'attachments',json('[]')),'notice','This newsletter has been withdrawn by Research & Publication.'), {projection})"),
            'Write_projection': condition("empty(body('Find_projection')?['d']?['results'])", {'Create_projection': http(endpoint('Newsletter_Publications', '/items'), 'POST', payload_fields('Newsletter_Publications', n + "?['id']", out('Publication_data')))}, {'Update_projection': write_item('Newsletter_Publications', "first(body('Find_projection')?['d']?['results'])?['Id']", payload_fields('Newsletter_Publications', n + "?['id']", out('Publication_data')), "first(body('Find_projection')?['d']?['results'])?['__metadata']?['etag']")})}


def notify_record():
    recipient = f"if(empty({v('Record')}?['assignedOid']), {v('Record')}?['authorOid'], {v('Record')}?['assignedOid'])"
    note_id = f"concat({v('Record')}?['id'], '-', string({v('Record')}?['revision']), '-', {recipient})"
    note = obj({'id': f"concat('newsletter:', {note_id})", 'title': q('Newsletter workflow update'), 'message': f"concat({v('Record')}?['content']?['title'], ': ', {v('Record')}?['status'])", 'recipientOid': recipient, 'recipientEmail': q(''), 'type': q('approval'), 'category': q('newsletter'), 'actionUrl': f"concat('/news/newsletters/workspace/', {v('Record')}?['id'])", 'isRead': 'false', 'createdAt': v('Now'), 'createdBy': v('Actor') + "?['name']"})
    return {'Find_note': find_record('Newsletter_Notifications', note_id), 'Create_note_once': condition("empty(body('Find_note')?['d']?['results'])", {'Create_note': http(endpoint('Newsletter_Notifications', '/items'), 'POST', payload_fields('Newsletter_Notifications', note_id, note))})}


def transition_actions():
    n = v('Record'); i = v('Input'); actor = v('Actor') + "?['oid']"
    submit = {'Can_submit': guard(editable(), 'Only the author can submit an editable draft.'), **validate_content(),
              'Content_ready': guard(f"and(not(empty(trim({n}?['content']?['title']))),not(empty(trim({n}?['content']?['summary']))),not(empty(trim({n}?['content']?['body']))),equals({n}?['content']?['sensitiveChecked'],true))", 'Add title, summary and content, and complete the sensitive-information check.'),
              **patch_record('Clear_previous_approval', {}, ['approvedVersion', 'scheduledAt']),
              'Submission_stage': setvar('NextStage', f"""if(equals({canonical(n + '?["division"]')}, {canonical(v('Routing') + '?["rpDivision"]')}),'editorial_review','division_review')""".replace('["', "['").replace('"]', "']")), **assign_stage()}
    review_role = f"if(equals({n}?['status'],'division_review'),'division_approver',if(equals({n}?['status'],'editorial_review'),'editor',if(equals({n}?['status'],'clearance'),'clearance','publication_approver')))"
    review_guard = {'Current_review_authority': role_query(review_role, actor), 'Can_review': guard(f"and(contains(createArray('division_review','editorial_review','clearance','publication_review'),{n}?['status']),equals({n}?['assignedOid'],{actor}),not(equals({n}?['authorOid'],{actor})),greater(length(body('Current_review_authority')),0))", 'This review is not assigned to you, your authority expired, or you are its author.')}
    approve = {**review_guard,
               'Independent_final_approval': guard(f"or(not(equals({n}?['status'],'publication_review')),not(equals({n}?['editorOid'],{actor})))", 'Final approval must be independent of editorial review.'),
               'Remember_editor': condition(f"equals({n}?['status'],'editorial_review')", patch_record('Remember_editor_id', {'editorOid': actor})),
               'Bind_approved_version': condition(f"equals({n}?['status'],'publication_review')", patch_record('Bind_version', {'approvedVersion': n + "?['version']"})),
               'Approval_stage': setvar('NextStage', f"if(equals({n}?['status'],'division_review'),'editorial_review',if(equals({n}?['status'],'editorial_review'),if(equals({n}?['content']?['needsClearance'],true),'clearance','publication_review'),if(equals({n}?['status'],'clearance'),'publication_review','approved')))"), **assign_stage()}
    rejected = {**review_guard, 'Decision_reason': guard(f"not(empty(trim(coalesce({i}?['comment'],''))))", 'Provide a reason for returning or rejecting.'),
                **patch_record('Return_or_reject', {'returnStage': n + "?['status']", 'status': f"if(equals({i}?['action'],'return'),'returned','rejected')", 'assignedOid': n + "?['authorOid']"}, ['dueAt', 'approvedVersion'])}
    publisher_guard = {'Current_publishing_authority': role_query(q('publisher'), actor), 'Can_publish': guard("greater(length(body('Current_publishing_authority')),0)", 'Only an authorized publisher can perform this action.')}
    publish = {**publisher_guard, 'Version_is_approved': guard(f"and(contains(createArray('approved','scheduled'),{n}?['status']),equals({n}?['approvedVersion'],{n}?['version']))", 'The current version must have final approval.'),
               **patch_record('Mark_published', {'status': q('published'), 'publishedAt': v('Now'), 'firstPublishedAt': f"coalesce({n}?['firstPublishedAt'],{v('Now')})", 'publishedVersion': n + "?['version']", 'notification': lit({'state': 'queued'})}, ['scheduledAt'])}
    schedule = {**publisher_guard, 'Scheduling_enabled': guard(v('Config') + "?['schedulingEnabled']", 'Scheduled publication is not enabled.'), 'Schedule_version': guard(f"and(equals({n}?['status'],'approved'),equals({n}?['approvedVersion'],{n}?['version']),greater(ticks({i}?['scheduledAt']),ticks(utcNow())))", 'Choose a future time for the approved version.'), **patch_record('Set_schedule', {'status': q('scheduled'), 'scheduledAt': i + "?['scheduledAt']", 'scheduledBy': actor})}
    cancel = {**publisher_guard, 'Is_scheduled': guard(f"equals({n}?['status'],'scheduled')", 'This newsletter is not scheduled.'), **patch_record('Cancel_schedule', {'status': q('approved')}, ['scheduledAt', 'scheduledBy'])}
    maintain = {**publisher_guard, 'Maintenance_reason': guard(f"not(empty(trim(coalesce({i}?['comment'],''))))", 'Explain the archive or withdrawal.'), 'Has_publication': guard(f"and(not(empty({n}?['publishedVersion'])),or(equals({i}?['action'],'withdraw'),contains(createArray('published','archived'),{n}?['status'])))", 'Only a published newsletter can be archived or withdrawn.'), **patch_record('Maintain_publication', {'status': f"if(equals({i}?['action'],'withdraw'),'withdrawn','archived')"}, ['assignedOid', 'dueAt'])}
    reassign = {**publisher_guard, 'Reassignment_reason': guard(f"and(contains(createArray('division_review','editorial_review','clearance','publication_review'),{n}?['status']),not(empty(trim(coalesce({i}?['comment'],'')))))", 'Only a pending review can be reassigned, with a reason.'), 'Reassignment_stage': setvar('NextStage', n + "?['status']"), **assign_stage()}
    revise = {'Can_revise': guard(f"and(equals({n}?['authorOid'],{actor}),contains(createArray('published','archived'),{n}?['status']),not(empty(trim(coalesce({i}?['comment'],'')))))", 'Only the author can start a correction, with a reason.'), **patch_record('New_correction', {'status': q('draft'), 'version': 'guid()'}, ['approvedVersion', 'assignedOid', 'dueAt', 'scheduledAt', 'scheduledBy']), **snapshot_record()}
    switch = {'type': 'Switch', 'expression': ex(i + "?['action']"), 'cases': {name: {'case': name, 'actions': chain(copy.deepcopy(actions))} for name, actions in [('submit',submit),('approve',approve),('return',rejected),('reject',rejected),('publish',publish),('schedule',schedule),('cancel_schedule',cancel),('archive',maintain),('withdraw',maintain),('reassign',reassign),('revise',revise)]}, 'default': {'actions': {'Unknown_action': guard('false', 'Unknown newsletter workflow action.')}}, 'runAfter': {}}
    return {'Workflow_transition': switch, **add_event(),
            # Hide a withdrawal before committing private state; a later failure cannot expose withdrawn content.
            'Hide_withdrawal_first': condition(f"equals({i}?['action'],'withdraw')", project_publication()),
            **commit(), 'Update_publication': condition(f"contains(createArray('publish','archive'),{i}?['action'])", project_publication()), **notify_record()}


def request_actions():
    i = v('Input'); n = v('Record')
    create_record = {'id': 'guid()', 'authorOid': v('Actor') + "?['oid']", 'authorName': v('Actor') + "?['name']", 'division': v('Actor') + "?['division']", 'divisionApprovalRequired':f"not(equals({v('Actor')}?['division'],{v('Routing')}?['rpDivision']))", 'status': q('draft'), 'content': lit({'title':'','summary':'','body':'','imageUrl':'','category':'SCPNG News','requestedDate':'','sensitiveChecked':False,'needsClearance':False,'attachments':[]}), 'version': 'guid()', 'revision': '0', 'createdAt': v('Now'), 'updatedAt': v('Now'), 'events': "json('[]')"}
    create = {'New_record': setvar('Record', obj(create_record)), **add_event(), **snapshot_record(), **commit(new=True)}
    save = {'Author_can_edit': guard(editable(), 'Only the author can edit a draft or returned newsletter.'), **patch_record('Save_content', {'content': i + "?['content']", 'version': 'guid()'}, ['approvedVersion']), **validate_content(), **add_event(), **snapshot_record(), **commit()}
    session = {'Actor_roles': query(v('Routing') + "?['assignments']", role_match("item()?['role']", v('Actor') + "?['oid']", v('Actor') + "?['division']")), 'Session_result': setvar('Output', obj({'actor': v('Actor'), 'roles': body('Actor_roles'), 'capabilities': obj({'scheduling': v('Config') + "?['schedulingEnabled']", 'staffEmail': v('Config') + "?['emailEnabled']"})}))}
    list_records = {'All_submissions': http(endpoint('Newsletter_Submissions', '/items?$top=5000')), 'Complete_submissions': guard("empty(body('All_submissions')?['d']?['__next'])", 'The submission inventory exceeds its page limit. Contact IT.'), 'Submission_array': array_projection(body('All_submissions') + "?['d']?['results']", item_payload()), 'Empty_submission_result': setvar('Output', "json('[]')"), 'Filter_readable_submissions': loop(body('Submission_array'), {'Candidate_record': setvar('Record', "items('Filter_readable_submissions')"), 'Candidate_authority': query(v('Routing') + "?['assignments']", role_match("item()?['role']", v('Actor') + "?['oid']")), 'Admit_candidate': condition(f"or(equals({n}?['authorOid'],{v('Actor')}?['oid']),greater(length(body('Candidate_authority')),0))", {'Append_readable_submission': compose(f"union({v('Output')},createArray({n}))"), 'Set_readable_submissions': setvar('Output', out('Append_readable_submission'))})})}
    list_records.update({'Sort_readable_records':compose("reverse(sort(variables('Output'),'updatedAt'))"),'Sorted_record_result':setvar('Output',out('Sort_readable_records'))})
    get = {'Get_record_result': setvar('Output', n)}
    version = {'Version_in_history': query(n + "?['events']", f"equals(item()?['version'],{i}?['version'])"), 'Version_was_recorded': guard("greater(length(body('Version_in_history')),0)", 'Version not found.'),
               'Read_version_file': http(f"concat('_api/web/GetFileByServerRelativeUrl(',decodeUriComponent('%27'),body('Private_folder')?['d']?['ServerRelativeUrl'],'/newsletter-',{n}?['id'],'-version-',{i}?['version'],'.json',decodeUriComponent('%27'),')/$value')"), 'Historical_version_result': setvar('Output', f"json(string({body('Read_version_file')}))")}
    transition = transition_actions()
    transition_cases = transition.pop('Workflow_transition')['cases']
    operations = {'session':session, 'create':create, 'list':list_records, 'public_list':public_read(False), 'public_get':public_read(True), 'notifications':notification_read(False), 'read_notification':notification_read(True), 'download':download_actions(), 'get':get, 'version':version, 'save':save, 'upload':upload_actions()}
    cases = {name:{'case':name,'actions':chain(actions)} for name,actions in operations.items()}
    cases.update(transition_cases)
    record_commands = ['get','version','save','upload'] + list(transition_cases)
    return {'Load_record_when_needed': condition(f"contains({lit(record_commands)},{i}?['action'])",{**read_record(),**can_read(),'Mutation_revision':guard(f"or(contains(createArray('get','version'),{i}?['action']),equals({i}?['revision'],{n}?['revision']))",'This newsletter changed. Reload before trying again.')}),
            'Comment_length':guard(f"lessOrEquals(length(coalesce({i}?['comment'],'')),2000)",'Comments must be at most 2,000 characters.'),
            'Route_action': {'type':'Switch','expression':ex(i + "?['action']"),'cases':cases,'default':{'actions':{'Unknown_action':guard('false','Unknown newsletter action.')}},'runAfter':{}},
            'Commit_workflow_change':condition(f"contains({lit(list(transition_cases))},{i}?['action'])",transition)}



def upload_actions():
    i=v('Input'); n=v('Record')
    data = obj({'id': out('Attachment_id'), 'submissionId': n + "?['id']", 'name': i + "?['name']", 'size': f"length(base64ToBinary({i}?['base64']))", 'mime': q('application/octet-stream'), 'path': f"concat(body('Private_folder')?['d']?['ServerRelativeUrl'],'/newsletter-',{n}?['id'],'-attachment-',outputs('Attachment_id'))"})
    return {'Author_can_upload': guard(editable(), 'Only the author can upload to an editable draft.'), 'Attachment_size': guard(f"and(greater(length({i}?['base64']),0),lessOrEquals(length({i}?['base64']),4194304),lessOrEquals(length(base64ToBinary({i}?['base64'])),3145728),lessOrEquals(length({i}?['name']),120),or(endsWith(toLower({i}?['name']),'.pdf'),endsWith(toLower({i}?['name']),'.docx'),endsWith(toLower({i}?['name']),'.xlsx'),endsWith(toLower({i}?['name']),'.png'),endsWith(toLower({i}?['name']),'.jpg'),endsWith(toLower({i}?['name']),'.jpeg')))", 'Use a PDF, DOCX, XLSX, PNG or JPG file of at most 3 MB.'), 'Attachment_id': compose('guid()'),
            **file_write('Store_attachment_bytes', f"concat('newsletter-',{n}?['id'],'-attachment-',outputs('Attachment_id'))", f"base64ToBinary({i}?['base64'])"),
            'Attachment_metadata': compose(data), 'Store_attachment_metadata': http(endpoint('Newsletter_Attachments','/items'),'POST',payload_fields('Newsletter_Attachments',out('Attachment_id'),out('Attachment_metadata'))),
            'Uploaded_attachment_result': setvar('Output', f"removeProperty(removeProperty({out('Attachment_metadata')},'submissionId'),'path')")}


def public_read(single):
    actions = {'Publications': http(endpoint('Newsletter_Publications','/items?$top=5000')), 'Complete_publications': guard("empty(body('Publications')?['d']?['__next'])", 'The publication feed exceeds its page limit. Contact IT.'), 'Publication_array': array_projection(body('Publications') + "?['d']?['results']",item_payload()), 'Visible_publications': query(body('Publication_array'), "not(equals(item()?['status'],'withdrawn'))"), 'Public_result': setvar('Output', "reverse(sort(body('Visible_publications'),'publishedAt'))")}
    if single: actions.update({'Find_publication': query(body('Publication_array'), f"equals(item()?['id'],{v('Input')}?['id'])"), 'Publication_exists': guard("equals(length(body('Find_publication')),1)", 'Published newsletter not found.'), 'Single_publication': setvar('Output', "first(body('Find_publication'))")})
    return actions


def notification_read(mark):
    if not mark: return {'All_notes':http(endpoint('Newsletter_Notifications','/items?$top=5000')), 'Complete_notes':guard("empty(body('All_notes')?['d']?['__next'])",'Notification paging requires an archive. Contact IT.'), 'Note_array':array_projection(body('All_notes') + "?['d']?['results']", item_payload()), 'My_notes':query(body('Note_array'),f"equals(item()?['recipientOid'],{v('Actor')}?['oid'])"), 'Notes_result':setvar('Output',"take(reverse(sort(body('My_notes'),'createdAt')),100)")}
    title=f"replace({v('Input')}?['noteId'],'newsletter:','')"
    return {'Find_my_note':find_record('Newsletter_Notifications',title), 'My_note':compose("json(first(body('Find_my_note')?['d']?['results'])?['Payload'])"), 'Own_note':guard(f"equals(outputs('My_note')?['recipientOid'],{v('Actor')}?['oid'])",'This notification belongs to another officer.'), 'Mark_my_note':write_item('Newsletter_Notifications',"first(body('Find_my_note')?['d']?['results'])?['Id']",payload_fields('Newsletter_Notifications',title,"setProperty(outputs('My_note'),'isRead',true)"),"first(body('Find_my_note')?['d']?['results'])?['__metadata']?['etag']"), 'Read_note_result':setvar('Output',lit({'ok':True}))}


def stage_result(label, filename, content):
    uri=f"concat('_api/web/GetFileByServerRelativeUrl(',decodeUriComponent('%27'),body('{label}')?['d']?['ServerRelativeUrl'],decodeUriComponent('%27'),')/ListItemAllFields?$select=Id')"
    itemid=f"body('{label}_item')?['d']?['Id']"
    acl=f"concat({q(endpoint('NewsletterDownloads','/items('))},string({itemid}),')')"
    return {**file_write(label,filename,content,site=MAIN,folder='Downloads_folder'),label+'_item':http(uri,site=MAIN),label+'_restrict':http(f"concat({acl},'/breakroleinheritance(copyRoleAssignments=false,clearSubscopes=true)')",'POST',site=MAIN),
            label+'_read_for_requester':http(f"concat({acl},'/roleassignments/addroleassignment(principalid=',string({v('Request')}?['AuthorId']),',roledefid=1073741826)')",'POST',site=MAIN),
            label+'_reference':compose(obj({'siteId':v('Config') + "?['requestGraphSiteId']",'listId':"body('Download_library')?['d']?['Id']",'itemId':itemid}))}


def download_actions():
    n=v('Record'); i=v('Input')
    checks={**read_record(), **can_read()}
    # Published readers do not receive private submission data; validate against the published attachment list instead.
    publicchecks={'Find_published_download':find_record('Newsletter_Publications',i + "?['id']"),'Published_download':compose("json(first(body('Find_published_download')?['d']?['results'])?['Payload'])"),'Not_withdrawn':guard("not(equals(outputs('Published_download')?['status'],'withdrawn'))",'This publication was withdrawn.'),'Public_attachment':query("outputs('Published_download')?['attachments']",f"equals(item()?['id'],{i}?['attachmentId'])"),'Attachment_was_published':guard("equals(length(body('Public_attachment')),1)",'Attachment not found in the publication.')}
    return {'Download_access':condition(f"equals({i}?['published'],true)",publicchecks,{**checks,'Private_attachment':query(n + "?['content']?['attachments']",f"equals(item()?['id'],{i}?['attachmentId'])"),'Attachment_in_record':guard("equals(length(body('Private_attachment')),1)",'Attachment not found.')}),
            'Find_download_file':find_record('Newsletter_Attachments',i + "?['attachmentId']"),'Download_metadata':compose("json(first(body('Find_download_file')?['d']?['results'])?['Payload'])"),
            'Read_attachment_content':action('OpenApiConnection',{'host':{'apiId':'/providers/Microsoft.PowerApps/apis/shared_sharepointonline','connectionName':'shared_sharepointonline','operationId':'GetFileContentByPath'},'parameters':{'dataset':PRIVATE,'path':"@outputs('Download_metadata')?['path']",'inferContentType':True},'authentication':"@parameters('$authentication')"}),
            **stage_result('Copy_download',"concat('download-',guid(),'.',toLower(last(split(outputs('Download_metadata')?['name'],'.'))))",body('Read_attachment_content')),
            'Download_result':setvar('Output',obj({'downloadFile':out('Copy_download_reference')}))}


def intranet_admin_access():
    rows="body('Read_intranet_role')?['d']?['results']"
    role=f"if(equals(length({rows}),1),first({rows}),json('{{}}'))"
    members=f"split(replace(coalesce({role}?['Groups'],''),', ',','),',')"
    raw="coalesce(item()?[body('Group_permission_field')?['d']?['InternalName']],'[]')"
    permissions=f"json({raw})"
    compact='or('+','.join(f"contains({permissions},{q(token)})" for token in ['newsletter_routing:manage','newsletter_routing:read,manage','newsletter_routing:manage,read','newsletter_routing:*','all:*'])+')'
    expanded=f"or(contains(coalesce({permissions}?['newsletter_routing'],json('[]')),'manage'),contains(coalesce({permissions}?['newsletter_routing'],json('[]')),'*'),contains(coalesce({permissions}?['all'],json('[]')),'*'))"
    granted=f"if(startsWith(trim({raw}),'['),{compact},{expanded})"
    administrator=f"or(contains(createArray('admin','super_admin'),{role}?['Role']),equals({role}?['IsAdmin'],true),equals({role}?['IsAdmin'],'Yes'),equals({role}?['IsAdmin'],'true'))"
    return {
        'Role_store_permissions':http(endpoint('UserRoles','?$select=HasUniqueRoleAssignments'),site=MAIN),
        'Group_store_permissions':http(endpoint('PermissionGroups','?$select=HasUniqueRoleAssignments'),site=MAIN),
        'Read_intranet_role':find_record('UserRoles',norm("coalesce(body('Request_creator_profile')?['userPrincipalName'],body('Request_creator_profile')?['mail'],variables('Actor')?['email'])"),site=MAIN),
        'Group_permission_field':http(endpoint('PermissionGroups',"/fields/getbytitle('Permissions')?$select=InternalName"),site=MAIN),
        'Read_intranet_groups':http(endpoint('PermissionGroups','/items?$top=5000'),site=MAIN),
        'Newsletter_management_groups':query("body('Read_intranet_groups')?['d']?['results']",f"and(contains({members},item()?['Title']),{granted})"),
        'Authorized_routing_admin':guard(f"and(equals(length({rows}),1),empty(body('Read_intranet_role')?['d']?['__next']),empty(body('Read_intranet_groups')?['d']?['__next']),equals(body('Role_store_permissions')?['d']?['HasUniqueRoleAssignments'],true),equals(body('Group_store_permissions')?['d']?['HasUniqueRoleAssignments'],true),or({administrator},greater(length(body('Newsletter_management_groups')),0)))",'This account is not authorized to manage newsletter routing, or the intranet access lists need protected permissions.'),
    }


def routing_admin():
    i=v('Input'); existing="body('Read_routing')?['d']?['results']"
    view = lambda config,etag,configured: obj({'etag':etag,'configured':configured,'config':config,'roster':body('Current_roster'),'warnings':"json('[]')"})
    get={'Routing_admin_result':setvar('Output',view(v('Routing'),f"if(empty({existing}),null,first({existing})?['__metadata']?['etag'])",f"not(empty({existing}))"))}
    candidate=i + "?['config']"
    save={'Routing_version_matches':guard(f"equals(coalesce({i}?['etag'],''),if(empty({existing}),'',first({existing})?['__metadata']?['etag']))",'Newsletter routing changed. Reload before saving.'),
          'Routing_reason':guard(f"and(greaterOrEquals(length(trim(coalesce({i}?['reason'],''))),5),lessOrEquals(length({i}?['reason']),500))",'Explain the appointment change in 5 to 500 characters.'),
          'Valid_routing_settings':guard(f"and(greaterOrEquals(int({candidate}?['reviewDays']),1),lessOrEquals(int({candidate}?['reviewDays']),30),lessOrEquals(length({candidate}?['assignments']),150),not(empty({candidate}?['rpDivision'])))",'Check the R&P division, review deadline and number of appointments.'),
          'R_and_P_exists':query(body('Current_roster'),f"""and({known_division("item()?['division']")},equals(item()?['division'],{canonical(candidate + '?["rpDivision"]')}))""".replace('["rpDivision"]',"['rpDivision']")),
          'R_and_P_is_current':guard("greater(length(body('R_and_P_exists')),0)",'Choose the R&P division from the current roster.'),
          'Validate_appointments':loop(candidate + "?['assignments']",appointment_validation()),
          'Escalation_contact':query(body('Current_roster'),f"or(empty({candidate}?['escalationOid']),equals(item()?['oid'],{candidate}?['escalationOid']))"),
          'Escalation_is_current':guard("greater(length(body('Escalation_contact')),0)",'Choose a current staff member for escalations.'),
          'Sanitized_appointments':select(candidate + "?['assignments']",{'oid':norm("item()?['oid']"),'role':"item()?['role']",'division':canonical("coalesce(item()?['division'],'')"),'startsAt':"if(empty(item()?['startsAt']),null,item()?['startsAt'])",'endsAt':"if(empty(item()?['endsAt']),null,item()?['endsAt'])"}),
          'Trusted_routing':compose(obj({'staff':v('Routing') + "?['staff']",'assignments':body('Sanitized_appointments'),'rpDivision':canonical(candidate + "?['rpDivision']"),'reviewDays':candidate + "?['reviewDays']",'escalationOid':f"coalesce({candidate}?['escalationOid'],'')",'audit':v('Routing') + "?['audit']"})),
          'Audit_version':compose('guid()'),'Routing_audit':compose(obj({'version':out('Audit_version'),'at':v('Now'),'actorOid':v('Actor') + "?['oid']",'reason':i + "?['reason']",'snapshotFile':"concat('newsletter-routing-',outputs('Audit_version'),'.json')"})),
          'Audited_routing':compose(f"setProperty(outputs('Trusted_routing'),'audit',union(coalesce({v('Routing')}?['audit'],json('[]')),createArray(outputs('Routing_audit'))))"),
          'Routing_capacity':guard("less(length(string(outputs('Audited_routing'))),60000)",'Routing history has reached capacity. Contact IT.'),
          **file_write('Save_routing_snapshot',"outputs('Routing_audit')?['snapshotFile']",f"string({obj({'before':v('Routing'),'after':out('Audited_routing'),'audit':out('Routing_audit')})})"),
          'Routing_write_started':setvar('MutationStarted','true'),
          'Save_routing_item':condition(f"empty({existing})",{'Create_routing_item':http(endpoint('Newsletter_Routing','/items'),'POST',payload_fields('Newsletter_Routing',q('settings'),out('Audited_routing')))}, {'Update_routing_item':write_item('Newsletter_Routing',f"first({existing})?['Id']",payload_fields('Newsletter_Routing',q('settings'),out('Audited_routing')),f"first({existing})?['__metadata']?['etag']")}),
          'Reload_routing_item':find_record('Newsletter_Routing',q('settings')),'Set_saved_routing':setvar('Routing',out('Audited_routing')),
          'Verified_routing_save':guard("equals(last(json(first(body('Reload_routing_item')?['d']?['results'])?['Payload'])?['audit'])?['version'],outputs('Audit_version'))",'Routing save could not be verified. Reload before retrying.'),
          'Saved_routing_result':setvar('Output',view(out('Audited_routing'),"first(body('Reload_routing_item')?['d']?['results'])?['__metadata']?['etag']",'true'))}
    return {**intranet_admin_access(),
            'Get_or_save_routing':condition(f"equals({i}?['action'],'routing_admin_get')",get,save)}


def appointment_validation():
    a="items('Validate_appointments')"
    confirmed_scope = known_division(a + "?['division']")
    lo=lambda value:f"ticks(coalesce({value}?['startsAt'],'0001-01-01T00:00:00Z'))"
    hi=lambda value:f"ticks(coalesce({value}?['endsAt'],'9999-12-31T00:00:00Z'))"
    scope=f"""or(empty(item()?['division']),empty({a}?['division']),equals({canonical("item()?['division']")},{canonical(a + '?["division"]')}))""".replace('["division"]',"['division']")
    return {'Appointment_history_person':query(v('Routing') + "?['staff']",f"equals(item()?['oid'],{a}?['oid'])"),
            'Appointment_person':guard(f"and(equals(length(body('Appointment_history_person')),1),or(contains(body('Roster_ids'),{a}?['oid']),lessOrEquals({hi(a)},ticks(utcNow()))))",'Choose a current staff member; end or remove appointments for departed officers.'),
            'Appointment_role':guard(f"contains(createArray('division_approver','editor','publication_approver','publisher','clearance'),{a}?['role'])",'Choose a valid newsletter responsibility.'),
            'Appointment_division_required':guard(f"or(not(equals({a}?['role'],'division_approver')),not(empty({a}?['division'])))",'Divisional approvers need an explicit division.'),
            'Appointment_scope_exists':query(body('Current_roster'),f"""or(empty({a}?['division']),equals(item()?['division'],{canonical(a + '?["division"]')}))""".replace('["division"]',"['division']")),
            'Known_appointment_scope':guard(f"and(greater(length(body('Appointment_scope_exists')),0),or(empty({a}?['division']),{confirmed_scope}))",'Choose a confirmed current division.'),
            'Appointment_dates':guard(f"less({lo(a)},{hi(a)})",'An appointment must end after it starts.'),
            'Overlapping_role_rows':query(v('Input') + "?['config']?['assignments']",f"and(equals(item()?['role'],{a}?['role']),{scope},less({lo('item()')},{hi(a)}),greater({hi('item()')},{lo(a)}),or(not(equals({a}?['role'],'publisher')),equals(item()?['oid'],{a}?['oid'])))"),
            'No_overlapping_reviewer':guard("equals(length(body('Overlapping_role_rows')),1)",'Overlapping appointments: end the existing appointment before its replacement starts.'),
            'Conflicting_final_reviewer':query(v('Input') + "?['config']?['assignments']",f"and(equals(item()?['oid'],{a}?['oid']),{scope},less({lo('item()')},{hi(a)}),greater({hi('item()')},{lo(a)}),or(and(equals(item()?['role'],'editor'),equals({a}?['role'],'publication_approver')),and(equals(item()?['role'],'publication_approver'),equals({a}?['role'],'editor'))))"),
            'Independent_editor_and_final':guard("empty(body('Conflicting_final_reviewer'))",'Editorial review and final approval must be independent.')}


def process_request():
    req=v('Request'); ledger="first(body('Find_request_ledger')?['d']?['results'])"
    actions={'Request_from_queue':setvar('Request',"items('Drain_requests')"),'Reset_mutation_flag':setvar('MutationStarted','false'),'Reset_error':setvar('Error',q('')),'Request_time':setvar('Now','utcNow()'),'Reset_output':setvar('Output','null'),
             'Read_request_creator':http(f"concat({q(endpoint('Newsletter_Requests','/items('))},string({req}?['Id']),')?$select=Id,Title,Action,InputText,PartCount,AuthorId,Author/EMail&$expand=Author')",site=MAIN),
             'Trusted_request':setvar('Request',body('Read_request_creator') + "?['d']"),
             'Find_request_ledger':find_record('Newsletter_RequestLedger',req + "?['Title']")}
    fresh={'Reserve_request_once':http(endpoint('Newsletter_RequestLedger','/items'),'POST',payload_fields('Newsletter_RequestLedger',req + "?['Title']",obj({'requestItemId':req + "?['Id']",'authorId':req + "?['AuthorId']",'state':q('Processing'),'at':v('Now')}))),
           'Mark_request_processing':write_queue('Processing'),
           'Read_request_parts':http(f"concat({q(endpoint('Newsletter_RequestParts','/items?$filter=RequestKey eq '))},decodeUriComponent('%27'),replace({req}?['Title'],decodeUriComponent('%27'),decodeUriComponent('%27%27')),decodeUriComponent('%27'),' and AuthorId eq ',string({req}?['AuthorId']),'&$orderby=PartIndex asc&$top=120')",site=MAIN),
           'Complete_request_parts':guard(f"and(empty(body('Read_request_parts')?['d']?['__next']),equals(length(body('Read_request_parts')?['d']?['results']),int({req}?['PartCount'])),lessOrEquals(int({req}?['PartCount']),120))",'Request parts are missing, incomplete or belong to another requester.'),
           'Reset_request_text':setvar('InputText',f"if(equals(int({req}?['PartCount']),0),coalesce({req}?['InputText'],''),'')"),'Reset_part_index':setvar('PartIndex','0'),
           'Join_request_parts':loop(body('Read_request_parts') + "?['d']?['results']",{'Ordered_part':guard("equals(int(items('Join_request_parts')?['PartIndex']),variables('PartIndex'))",'Request parts are not in a complete sequence.'),'Append_part':action('AppendToStringVariable',{'name':'InputText','value':"@items('Join_request_parts')?['PartText']"}),'Next_part_index':action('IncrementVariable',{'name':'PartIndex','value':1})}),
           'Decode_request':setvar('Input',f"json({v('InputText')})"),'Action_matches':guard(f"equals({v('Input')}?['action'],{req}?['Action'])",'The request action changed.'),
           'Request_creator_profile':action('OpenApiConnection',{'host':{'apiId':'/providers/Microsoft.PowerApps/apis/shared_office365users','connectionName':'shared_office365users','operationId':'UserProfile_V2'},'parameters':{'id':ex(req + "?['Author']?['EMail']")},'authentication':"@parameters('$authentication')"}),
           'Find_actor':query(body('Current_roster'),f"equals(item()?['oid'],toLower(body('Request_creator_profile')?['id']))"),
           'Actor':setvar('Actor',f"""if(empty(body('Find_actor')),{obj({'oid':norm(body('Request_creator_profile') + '?["id"]'),'name':body('Request_creator_profile') + '?["displayName"]','active':'false','division':q(''),'email':req + '?["Author"]?["EMail"]'})},first(body('Find_actor')))""".replace('["',"['").replace('"]',"']")),
           'Admin_or_staff_action':condition(f"contains(createArray('routing_admin_get','routing_admin_save'),{v('Input')}?['action'])",routing_admin(),{'Current_staff_only':guard("equals(length(body('Find_actor')),1)",'Your account is absent from the synchronized staff roster.'),**request_actions()}),
           'Large_result_file':condition(f"greater(length(string({v('Output')})),48000)",{**stage_result('Stage_json_result',"concat('result-',guid(),'.json')",f"string({v('Output')})"),'Small_result_reference':setvar('Output',obj({'resultFile':out('Stage_json_result_reference')}))}),
           'Read_ledger_version':find_record('Newsletter_RequestLedger',req + "?['Title']"),
           'Commit_request_outcome':write_item('Newsletter_RequestLedger',"first(body('Read_ledger_version')?['d']?['results'])?['Id']",payload_fields('Newsletter_RequestLedger',req + "?['Title']",obj({'requestItemId':req + "?['Id']",'authorId':req + "?['AuthorId']",'state':q('Succeeded'),'response':v('Output'),'at':v('Now')})),"first(body('Read_ledger_version')?['d']?['results'])?['__metadata']?['etag']"),
           'Respond_to_request':write_queue('Succeeded',response=f"string({v('Output')})")}
    replay={'Same_request_identity':guard(f"and(equals(json({ledger}?['Payload'])?['requestItemId'],{req}?['Id']),equals(json({ledger}?['Payload'])?['authorId'],{req}?['AuthorId']))",'This request identifier has already been used.'),
            'Completed_request':guard(f"equals(json({ledger}?['Payload'])?['state'],'Succeeded')",'This request was already attempted. Its outcome needs operator review; it will not be replayed.'),
            'Return_existing_outcome':write_queue('Succeeded',response=f"string(json({ledger}?['Payload'])?['response'])")}
    actions['Read_runtime_configuration'] = find_record('Newsletter_Configuration',q('settings'))
    actions['Refresh_runtime_configuration'] = setvar('Config',"json(first(body('Read_runtime_configuration')?['d']?['results'])?['Payload'])")
    actions['Request_processing_is_enabled'] = guard(v('Config') + "?['enabled']",'Newsletter processing has been disabled by the administrator.')
    actions['Read_routing'] = find_record('Newsletter_Routing',q('settings'))
    actions['Refresh_request_routing_value'] = compose(f"if(empty(body('Read_routing')?['d']?['results']),{v('Routing')},setProperty(json(first(body('Read_routing')?['d']?['results'])?['Payload']),'staff',{v('Routing')}?['staff']))")
    actions['Refresh_request_routing'] = setvar('Routing',out('Refresh_request_routing_value'))
    actions['Execute_once'] = condition("empty(body('Find_request_ledger')?['d']?['results'])",fresh,replay)
    return actions


def write_queue(status, response=None, error=None):
    fields_value={'Status':q(status) if not status.startswith('@') else status[1:]}
    if response is not None:fields_value['ResponseText']=response
    if error is not None:fields_value['ErrorMessage']=f"substring({error},0,min(length({error}),2000))"
    result=http(f"concat({q(endpoint('Newsletter_Requests','/items('))},string({v('Request')}?['Id']),')')",'POST',fields('Newsletter_Requests',fields_value),site=MAIN,headers={'X-HTTP-Method':'MERGE','IF-MATCH':'*'})
    if error is not None:result['_allowError']=True
    return result


def scheduled_publish():
    transition=transition_actions()
    publish=transition.pop('Workflow_transition')['cases']['publish']['actions']
    return {**publish,**transition}


def worker_actions():
    # All scheduled mutations use the same serialized processor as interactive commands.
    read={'Scheduled_records':http(endpoint('Newsletter_Submissions','/items?$top=5000')),'Complete_worker_inventory':guard("empty(body('Scheduled_records')?['d']?['__next'])",'Worker inventory is truncated.'),'Worker_records':array_projection(body('Scheduled_records') + "?['d']?['results']",item_payload())}
    n=v('Record')
    due=f"and(equals({v('Config')}?['schedulingEnabled'],true),equals({n}?['status'],'scheduled'),lessOrEquals(ticks(coalesce({n}?['scheduledAt'],'9999-12-31T00:00:00Z')),ticks(utcNow())))"
    scheduled={'Scheduled_publisher':query(body('Current_roster'),f"equals(item()?['oid'],{n}?['scheduledBy'])"),'Publisher_still_current':guard("equals(length(body('Scheduled_publisher')),1)",'The scheduled publisher is no longer eligible.'),'Worker_actor':setvar('Actor',"first(body('Scheduled_publisher'))"),'Worker_command':setvar('Input',obj({'id':n + "?['id']",'action':q('publish'),'comment':q('Scheduled publication')})),**read_record(),**scheduled_publish()}
    tasks={'Worker_record':setvar('Record',"items('Process_scheduled')"),'Worker_time':setvar('Now','utcNow()'),'Reset_worker_error':setvar('Error',q('')),
           'Worker_record_command':setvar('Input',obj({'id':n + "?['id']",'action':q('worker')})),
           'Scheduled_publication':condition(due,scheduled), **reminder_actions(), **email_actions()}
    attempt={'type':'Scope','actions':chain(tasks),'runAfter':{}}
    failure={'type':'Scope','actions':{'Keep_background_failure':compose("'Background item failed; inspect the restricted run history. No automatic decision replay.'")},'runAfter':{'Worker_try':['Failed','TimedOut']}}
    read['Process_scheduled']=loop(body('Worker_records'),{'Worker_try':attempt,'Worker_failure':failure})
    return read


def reminder_actions():
    n=v('Record'); recipient=f"if(empty({v('Routing')}?['escalationOid']),{n}?['assignedOid'],{v('Routing')}?['escalationOid'])"
    key=f"concat({n}?['id'],'-due-',formatDateTime(utcNow(),'yyyy-MM-dd'),'-',{recipient})"
    due=f"and(contains(createArray('division_review','editorial_review','clearance','publication_review'),{n}?['status']),lessOrEquals(ticks(coalesce({n}?['dueAt'],'9999-12-31T00:00:00Z')),ticks(utcNow())))"
    note=obj({'id':f"concat('newsletter:',{key})",'title':q('Newsletter review overdue'),'message':f"concat({n}?['content']?['title'],': review deadline passed.')",'recipientOid':recipient,'recipientEmail':q(''),'type':q('warning'),'category':q('newsletter'),'actionUrl':f"concat('/news/newsletters/workspace/',{n}?['id'])",'isRead':'false','createdAt':v('Now'),'createdBy':q('Power Automate')})
    return {'Overdue_review':condition(due,{'Find_daily_reminder':find_record('Newsletter_Notifications',key),'Notify_overdue_once':condition("empty(body('Find_daily_reminder')?['d']?['results'])",{'Store_daily_reminder':http(endpoint('Newsletter_Notifications','/items'),'POST',payload_fields('Newsletter_Notifications',key,note))})})}


def email_actions():
    n=v('Record')
    enabled=f"and(equals({v('Config')}?['emailEnabled'],true),equals({n}?['status'],'published'),equals({n}?['notification']?['state'],'queued'))"
    claim={**read_record(),'Mail_is_enabled_for_fixed_audience':guard(f"and(not(empty({v('Config')}?['staffEmail'])),startsWith({v('Config')}?['intranetUrl'],'https://'),equals({n}?['notification']?['state'],'queued'))",'Verify the fixed staff email audience and the pending send state.'),
           **patch_record('Claim_publication_email',{'notification':lit({'state':'sending'})}),
           'Store_email_claim':write_item('Newsletter_Submissions',v('RecordItemId'),payload_fields('Newsletter_Submissions',n + "?['id']",n),v('RecordETag')),
           'Email_claim_gate':compose("if(empty(variables('Error')),true,div(1,0))"),
           'Send_staff_email_once':action('OpenApiConnection',{'host':{'apiId':'/providers/Microsoft.PowerApps/apis/shared_office365','connectionName':'shared_office365','operationId':'SendEmailV2'},'parameters':{'emailMessage/To':ex(v('Config') + "?['staffEmail']"),'emailMessage/Subject':ex(f"concat('SCPNG Newsletter: ',{n}?['content']?['title'])"),'emailMessage/Body':ex(f"concat('<p>A newsletter is available on the intranet.</p><p><a href=\"', {v('Config')}?['intranetUrl'], '/news/newsletters/', {n}?['id'], '\">Read newsletter</a></p>')"),'emailMessage/Importance':'Normal'},'authentication':"@parameters('$authentication')",'retryPolicy':{'type':'none'}}),
           **prefixed(read_record(),'After_email_'), **patch_record('Accept_publication_email',{'notification':lit({'state':'accepted'})}),
           'Store_accepted_send':write_item('Newsletter_Submissions',v('RecordItemId'),payload_fields('Newsletter_Submissions',n + "?['id']",n),v('RecordETag'))}
    return {'Publication_email':condition(enabled,claim)}


def prefixed(fragment,prefix):
    names={name:prefix+name for name in fragment}
    def rewrite(value):
        if isinstance(value,str):
            for old,new in names.items():
                for fn in ['body','outputs','items','result']:
                    value=value.replace(fn+"('"+old+"')",fn+"('"+new+"')")
            return value
        if isinstance(value,list):return [rewrite(v) for v in value]
        if isinstance(value,dict):return {names.get(k,k):rewrite(v) for k,v in value.items()}
        return value
    return rewrite(fragment)


def maintenance(settings):
    actions={'Deployment_settings':action('Compose',settings),'Apply_changes':action('Compose',False),'Initialize_maintenance_error':action('InitializeVariable',{'variables':[{'name':'Error','type':'string','value':''}]}),
             'Validate_maintenance_activation':compose("if(equals(outputs('Apply_changes'),true),true,div(1,0))"),
             'Expired_downloads':http(f"concat({q(endpoint('NewsletterDownloads','/items?$select=Id,Created&$filter=Created lt datetime'))},decodeUriComponent('%27'),formatDateTime(addDays(utcNow(),-1),'yyyy-MM-ddTHH:mm:ssZ'),decodeUriComponent('%27'),'&$top=5000')",site=MAIN),
             'Complete_download_inventory':guard("empty(body('Expired_downloads')?['d']?['__next'])",'Maintenance inventory is truncated. No files will be recycled.'),
             'Recycle_expired_downloads':loop(body('Expired_downloads') + "?['d']?['results']",{'Recycle_download':http(f"concat({q(endpoint('NewsletterDownloads','/items('))},string(items('Recycle_expired_downloads')?['Id']),')/recycle()')",'POST',site=MAIN)}),
             'Expired_request_parts':http(f"concat({q(endpoint('Newsletter_RequestParts','/items?$select=Id,RequestKey&$filter=Created lt datetime'))},decodeUriComponent('%27'),formatDateTime(addDays(utcNow(),-7),'yyyy-MM-ddTHH:mm:ssZ'),decodeUriComponent('%27'),'&$top=5000')",site=MAIN),
             'Complete_parts_inventory':guard("empty(body('Expired_request_parts')?['d']?['__next'])",'Maintenance inventory is truncated. No parts will be recycled.'),
             'Review_old_parts':loop(body('Expired_request_parts') + "?['d']?['results']",{
                 'Find_pending_request':http(f"concat({q(endpoint('Newsletter_Requests','/items?$select=Id,Status&$filter=Title eq '))},decodeUriComponent('%27'),replace(items('Review_old_parts')?['RequestKey'],decodeUriComponent('%27'),decodeUriComponent('%27%27')),decodeUriComponent('%27'),' and (Status eq ',decodeUriComponent('%27'),'Queued',decodeUriComponent('%27'),' or Status eq ',decodeUriComponent('%27'),'Processing',decodeUriComponent('%27'),' or Status eq ',decodeUriComponent('%27'),'Uncertain',decodeUriComponent('%27'),')&$top=2')",site=MAIN),
                 'Only_recycle_completed_or_orphan_parts':condition("empty(body('Find_pending_request')?['d']?['results'])",{'Recycle_part':http(f"concat({q(endpoint('Newsletter_RequestParts','/items('))},string(items('Review_old_parts')?['Id']),')/recycle()')",'POST',site=MAIN)})})}
    definition={'$schema':'https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#','contentVersion':'1.0.0.0','parameters':{'$authentication':{'type':'SecureObject'},'$connections':{'type':'Object','defaultValue':{}}},'triggers':{'Recurrence':{'type':'Recurrence','recurrence':{'frequency':'Day','interval':1},'runtimeConfiguration':{'concurrency':{'runs':1}}}},'actions':chain(actions)}
    return uniquify_actions(definition)


def processor(settings):
    initial={'Config':{},'Routing':{},'Request':{},'Input':{},'Actor':{},'Record':{},'Output':None,'Error':'','Now':'','InputText':'','PartIndex':0,'RecordItemId':0,'RecordETag':'','NextStage':'','Deadline':'','WorkingDays':0,'MutationStarted':False}
    variables=[{'name':name,'type':'boolean' if isinstance(value,bool) else 'integer' if isinstance(value,int) else 'string' if isinstance(value,str) else 'object','value':value if value is not None else {}} for name,value in initial.items()]
    # Output can be arrays, objects, null: an object variable cannot hold arrays. Keep JSON as an untyped Compose-backed string instead (see normalize_variables).
    actions={'Deployment_settings':action('Compose',settings),'Apply_changes':action('Compose',False),'Initialize_state':action('InitializeVariable',{'variables':variables}),
             'Validate_deployment':compose("if(and(equals(outputs('Apply_changes'),true),startsWith(outputs('Deployment_settings')?['privateSite'],'https://')),true,div(1,0))")}
    scope={**preflight(),'Read_queued_requests':http(endpoint('Newsletter_Requests',"/items?$filter=Status eq 'Queued'&$orderby=Id asc&$top=50"),site=MAIN)}
    attempt={'type':'Scope','actions':chain(process_request()),'runAfter':{}}
    catch={'type':'Scope','actions':chain({'Record_failed_request':write_queue("@if(variables('MutationStarted'),'Uncertain','Failed')",error="if(empty(variables('Error')),'Power Automate could not confirm this request. Contact IT before retrying.',variables('Error'))")}),'runAfter':{'Request_try':['Failed','TimedOut']}}
    scope['Drain_requests']=loop(body('Read_queued_requests') + "?['d']?['results']",{'Request_try':attempt,'Request_failure':catch})
    scope.update(worker_actions())
    actions.update(scope)
    definition={'$schema':'https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#','contentVersion':'1.0.0.0','parameters':{'$authentication':{'type':'SecureObject'},'$connections':{'type':'Object','defaultValue':{}}},'triggers':{'Recurrence':{'type':'Recurrence','recurrence':{'frequency':'Minute','interval':1},'runtimeConfiguration':{'concurrency':{'runs':1}}}},'actions':chain(actions)}
    return uniquify_actions(normalize_variables(definition))


def normalize_variables(value):
    """Power Automate variables are typed. Store polymorphic Output as JSON text."""
    if isinstance(value,list):return [normalize_variables(v) for v in value]
    if not isinstance(value,dict):
        if isinstance(value,str):return value.replace("variables('Output')","json(variables('OutputJson'))")
        return value
    result={key:normalize_variables(item) for key,item in value.items()}
    if value.get('type')=='InitializeVariable':
        for var in result['inputs']['variables']:
            if var['name']=='Output':var.update(name='OutputJson',type='string',value='null')
    if value.get('type')=='SetVariable' and value['inputs']['name']=='Output':
        result['inputs']={'name':'OutputJson','value':'@string(' + value['inputs']['value'][1:].replace("variables('Output')","json(variables('OutputJson'))") + ')'}
    return result


def uniquify_actions(definition):
    """WDL action names are global; bind reusable branch fragments lexically."""
    counter = 0
    reference = re.compile(r"\b(body|outputs|items|result|actions)\('([^']+)'\)")
    def rewrite(value, bindings):
        if isinstance(value,str):
            return reference.sub(lambda m: m[1]+"('"+bindings.get(m[2],m[2])+"')", value)
        if isinstance(value,list): return [rewrite(v,bindings) for v in value]
        if isinstance(value,dict): return {k:rewrite(v,bindings) for k,v in value.items()}
        return value
    def walk(actions, parent):
        nonlocal counter
        bindings=dict(parent)
        for name in actions:
            counter+=1;bindings[name]='a'+str(counter)+'_'+name[:100]
        result={}
        for name, original in actions.items():
            node={k:rewrite(v,bindings) for k,v in original.items() if k not in ['actions','else','cases','default','runAfter']}
            node['runAfter']={bindings.get(k,k):v for k,v in original.get('runAfter',{}).items()}
            if 'actions' in original:node['actions']=walk(original['actions'],bindings)
            if 'else' in original:node['else']={'actions':walk(original['else']['actions'],bindings)}
            if 'cases' in original:node['cases']={k:{'case':v['case'],'actions':walk(v['actions'],bindings)} for k,v in original['cases'].items()}
            if 'default' in original:node['default']={'actions':walk(original['default']['actions'],bindings)}
            result[bindings[name]]=node
        return result
    result=copy.deepcopy(definition);result['actions']=walk(definition['actions'],{})
    return result


def setup(settings):
    resume_id=settings.get('resumeEmptyRequestListId')
    if resume_id:
        resume_id=str(uuid.UUID(resume_id))
    fields_by_list={
        'Newsletter_Requests':{'Action':'Text','InputText':'Note','PartCount':'Number','Status':'Text','ResponseText':'Note','ErrorMessage':'Note'},
        'Newsletter_RequestParts':{'RequestKey':'Text','PartIndex':'Number','PartText':'Note'},
        **{name:{'Payload':'Note'} for name in PRIVATE_LISTS},
    }
    actions={'Deployment_settings':action('Compose',settings),'Apply_changes':action('Compose',False),'Initialize_setup_error':action('InitializeVariable',{'variables':[{'name':'Error','type':'string','value':''}]}),'Only_when_enabled':condition("and(equals(outputs('Apply_changes'),true),startsWith(outputs('Deployment_settings')?['privateSite'],'https://'))",{})}
    work={}
    for name,fields_map in list(fields_by_list.items())+[('NewsletterFiles',{}),('NewsletterDownloads',{})]:
        site=MAIN if name in MAIN_LISTS+['NewsletterDownloads'] else PRIVATE
        template=101 if name in ['NewsletterFiles','NewsletterDownloads'] else 100
        uri=endpoint(name)
        create={'Create_'+name:http('_api/web/lists','POST',lit({'__metadata':{'type':'SP.List'},'Title':name,'BaseTemplate':template,'AllowContentTypes':True}),site=site),
                'Restrict_'+name:http(uri+'/breakroleinheritance(copyRoleAssignments=false,clearSubscopes=true)','POST',site=site)}
        properties={'__metadata':{'type':'SP.List'},'EnableVersioning':True}
        if template==100:properties.update(EnableAttachments=False)
        if name in MAIN_LISTS:properties.update(ReadSecurity=2,WriteSecurity=2)
        create['Settings_'+name]=http(uri,'POST',lit(properties),site=site,headers={'X-HTTP-Method':'MERGE','IF-MATCH':'*'})
        if template==100:
            title_uri=uri+"/fields/getbyinternalnameortitle('Title')"
            # SharePoint must commit the index before uniqueness is enabled.
            create['Index_title_'+name]=http(title_uri,'POST',lit({'__metadata':{'type':'SP.FieldText'},'Indexed':True}),site=site,headers={'X-HTTP-Method':'MERGE','IF-MATCH':'*'})
            # Creator-only lists cannot enforce unique fields in SharePoint.
            # Their public command keys are indexed; the private ledger reserves
            # each command exactly once with a unique key and verified author.
            if name not in MAIN_LISTS:
                create['Unique_title_'+name]=http(title_uri,'POST',lit({'__metadata':{'type':'SP.FieldText'},'EnforceUniqueValues':True}),site=site,headers={'X-HTTP-Method':'MERGE','IF-MATCH':'*'})
        for field,typ in fields_map.items():
            xml=f'<Field Type="{typ}" Name="{field}" StaticName="{field}" DisplayName="{field}"' + (' RichText="FALSE" AppendOnly="FALSE" NumLines="6"' if typ=='Note' else '') + (' Indexed="TRUE"' if field in ['Status','RequestKey'] else '') + '/>'
            create['Field_'+name+'_'+field]=http(uri+'/fields/createfieldasxml','POST',lit({'parameters':{'__metadata':{'type':'SP.XmlSchemaFieldCreationInformation'},'SchemaXml':xml,'Options':0}}),site=site)
        work['Find_'+name]=http("_api/web/lists?$select=Id,Title,ItemCount,HasUniqueRoleAssignments,ReadSecurity,WriteSecurity,EnableVersioning,EnableAttachments&$filter=Title eq '"+name+"'",site=site)
        existing={'Existing_'+name:guard('false','A newsletter store already exists. Review its schema and permissions; setup will not alter or grant access to an existing store.')}
        if name=='Newsletter_Requests' and resume_id:
            row=f"first(body('Find_{name}')?['d']?['results'])"
            reviewed=f"and(equals(length(body('Find_{name}')?['d']?['results']),1),equals(toLower({row}?['Id']),{q(resume_id)}),equals({row}?['ItemCount'],0),equals({row}?['HasUniqueRoleAssignments'],true),equals({row}?['ReadSecurity'],2),equals({row}?['WriteSecurity'],2),equals({row}?['EnableVersioning'],true),equals({row}?['EnableAttachments'],false))"
            missing=' or '.join("InternalName eq '"+field+"'" for field in fields_map)
            existing={
                'Verify_reviewed_empty_request_list':guard(reviewed,'Recovery requires the reviewed, empty, restricted request list with the exact recorded ID and privacy settings.'),
                'Inspect_partial_request_fields':http(uri+'/fields?$select=InternalName&$filter='+missing,site=site),
                'Verify_request_fields_not_created':guard("empty(body('Inspect_partial_request_fields')?['d']?['results'])",'Request fields already exist. Inspect partial setup before attempting further recovery.'),
                **{k:copy.deepcopy(value) for k,value in create.items() if not k.startswith(('Create_','Restrict_'))},
            }
        work['Create_new_'+name]=condition(f"empty(body('Find_{name}')?['d']?['results'])",create,existing)
    work['Verified_new_setup']=compose("if(empty(variables('Error')),true,div(1,0))")
    actions['Only_when_enabled']['actions']=chain(work)
    definition={'$schema':'https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#','contentVersion':'1.0.0.0','parameters':{'$authentication':{'type':'SecureObject'},'$connections':{'type':'Object','defaultValue':{}}},'triggers':{'manual':{'type':'Request','kind':'Button','inputs':{'schema':{'type':'object','properties':{},'required':[]}}}},'actions':chain(actions)}
    return uniquify_actions(definition)


def package(owner_export, destination, definition, display, allow_update=False):
    if owner_export.is_dir():
        path=next(owner_export.rglob('definition.json')).relative_to(owner_export).as_posix()
        read=lambda name:(owner_export/name).read_bytes()
        original=json.loads(read(path));api_map=json.loads(read(path.replace('definition.json','apisMap.json')));conn_map=json.loads(read(path.replace('definition.json','connectionsMap.json')));manifest=json.loads(read('manifest.json'))
    else:
        with zipfile.ZipFile(owner_export) as archive:
            path=next(n for n in archive.namelist() if n.endswith('/definition.json'))
            original=json.loads(archive.read(path));api_map=json.loads(archive.read(path.replace('definition.json','apisMap.json')));conn_map=json.loads(archive.read(path.replace('definition.json','connectionsMap.json')));manifest=json.loads(archive.read('manifest.json'))
    required=['shared_sharepointonline']+(['shared_office365users','shared_office365'] if display.endswith('Processor') else [])
    if 'shared_sharepointonline' not in api_map:raise ValueError('Use an authorized owner export containing the SharePoint connection.')
    # Standard connectors absent from the source are import-time selections, never guessed credentials.
    for key in required:
        if key in api_map and key in conn_map:continue
        api,connection=str(uuid.uuid4()),str(uuid.uuid4());api_map[key],conn_map[key]=api,connection
        manifest['resources'][api]={'id':'/providers/Microsoft.PowerApps/apis/'+key,'name':key,'type':'Microsoft.PowerApps/apis','suggestedCreationType':'Existing','details':{'displayName':key},'configurableBy':'System','hierarchy':'Child','dependsOn':[]}
        manifest['resources'][connection]={'type':'Microsoft.PowerApps/apis/connections','suggestedCreationType':'Existing','creationType':'Existing','details':{'displayName':key+' - select an authorized standard connection'},'configurableBy':'User','hierarchy':'Child','dependsOn':[api]}
        original['properties']['connectionReferences'][key]={'connectionName':key+'-select-during-import','source':'Embedded','id':'/providers/Microsoft.PowerApps/apis/'+key,'tier':'NotSpecified','apiName':key.removeprefix('shared_'),'isProcessSimpleApiReferenceConversionAlreadyDone':False}
    identity=str(uuid.uuid4());props=copy.deepcopy(original['properties']);props.update(definition=definition,displayName=display,connectionReferences={k:v for k,v in props['connectionReferences'].items() if k in required},flowFailureAlertSubscribed=True)
    keep={api_map[k] for k in required}|{conn_map[k] for k in required}
    resources={k:v for k,v in manifest['resources'].items() if k in keep};resources[identity]={'type':'Microsoft.Flow/flows','suggestedCreationType':'New','creationType':'New','details':{'displayName':display},'configurableBy':'User','hierarchy':'Root','dependsOn':list(keep)}
    if allow_update:
        resources[identity].update(suggestedCreationType='Update',creationType='Existing, New, Update')
    manifest['resources']=resources;manifest['details']={**manifest.get('details',{}),'displayName':display,'description':'NEW newsletter flow. Changes disabled. SharePoint + Power Automate only. Review configuration and permissions before enabling.','packageTelemetryId':str(uuid.uuid4()),'creator':'N/A','sourceEnvironment':''}
    prefix='Microsoft.Flow/flows/'+identity+'/'
    files={'manifest.json':manifest,'Microsoft.Flow/flows/manifest.json':{'packageSchemaVersion':'1.0','flowAssets':{'assetPaths':[identity]}},prefix+'definition.json':{'name':identity,'id':'/providers/Microsoft.Flow/flows/'+identity,'type':'Microsoft.Flow/flows','properties':props},prefix+'apisMap.json':{k:api_map[k] for k in required},prefix+'connectionsMap.json':{k:conn_map[k] for k in required}}
    with zipfile.ZipFile(destination,'w',zipfile.ZIP_DEFLATED) as archive:
        for path,data in files.items():archive.writestr(path,json.dumps(data))


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--settings',type=Path,default=ROOT/'deployment.example.json');parser.add_argument('--definitions',type=Path,required=True);parser.add_argument('--owner-export',type=Path);parser.add_argument('--allow-processor-update',action='store_true',help='Allow selecting the reviewed existing Processor during import; all changes still default to disabled.');args=parser.parse_args()
    settings=json.loads(args.settings.read_text(encoding='utf-8'));args.definitions.mkdir(parents=True,exist_ok=True)
    for suffix,definition in [('Setup',setup(settings)),('Processor',processor(settings)),('Maintenance',maintenance(settings))]:
        (args.definitions/(suffix.lower()+'.json')).write_text(json.dumps(definition,indent=2),encoding='utf-8')
        if args.owner_export:package(args.owner_export,args.definitions/(suffix.lower()+'.zip'),definition,'SCPNG Newsletters - '+suffix,allow_update=args.allow_processor_update and suffix=='Processor')
    print('Created native Power Automate definitions; all changes remain disabled until reviewed and enabled in the tenant.')
