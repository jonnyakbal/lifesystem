"""Package approved explanatory metadata with expected file hashes; never reads credentials."""
import argparse
import hashlib
import json
from pathlib import Path

def export_catalog(source, hermes, destination):
    catalog=json.loads(Path(source).read_text(encoding='utf-8'))
    hermes=Path(hermes).resolve()
    for profile in catalog['profiles']:
        for item in profile['sources']:
            reference=item['reference']
            if item['kind']=='connector' and reference=='lifesystem:mcp:'+profile['id']:
                item['revision']=None
                item['verifiedAt']=None
                continue
            if reference=='hermes/runtime/specialists/specialist_router/bridge.py':
                local=hermes/'runtime/specialists/specialist_router/bridge.py'
                remote='plugins/jonny-specialists/specialist_router/bridge.py'
            elif reference.startswith('hermes/profiles/'):
                remote=reference.removeprefix('hermes/');local=hermes/remote
            elif reference.startswith('hermes/skills/'):
                local=hermes/reference.removeprefix('hermes/')
                remote='profiles/'+profile['id']+'/'+reference.removeprefix('hermes/')
            elif reference.startswith('hermes/briefings/'):
                local=hermes/reference.removeprefix('hermes/')
                remote='documentation/personal-specialists/'+reference.removeprefix('hermes/')
            else:
                raise ValueError('Unapproved catalog source')
            if not local.resolve().is_relative_to(hermes) or not local.is_file():
                raise ValueError('Missing approved source: '+reference)
            item['reference']=remote
            item['revision']=hashlib.sha256(local.read_bytes()).hexdigest()
            item['verifiedAt']=None
    catalog['provenance']='local'
    fingerprint=hashlib.sha256(json.dumps(catalog,sort_keys=True,ensure_ascii=False).encode()).hexdigest()[:20]
    catalog['revision']='office-'+fingerprint
    destination=Path(destination);destination.parent.mkdir(parents=True,exist_ok=True)
    destination.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return catalog

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--source',required=True);parser.add_argument('--hermes',required=True);parser.add_argument('--output',required=True)
    args=parser.parse_args()
    result=export_catalog(args.source,args.hermes,args.output)
    print(json.dumps({'revision':result['revision'],'profiles':len(result['profiles']),'output':args.output}))
