"""Build a native cloud-flow package from the owner's exported preview.

The result imports in preview mode. No credentials are introduced or extracted.
"""
import json
import re
import sys
import zipfile
from pathlib import Path

SITE = 'https://scpng1.sharepoint.com/sites/scpngintranet'

def expr(s): return '@' + s
def quote(s): return "'" + s.replace("'", "''") + "'"
def body(n): return "body(" + quote(n) + ")"
def out(n): return "outputs(" + quote(n) + ")"
def item(n): return "items(" + quote(n) + ")"
def after(n): return {n: ['Succeeded']} if n else {}
def action(t, inputs, previous=None, **rest):
    return dict(type=t, inputs=inputs, runAfter=after(previous), **rest)
def compose(v, previous=None): return action('Compose', v, previous)
def query(source, where, previous=None):
    return action('Query', {'from': expr(source), 'where': expr(where)}, previous)
def condition(test, yes, no=None, previous=None):
    return dict(type='If', expression=expr(test), actions=yes,
                **{'else': {'actions': no or {}}}, runAfter=after(previous))
def loop(source, actions, previous=None):
    return dict(type='Foreach', foreach=expr(source), actions=actions,
                runAfter=after(previous), runtimeConfiguration={'concurrency': {'repetitions': 1}})
def http(uri, method='GET', content=None, previous=None, headers=None):
    p = {'dataset': SITE, 'parameters/method': method, 'parameters/uri': uri,
         'parameters/headers': {'Accept': 'application/json;odata=verbose', **(headers or {})}}
    if content is not None:
        p['parameters/body'] = content if isinstance(content, str) else json.dumps(content)
        p['parameters/headers']['Content-Type'] = 'application/json;odata=verbose'
    inputs = {'host': {
        'apiId': '/providers/Microsoft.PowerApps/apis/shared_sharepointonline',
        'connectionName': 'shared_sharepointonline', 'operationId': 'HttpRequest'},
        'parameters': p, 'authentication': "@parameters('$authentication')"}
    if method == 'POST' and not (headers or {}).get('X-HTTP-Method'):
        inputs['retryPolicy'] = {'type': 'none'}
    return action('OpenApiConnection', inputs, previous)
def fail(message):
    name = 'Stop_' + re.sub('[^A-Za-z0-9]', '_', message[:45])
    return {name: action('Terminate', {
        'runStatus': 'Failed', 'runError': {'code': 'StaffSyncGuard', 'message': message}})}
def obj(fields):
    v = "json('{}')"
    for k, value in fields.items():
        v = 'setProperty(' + v + ', ' + quote(k) + ', ' + value + ')'
    return v
def append(value, previous=None):
    return action('AppendToArrayVariable', {'name': 'Plans', 'value': expr(value)}, previous)
def norm(v): return "toLower(trim(coalesce(" + v + ", '')))"

def build(source, destination):
    with zipfile.ZipFile(source) as z:
        files = {n: z.read(n) for n in z.namelist()}
    definition_path = next(n for n in files if n.endswith('/definition.json'))
    package = json.loads(files[definition_path])
    d = package['properties']['definition']
    original = d['actions']
    targets = [
        ('Profiles', original['Get_items']['inputs']['parameters']['table'],
         {'Title': 'mail', 'Department': 'department', 'Designation': 'jobTitle'}),
        ('Directory', original['Get_items_2']['inputs']['parameters']['table'],
         {'Title': 'displayName', 'Surname': 'surname', 'Designation': 'jobTitle',
          'Division': 'officeLocation', 'Email': 'mail'}),
    ]
    a = {'Apply_changes': compose(False),
         'Initialize_plan': action('InitializeVariable', {'variables': [
             {'name': 'Plans', 'type': 'array', 'value': []}]}, 'Apply_changes')}
    a['Search_for_users_(V2)'] = original['Search_for_users_(V2)']
    a['Search_for_users_(V2)']['runAfter'] = after('Initialize_plan')
    a['Apply_to_each'] = original['Apply_to_each']
    a['Apply_to_each']['runtimeConfiguration'] = {'concurrency': {'repetitions': 1}}
    old_compose = a['Apply_to_each']['actions']['Compose']['inputs']
    clean_profile = obj({f: "body('Get_user_profile_(V2)')?[" + quote(f) + "]"
                         for f in ['id', 'displayName', 'mail', 'userPrincipalName',
                                   'department', 'officeLocation', 'surname', 'jobTitle', 'userType']})
    # Keep the live-tested eligibility expression; reduce captured personal data.
    a['Apply_to_each']['actions']['Compose']['inputs'] = old_compose.replace(
        "setProperty(setProperty(body('Get_user_profile_(V2)'),", 'setProperty(setProperty(' + clean_profile + ',', 1)
    a['Profile_results'] = query("result('Apply_to_each')", "equals(item()?['name'], 'Compose')", 'Apply_to_each')
    a['All_profiles'] = action('Select', {'from': expr("first(body('Profile_results'))?['outputs']"),
        'select': expr("item()?['outputs']")}, 'Profile_results')
    a['Eligible_staff'] = query(body('All_profiles'), "equals(item()?['Eligible'], true)", 'All_profiles')
    a['Source_ids'] = action('Select', {'from': expr(body('All_profiles')), 'select': expr("item()?['id']")}, 'Eligible_staff')
    a['Source_mail'] = action('Select', {'from': expr(body('Eligible_staff')), 'select': expr(norm("item()?['mail']"))}, 'Source_ids')
    a['Invalid_profile_ids'] = query(body('All_profiles'), "empty(item()?['id'])", 'Source_mail')
    previous = 'Invalid_profile_ids'
    checks = ["greater(length(body('All_profiles')), 0)",
        "less(length(body('Search_for_users_(V2)')?['value']), 1000)",
        "empty(body('Search_for_users_(V2)')?['@odata.nextLink'])",
        "equals(length(body('All_profiles')), length(body('Search_for_users_(V2)')?['value']))",
        "equals(length(union(body('Source_ids'), body('Source_ids'))), length(body('Source_ids')))",
        "equals(length(union(body('Source_mail'), body('Source_mail'))), length(body('Source_mail')))",
        "greater(length(body('Eligible_staff')), 0)", "empty(body('Invalid_profile_ids'))"]
    for tag, list_id, mappings in targets:
        uri = "_api/web/lists(guid'" + list_id + "')"
        a[tag + '_list'] = http(uri + '?$select=Id,Title,ListItemEntityTypeFullName', previous=previous)
        a[tag + '_fields'] = http(uri + '/fields?$select=Title,InternalName,TypeAsString,ReadOnlyField&$top=5000', previous=tag + '_list')
        previous = tag + '_fields'
        for label in mappings:
            name = tag + '_field_' + label
            field_match = "equals(item()?['InternalName'], 'Title')" if label == 'Title' else "equals(toLower(trim(item()?['Title'])), " + quote(label.lower()) + ')'
            a[name] = query(body(tag + '_fields') + "?['d']?['results']",
                'and(' + field_match + ", equals(item()?['ReadOnlyField'], false))", previous)
            checks.append('equals(length(' + body(name) + '), 1)')
            checks.append("contains(createArray('Text', 'Note', 'Choice'), first(" + body(name) + ")?['TypeAsString'])")
            previous = name
        a[tag + '_identity_field'] = query(body(tag + '_fields') + "?['d']?['results']",
            "equals(item()?['InternalName'], 'EntraUserId')", previous)
        checks.append('lessOrEquals(length(' + body(tag + '_identity_field') + '), 1)')
        checks.append("or(empty(" + body(tag + '_identity_field') + "), equals(first(" + body(tag + '_identity_field') + ")?['TypeAsString'], 'Text'))")
        a[tag + '_rows'] = http(uri + '/items?$top=5000&$orderby=Id asc', previous=tag + '_identity_field')
        checks.extend(['empty(' + body(tag + '_rows') + "?['d']?['__next'])",
                       'less(length(' + body(tag + '_rows') + "?['d']?['results']), 5000)"])
        a[tag + '_invalid_versions'] = query(body(tag + '_rows') + "?['d']?['results']",
            "or(empty(item()?['__metadata']?['etag']), equals(item()?['Id'], null))", tag + '_rows')
        checks.append('empty(' + body(tag + '_invalid_versions') + ')')
        previous = tag + '_invalid_versions'
    safe = {}
    previous_safe = None
    for tag, list_id, mappings in targets:
        rows = body(tag + '_rows') + "?['d']?['results']"
        mail_field = 'Title' if tag == 'Profiles' else 'Email'
        field = lambda label: 'first(' + body(tag + '_field_' + label) + ")?['InternalName']"
        user_loop = 'Plan_' + tag + '_upserts'
        user = item(user_loop)
        stable_match = "equals(item()?['EntraUserId'], " + user + "?['id'])"
        match = "or(" + stable_match + ", and(empty(" + body(tag + '_stable_matches') + "), empty(item()?['EntraUserId']), equals(" + norm('item()?[' + field(mail_field) + ']') + ', ' + norm(user + "?['mail']") + ')))'
        patch = {'__metadata': obj({'type': body(tag + '_list') + "?['d']?['ListItemEntityTypeFullName']"}),
                 'EntraUserId': user + "?['id']"}
        patch_expression = obj(patch)
        change_tests = ["not(equals(coalesce(first(body('" + tag + "_matches'))?['EntraUserId'], ''), " + user + "?['id']))"]
        for label, source_field in mappings.items():
            value = "trim(coalesce(" + user + '?[' + quote(source_field) + "], ''))"
            patch_expression = 'setProperty(' + patch_expression + ', ' + field(label) + ', ' + value + ')'
            change_tests.append('not(equals(coalesce(first(' + body(tag + '_matches') + ')?[' + field(label) + "], ''), " + value + '))')
        upsert_kind = "if(empty(" + body(tag + '_matches') + "), 'Create', if(or(" + ', '.join(change_tests) + "), 'Update', 'Keep'))"
        plan = obj({'List': quote(tag), 'ListId': quote(list_id), 'Kind': upsert_kind,
                    'UserId': user + "?['id']", 'Email': user + "?['mail']",
                    'ItemId': "if(empty(" + body(tag + '_matches') + "), 0, first(" + body(tag + '_matches') + ")?['Id'])",
                    'ETag': "if(empty(" + body(tag + '_matches') + "), '', first(" + body(tag + '_matches') + ")?['__metadata']?['etag'])",
                    'Fields': patch_expression})
        safe[user_loop] = loop(body('Eligible_staff'), {
            tag + '_stable_matches': query(rows, stable_match),
            tag + '_matches': query(rows, match, tag + '_stable_matches'),
            tag + '_append_upsert': append(plan, tag + '_matches')}, previous_safe)
        row_loop = 'Plan_' + tag + '_removals'
        row = item(row_loop)
        eligible_match = "or(and(not(empty(" + row + "?['EntraUserId'])), equals(item()?['id'], " + row + "?['EntraUserId'])), and(empty(" + row + "?['EntraUserId']), equals(" + norm("item()?['mail']") + ', ' + norm(row + '?[' + field(mail_field) + ']') + ')))'
        selected = "first(" + body(tag + '_eligible_match') + ')'
        duplicate_match = "or(and(not(empty(item()?['EntraUserId'])), equals(item()?['EntraUserId'], " + selected + "?['id'])), and(empty(item()?['EntraUserId']), equals(" + norm('item()?[' + field(mail_field) + ']') + ', ' + norm(selected + "?['mail']") + ')))'
        recycle = obj({'List': quote(tag), 'ListId': quote(list_id), 'Kind': quote('Recycle'),
                       'ItemId': row + "?['Id']", 'Email': row + '?[' + field(mail_field) + ']',
                       'ETag': row + "?['__metadata']?['etag']"})
        safe[row_loop] = loop(rows, {
            tag + '_eligible_match': query(body('Eligible_staff'), eligible_match),
            tag + '_row_eligible': condition('not(empty(' + body(tag + '_eligible_match') + '))', {
                tag + '_stable_rows': query(rows, "equals(item()?['EntraUserId'], " + selected + "?['id'])"),
                tag + '_duplicate_rows': query(rows, duplicate_match, tag + '_stable_rows'),
                tag + '_is_duplicate': condition('not(equals(' + row + "?['Id'], if(empty(" + body(tag + '_stable_rows') + '), first(' + body(tag + '_duplicate_rows') + '), first(' + body(tag + '_stable_rows') + "))?['Id']))",
                    {tag + '_append_duplicate': append(recycle)}, previous=tag + '_duplicate_rows')},
                {tag + '_append_ineligible': append(recycle)}, previous=tag + '_eligible_match')}, user_loop)
        previous_safe = row_loop
    safe['Removal_plan'] = query("variables('Plans')", "equals(item()?['Kind'], 'Recycle')", previous_safe)
    safe['Write_plan'] = query("variables('Plans')", "contains(createArray('Create', 'Update'), item()?['Kind'])", 'Removal_plan')
    removal_checks = []
    previous_safe = 'Write_plan'
    for tag, _, _ in targets:
        name = tag + '_removal_count'
        safe[name] = query(body('Removal_plan'), "equals(item()?['List'], " + quote(tag) + ')', previous_safe)
        removal_checks.append('lessOrEquals(mul(length(' + body(name) + '), 100), mul(length(' + body(tag + '_rows') + "?['d']?['results']), 25))")
        previous_safe = name
    safe['Preview_report'] = compose({'ApplyChanges': expr(out('Apply_changes')), 'EligibleStaff': expr('length(' + body('Eligible_staff') + ')'),
        'Changes': expr("variables('Plans')"), 'RemovalCount': expr('length(' + body('Removal_plan') + ')'),
        'WriteCount': expr('length(' + body('Write_plan') + ')'), 'RemovalLimitPercent': 25}, previous_safe)
    apply = {'Recovery_snapshot': compose({tag: expr(body(tag + '_rows') + "?['d']?['results']") for tag, _, _ in targets})}
    last = 'Recovery_snapshot'
    for tag, list_id, _ in targets:
        uri = "_api/web/lists(guid'" + list_id + "')/fields"
        apply[tag + '_ensure_identity'] = condition('empty(' + body(tag + '_identity_field') + ')', {
            tag + '_create_identity': http(uri, 'POST', {'__metadata': {'type': 'SP.Field'},
                'Title': 'EntraUserId', 'StaticName': 'EntraUserId', 'FieldTypeKind': 2,
                'Required': False, 'EnforceUniqueValues': False})}, previous=last)
        last = tag + '_ensure_identity'
    write = item('Apply_upserts')
    write_uri = "concat('_api/web/lists(guid''', " + write + "?['ListId'], ''')/items', if(equals(" + write + "?['Kind'], 'Create'), '', concat('(', string(" + write + "?['ItemId']), ')')))"
    apply['Apply_upserts'] = loop(body('Write_plan'), {
        'Write_is_create': condition("equals(" + write + "?['Kind'], 'Create')", {
            'Create_staff_item': http(expr(write_uri), 'POST', expr('string(' + write + "?['Fields'])"))}, {
            'Update_staff_item': http(expr(write_uri), 'POST', expr('string(' + write + "?['Fields'])"),
                headers={'IF-MATCH': expr(write + "?['ETag']"), 'X-HTTP-Method': 'MERGE'})})}, last)
    r = item('Check_removal_versions')
    r_uri = "concat('_api/web/lists(guid''', " + r + "?['ListId'], ''')/items(', string(" + r + "?['ItemId']), ')')"
    apply['Check_removal_versions'] = loop(body('Removal_plan'), {
        'Read_removal_version': http(expr(r_uri)),
        'Require_unchanged_version': compose(expr("if(equals(body('Read_removal_version')?['d']?['__metadata']?['etag'], " + r + "?['ETag']), true, div(1, 0))"), 'Read_removal_version')}, 'Apply_upserts')
    r = item('Recycle_removed_staff')
    r_uri = "concat('_api/web/lists(guid''', " + r + "?['ListId'], ''')/items(', string(" + r + "?['ItemId']), ')/recycle()')"
    apply['Recycle_removed_staff'] = loop(body('Removal_plan'), {
        'Recycle_staff_item': http(expr(r_uri), 'POST', headers={'IF-MATCH': expr(r + "?['ETag']")})}, 'Check_removal_versions')
    safe['Apply_only_when_enabled'] = condition("equals(toLower(string(" + out('Apply_changes') + ")), 'true')", {
        'Check_removal_limit': condition('and(' + ', '.join(removal_checks) + ')', apply,
            fail('Removal plan exceeds 25 percent for a staff list. Review the preview before changing the limit.'))}, previous='Preview_report')
    a['Require_complete_source_and_schema'] = condition('and(' + ', '.join(checks) + ')', safe,
        fail('Incomplete source, duplicate identity, missing schema or truncated list. No list changes allowed.'), previous=previous)
    d['actions'] = a
    d['triggers']['Recurrence']['runtimeConfiguration'] = {'concurrency': {'runs': 1}}
    package['properties']['displayName'] = 'SCPNG Staff Lists - Five Day Sync'
    package['properties']['flowFailureAlertSubscribed'] = True
    files[definition_path] = json.dumps(package, ensure_ascii=False).encode()
    manifest = json.loads(files['manifest.json'])
    manifest['details']['displayName'] = 'SCPNG Staff Lists Five Day Sync - guarded native flow'
    for resource in manifest['resources'].values():
        if resource['type'] == 'Microsoft.Flow/flows':
            resource['details']['displayName'] = package['properties']['displayName']
    files['manifest.json'] = json.dumps(manifest).encode()
    with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED) as z:
        for name, contents in files.items(): z.writestr(name, contents)
    print(json.dumps({'package': str(destination), 'rootActions': len(a), 'previewMode': True}))

if __name__ == '__main__':
    build(Path(sys.argv[1]), Path(sys.argv[2]))
