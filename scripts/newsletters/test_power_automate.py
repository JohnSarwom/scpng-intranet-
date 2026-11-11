"""Offline native-definition checks, including evaluation of emitted WDL policy."""
import copy
import importlib.util
import json
import re
import unittest
from datetime import datetime, timezone
from pathlib import Path

spec=importlib.util.spec_from_file_location('native_newsletters',Path(__file__).with_name('power_automate.py'))
native=importlib.util.module_from_spec(spec);spec.loader.exec_module(native)


class WDL:
    def __init__(self,text):self.text=text.lstrip('@');self.i=0
    def ws(self):
        while self.i<len(self.text) and self.text[self.i].isspace():self.i+=1
    def parse(self):
        self.ws();start=self.i
        if self.text[self.i]=="'":
            self.i+=1;result=''
            while True:
                if self.text[self.i]=="'":
                    self.i+=1
                    if self.i<len(self.text) and self.text[self.i]=="'":result+="'";self.i+=1;continue
                    break
                result+=self.text[self.i];self.i+=1
            node=('literal',result)
        else:
            match=re.match(r'[A-Za-z_][A-Za-z_0-9]*|-?\d+',self.text[self.i:])
            if not match:raise ValueError('Unexpected expression at '+self.text[self.i:self.i+60])
            name=match[0];self.i+=len(name);self.ws()
            if self.i<len(self.text) and self.text[self.i]=='(':
                self.i+=1;args=[];self.ws()
                if self.text[self.i]!=')':
                    while True:
                        args.append(self.parse());self.ws()
                        if self.text[self.i]!=',':break
                        self.i+=1
                assert self.text[self.i]==')',self.text[start:];self.i+=1;node=('call',name,args)
            else:node=('literal',{'true':True,'false':False,'null':None}.get(name,int(name) if re.fullmatch('-?\d+',name) else name))
        self.ws()
        while self.i<len(self.text) and self.text[self.i] in '?[':
            if self.text[self.i]=='?':self.i+=1
            assert self.text[self.i]=='[';self.i+=1;key=self.parse();self.ws();assert self.text[self.i]==']';self.i+=1
            node=('property',node,key);self.ws()
        return node
    def complete(self):
        node=self.parse();self.ws();assert self.i==len(self.text),self.text[self.i:];return node


def evaluate(text,variables=None,outputs=None,item=None,now='2026-10-20T00:00:00Z'):
    def run(node):
        kind=node[0]
        if kind=='literal':return node[1]
        if kind=='property':
            value,key=run(node[1]),run(node[2]);return value.get(key) if isinstance(value,dict) else value[int(key)] if isinstance(value,list) else None
        name,args=node[1:]
        if name=='if':return run(args[1] if run(args[0]) else args[2])
        a=[run(arg) for arg in args]
        functions={
            'variables':lambda k:(variables or {})[k], 'body':lambda k:(outputs or {})[k], 'outputs':lambda k:(outputs or {})[k], 'item':lambda:item,
            'json':json.loads,'string':lambda x:json.dumps(x,separators=(',',':')) if not isinstance(x,str) else x,'concat':lambda *xs:''.join(xs),
            'trim':lambda x:x.strip(),'toLower':lambda x:x.lower(),'replace':lambda s,a,b:s.replace(a,b),'coalesce':lambda *xs:next((x for x in xs if x is not None),None),
            'empty':lambda x:x in [None,'',[],{}], 'length':len, 'first':lambda xs:xs[0], 'contains':lambda xs,x:x in xs, 'createArray':lambda *xs:list(xs), 'equals':lambda a,b:a==b,
            'and':lambda *xs:all(xs),'or':lambda *xs:any(xs),'not':lambda x:not x,'less':lambda a,b:a<b,'greater':lambda a,b:a>b,'lessOrEquals':lambda a,b:a<=b,'greaterOrEquals':lambda a,b:a>=b,
            'ticks':lambda s:(datetime.fromisoformat(s.replace('Z','+00:00'))-datetime(1970,1,1,tzinfo=timezone.utc)).total_seconds(), 'utcNow':lambda:now,
            'startsWith':lambda s,p:s.startswith(p),'endsWith':lambda s,p:s.endswith(p),'div':lambda a,b:a//b,'split':lambda s,sep:s.split(sep),
        }
        return functions[name](*a)
    return run(WDL(text).complete())


def actions(definition):
    def walk(items,depth):
        for name,value in items.items():
            yield name,value,depth,items
            yield from walk(value.get('actions',{}),depth+1)
            for key in ['else','default']:yield from walk(value.get(key,{}).get('actions',{}),depth+1)
            for case in value.get('cases',{}).values():yield from walk(case['actions'],depth+1)
    return list(walk(definition['actions'],1))


class NativeDefinitions(unittest.TestCase):
    def test_independent_preflight_reads_join_before_any_validation(self):
        flow = native.processor({'mainSite':'https://example.sharepoint.com/sites/intranet','privateSite':'https://example.sharepoint.com/sites/intranet'})
        steps = flow['actions']
        activation = next(name for name in steps if name.endswith('_Validate_deployment'))
        reads = {name: step for name, step in steps.items() if step['runAfter'] == {activation:['Succeeded']}}
        self.assertEqual(len(reads),17)
        for name, step in reads.items():
            self.assertEqual(step['type'],'OpenApiConnection',name)
            self.assertEqual(step['inputs']['parameters']['parameters/method'],'GET',name)
            self.assertNotIn("variables('",json.dumps(step['inputs']),name)
        barrier = next(step for name, step in steps.items() if name.endswith('_Restricted_Newsletter_Configuration'))
        self.assertEqual(barrier['runAfter'],{name:['Succeeded'] for name in reads})
    def test_request_reads_join_after_trusted_identity_before_configuration(self):
        steps = native.process_request()
        reads = ['Find_request_ledger','Read_runtime_configuration','Read_routing']
        for name in reads:
            self.assertEqual(steps[name]['runAfter'],{'Trusted_request':['Succeeded']})
        self.assertEqual(steps['Refresh_runtime_configuration']['runAfter'],{name:['Succeeded'] for name in reads})
        self.assertLess(list(steps).index('Request_processing_is_enabled'),list(steps).index('Execute_once'))
    def test_parallel_groups_reject_writes(self):
        with self.assertRaises(ValueError):
            native.parallel_reads({'Write':native.http('_api/web','POST'),'Validate':native.compose('true')},['Write'],'Ready')
    def test_confirmed_unit_parent_mappings_and_unresolved_organization(self):
        for raw, expected in [('Finance Unit','Corporate Services Division'),('Supervision Unit','Licensing, Market & Supervision Division'),('Legal Advisory Division','Legal Services Division')]:
            self.assertEqual(evaluate(native.canonical(native.q(raw))),expected)
            self.assertTrue(evaluate(native.known_division(native.q(raw))))
        unresolved='Securities Commission of Papua New Guinea'
        self.assertEqual(evaluate(native.canonical(native.q(unresolved))),unresolved)
        self.assertFalse(evaluate(native.known_division(native.q(unresolved))))
        policy=native.appointment_validation()
        check=policy['Known_appointment_scope']['inputs']['value'].replace("items('Validate_appointments')",'item()')
        outputs={'Appointment_scope_exists':[{'division':unresolved}]}
        self.assertIn('confirmed',evaluate(check,outputs=outputs,item={'division':unresolved}))
        self.assertEqual(evaluate(check,outputs=outputs,item={'division':'Finance Unit'}),'')
    def test_empty_variable_resets_survive_cloud_designer_validation(self):
        reset = native.setvar('Error', "''")
        self.assertEqual(reset['inputs']['value'], "@concat('','')")
        self.assertEqual(evaluate(reset['inputs']['value']), '')

    @classmethod
    def setUpClass(cls):
        settings={'mainSite':'https://scpng1.sharepoint.com/sites/scpngintranet','privateSite':''}
        cls.flows=[native.setup(settings),native.processor(settings),native.maintenance(settings)]
    def test_native_action_and_nesting_limits(self):
        for flow in self.flows:
            rows=actions(flow);self.assertLessEqual(len(rows),500);self.assertLessEqual(max(r[2] for r in rows),8)
    def test_names_references_and_dependencies_resolve(self):
        for flow in self.flows:
            rows=actions(flow);names=[r[0] for r in rows];self.assertEqual(len(names),len(set(names)))
            for name,value,depth,siblings in rows:
                self.assertTrue(set(value.get('runAfter',{}))<=set(siblings),name)
                text=json.dumps({k:v for k,v in value.items() if k not in ['actions','else','default','cases']})
                for function,target in re.findall(r"\b(body|outputs|items|result|actions)\('([^']+)'\)",text):self.assertIn(target,names,(name,target))
    def test_every_native_expression_parses(self):
        def strings(value):
            if isinstance(value,str):yield value
            elif isinstance(value,list):
                for x in value:yield from strings(x)
            elif isinstance(value,dict):
                for x in value.values():yield from strings(x)
        for flow in self.flows:
            for value in strings(flow):
                if value.startswith('@'):
                    self.assertLessEqual(len(value),8192)
                    WDL(value).complete()
    def test_disabled_until_reviewed(self):
        for flow in self.flows:
            matches=[a for n,a,_,_ in actions(flow) if n.endswith('_Apply_changes')]
            self.assertEqual(matches[0]['inputs'],False)
    def test_live_directory_internal_names_and_standard_names(self):
        policy=native.preflight()
        person='11111111-1111-1111-1111-111111111111'
        for mapping in [{},{'Division':'field_3','Email':'field_5'}]:
            row={'EntraUserId':person,'Title':'Pilot Officer',mapping.get('Division','Division'):'Corporate Services Division',mapping.get('Email','Email'):'officer@scpng.gov.pg'}
            outputs={'Deployment_settings':{'directoryFields':mapping},'Profile_ids':[person]}
            predicate=policy['Eligible_directory']['inputs']['where']
            self.assertTrue(evaluate(predicate,outputs=outputs,item=row))
            projection=policy['Current_roster']['inputs']['select']
            self.assertEqual(evaluate(projection['email'],outputs=outputs,item=row),'officer@scpng.gov.pg')
            self.assertEqual(evaluate(projection['division'],outputs=outputs,item=row),'Corporate Services Division')
            self.assertFalse(evaluate(predicate,outputs={**outputs,'Profile_ids':[]},item=row))
            self.assertFalse(evaluate(predicate,outputs=outputs,item={**row,mapping.get('Email','Email'):'automation@scpng.gov.pg'}))
    def test_secure_history_settings_match_native_action_support(self):
        for flow in self.flows:
            for name, step, _, _ in actions(flow):
                secure=step.get('runtimeConfiguration',{}).get('secureData',{}).get('properties',[])
                if step['type'] in ['Compose','ParseJson','Response']:
                    self.assertEqual(secure,['inputs'],name)
                elif step['type'] in ['OpenApiConnection','Select','Query']:
                    self.assertEqual(secure,['inputs','outputs'],name)
                else:
                    self.assertEqual(secure,[],name)
    def test_no_external_compute_or_secret_trigger(self):
        for flow in self.flows:
            text=json.dumps(flow).lower()
            for forbidden in ['supabase','azurewebsites','client_secret','x-newsletter-worker','sas_token']:
                self.assertNotIn(forbidden,text)
            self.assertTrue(all(a['type'] not in ['Http','Function','JavascriptCode'] for _,a,_,_ in actions(flow)))
    def test_queue_privacy_and_new_store_only_setup(self):
        text=json.dumps(self.flows[0]);self.assertIn('ReadSecurity',text);self.assertIn('WriteSecurity',text)
        self.assertIn('copyRoleAssignments=false',text);self.assertNotIn('copyRoleAssignments=true',text)
        self.assertIn('setup will not alter',text)
    def test_setup_commits_title_index_before_uniqueness(self):
        rows=actions(self.flows[0]);names=[name for name,_,_,_ in rows]
        for store in native.PRIVATE_LISTS:
            index=next(i for i,n in enumerate(names) if n.endswith('_Index_title_'+store) and rows[i][1]['type']=='OpenApiConnection')
            unique=next(i for i,n in enumerate(names) if n.endswith('_Unique_title_'+store) and rows[i][1]['type']=='OpenApiConnection')
            self.assertLess(index,unique)
            self.assertNotIn('EnforceUniqueValues',rows[index][1]['inputs']['parameters']['parameters/body'])
            self.assertNotIn('Indexed',rows[unique][1]['inputs']['parameters']['parameters/body'])
    def test_creator_only_queues_have_indexes_without_incompatible_unique_fields(self):
        rows=actions(self.flows[0])
        for store in native.MAIN_LISTS:
            self.assertTrue(any(n.endswith('_Index_title_'+store) for n,_,_,_ in rows))
            self.assertFalse(any(n.endswith('_Unique_title_'+store) for n,_,_,_ in rows))
    def test_recovery_only_accepts_reviewed_empty_private_request_list(self):
        identity='6b90b8d1-2ae1-4f37-a74d-245629f68440'
        flow=native.setup({'mainSite':'https://example.test','privateSite':'https://example.test','resumeEmptyRequestListId':identity})
        rows=actions(flow)
        check=next(a for n,a,_,_ in rows if n.endswith('_Verify_reviewed_empty_request_list'))
        find=next(n for n,_,_,_ in rows if n.endswith('_Find_Newsletter_Requests'))
        valid={'Id':identity,'ItemCount':0,'HasUniqueRoleAssignments':True,'ReadSecurity':2,'WriteSecurity':2,'EnableVersioning':True,'EnableAttachments':False}
        expression=check['inputs']['value']
        self.assertEqual(evaluate(expression,outputs={find:{'d':{'results':[valid]}}}),'')
        for field,wrong in [('Id','other'),('ItemCount',1),('HasUniqueRoleAssignments',False),('ReadSecurity',1),('WriteSecurity',1),('EnableVersioning',False),('EnableAttachments',True)]:
            self.assertTrue(evaluate(expression,outputs={find:{'d':{'results':[{**valid,field:wrong}]}}}),field)
        guard_name=next(n for n,a,_,_ in rows if a is check)
        branch=next(siblings for n,a,_,siblings in rows if n==guard_name)
        self.assertFalse(any(n.endswith('_Create_Newsletter_Requests') or n.endswith('_Restrict_Newsletter_Requests') for n in branch))
        for _,step,_,_ in rows:
            text=json.dumps(step.get('inputs',{}))
            if text.startswith('"@'):
                WDL(step['inputs']).complete()
    def test_no_variable_self_assignment(self):
        for flow in self.flows:
            for name,a,_,_ in actions(flow):
                if a['type']=='SetVariable':self.assertNotIn("variables('"+a['inputs']['name']+"')",str(a['inputs']['value']),name)
    def test_all_mutations_are_gated_or_are_error_responses(self):
        for flow in self.flows:
            for name,a,_,siblings in actions(flow):
                if a['type']!='OpenApiConnection':continue
                p=a['inputs']['parameters'];method=p.get('parameters/method','GET')
                if method=='GET':continue
                if name.endswith('_Record_failed_request'):continue
                dependencies=list(a['runAfter']);self.assertEqual(len(dependencies),1,name)
                gate=siblings[dependencies[0]];self.assertEqual(gate['type'],'Compose',name)
                self.assertIn("empty(variables('Error'))",str(gate['inputs']),name)
    def test_private_record_writes_have_version_protection(self):
        writes=[a for n,a,_,_ in actions(self.flows[1]) if a['type']=='OpenApiConnection' and a['inputs']['parameters'].get('parameters/headers',{}).get('X-HTTP-Method')=='MERGE']
        for a in writes:
            p=a['inputs']['parameters']
            if p['dataset']==native.PRIVATE:self.assertNotEqual(p['parameters/headers'].get('IF-MATCH'),'*')
    def test_request_creator_is_resolved_by_sharepoint_and_directory(self):
        text=json.dumps(self.flows[1]);self.assertIn('Author/EMail',text);self.assertIn('UserProfile_V2',text)
        actor=[a for n,a,_,_ in actions(self.flows[1]) if n.endswith('_Actor') and a['type']=='SetVariable'][0]
        self.assertIn('Request_creator_profile',actor['inputs']['value']);self.assertNotIn("variables('Input')",actor['inputs']['value'])
    def test_requests_are_reserved_in_private_ledger_before_processing(self):
        rows=actions(self.flows[1]);names=[n for n,_,_,_ in rows]
        self.assertLess(next(i for i,n in enumerate(names) if n.endswith('_Reserve_request_once')),next(i for i,n in enumerate(names) if n.endswith('_Decode_request')))
        self.assertIn('will not be replayed',json.dumps(self.flows[1]))
    def test_scheduled_and_interactive_writes_share_one_serial_processor(self):
        flow=self.flows[1];self.assertEqual(flow['triggers']['Recurrence']['runtimeConfiguration']['concurrency']['runs'],1)
        text=json.dumps(flow);self.assertIn('Drain_requests',text);self.assertIn('Process_scheduled',text)
    def test_email_is_claimed_before_single_attempt(self):
        rows=actions(self.flows[1]);names=[n for n,_,_,_ in rows]
        before=next(i for i,n in enumerate(names) if n.endswith('_Store_email_claim'))
        send=next(i for i,n in enumerate(names) if n.endswith('_Send_staff_email_once'))
        self.assertLess(before,send);self.assertEqual(rows[send][1]['inputs']['retryPolicy']['type'],'none')
        self.assertTrue(any(n.endswith('_After_email_Find_record') for n in names))
    def test_temp_cleanup_preserves_pending_parts_and_workflow_history(self):
        text=json.dumps(self.flows[2]);self.assertIn('Queued',text);self.assertIn('Processing',text);self.assertIn('Uncertain',text);self.assertIn('/recycle()',text)
        self.assertNotIn('Newsletter_Submissions',text);self.assertNotIn('Newsletter_Routing',text);self.assertNotIn('NewsletterFiles',text)
    def access_check(self,role,groups=(),protected=True):
        policy=native.intranet_admin_access()
        outputs={
            'Read_intranet_role':{'d':{'results':role}},
            'Read_intranet_groups':{'d':{'results':list(groups)}},
            'Group_permission_field':{'d':{'InternalName':'Permissions'}},
            'Role_store_permissions':{'d':{'HasUniqueRoleAssignments':protected}},
            'Group_store_permissions':{'d':{'HasUniqueRoleAssignments':protected}},
        }
        predicate=policy['Newsletter_management_groups']['inputs']['where']
        outputs['Newsletter_management_groups']=[g for g in groups if evaluate(predicate,outputs=outputs,item=g)]
        return evaluate(policy['Authorized_routing_admin']['inputs']['value'],outputs=outputs)
    def test_intranet_admin_roles_and_legacy_admin_flag(self):
        for row in [{'Role':'admin'},{'Role':'super_admin'},{'Role':'manager','IsAdmin':'Yes'},{'IsAdmin':True}]:
            self.assertEqual(self.access_check([row]),'')
        self.assertTrue(self.access_check([{'Role':'manager'}]))
        self.assertTrue(self.access_check([{'Role':'publisher'}]))
    def test_newsletter_delegation_uses_current_group_membership(self):
        row={'Role':'manager','Groups':'All Staffs, Newsletter Administrators'}
        for permissions in ['["newsletter_routing:read,manage"]','["newsletter_routing:manage"]','{"newsletter_routing":["manage"]}']:
            group={'Title':'Newsletter Administrators','Permissions':permissions}
            self.assertEqual(self.access_check([row],[group]),'')
            self.assertTrue(self.access_check([{**row,'Groups':'All Staffs'}],[group]))
        self.assertTrue(self.access_check([row],[{'Title':'Newsletter Administrators','Permissions':'["newsletter_routing"]'}]))
    def test_missing_duplicate_or_unprotected_access_records_fail_closed(self):
        self.assertTrue(self.access_check([]))
        self.assertTrue(self.access_check([{'Role':'admin'},{'Role':'staff_member'}]))
        self.assertTrue(self.access_check([{'Role':'admin'}],protected=False))
        self.assertNotIn('routingAdmins',json.dumps(native.intranet_admin_access()))


class NativePolicy(unittest.TestCase):
    def setUp(self):
        self.person='11111111-1111-1111-1111-111111111111'
        self.variables={'Record':{'division':'Research & Publication Division','authorOid':'author','editorOid':'editor'}}
        self.outputs={'Roster_ids':[self.person]}
        self.row={'oid':self.person,'role':'editor'}
    def check(self,**kwargs):
        return evaluate(native.role_match("'editor'",**kwargs),variables=self.variables,outputs=self.outputs,item=self.row)
    def test_current_role(self):self.assertTrue(self.check())
    def test_wrong_scope(self):self.row['division']='Corporate Services Division';self.assertFalse(self.check())
    def test_expired_role(self):self.row['endsAt']='2026-10-19T00:00:00Z';self.assertFalse(self.check())
    def test_future_role(self):self.row['startsAt']='2026-10-21T00:00:00Z';self.assertFalse(self.check())
    def test_departed_staff(self):self.outputs['Roster_ids']=[];self.assertFalse(self.check())
    def test_self_review(self):self.variables['Record']['authorOid']=self.person;self.assertFalse(self.check(exclude_author=True))
    def test_division_alias(self):self.row['division']='Research and Publication';self.assertTrue(self.check())
    def test_boundary_replacement(self):self.row['endsAt']='2026-10-20T00:00:00Z';self.assertFalse(self.check());self.row['endsAt']=None;self.row['startsAt']='2026-10-20T00:00:00Z';self.assertTrue(self.check())
    def test_write_gate_rejects_a_denied_policy(self):
        gate="if(empty(variables('Error')),true,div(1,0))"
        self.assertTrue(evaluate(gate,variables={'Error':''}))
        with self.assertRaises(ZeroDivisionError):evaluate(gate,variables={'Error':'Not authorized'})


if __name__=='__main__':unittest.main()
