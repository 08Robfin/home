"""Run on the Docker host: python3 scripts/backup.py /absolute/private/backup-directory.
Uses SQLite's online backup API, including receipts; never exports the mail credential.
"""
from pathlib import Path
import datetime,os,sqlite3,subprocess,sys,uuid
destination=Path(sys.argv[1]).resolve()
destination.mkdir(mode=0o700,parents=True,exist_ok=True)
os.chmod(destination,0o700)
filename='home-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'-'+uuid.uuid4().hex[:8]+'.sqlite'
temporary='/tmp/'+filename
code="import {DatabaseSync,backup} from 'node:sqlite';const db=new DatabaseSync('/data/home.sqlite');await backup(db,process.argv[1]);db.close();"
try:
    subprocess.run(['docker','exec','home-app-1','node','--input-type=module','-e',code,temporary],check=True)
    target=destination/filename
    # Stream from the running container: Docker's archive endpoint cannot read this tmpfs mount.
    fd=os.open(target,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'wb') as output:
        subprocess.run(['docker','exec','home-app-1','node','-e',"process.stdout.write(require('node:fs').readFileSync(process.argv[1]))",temporary],check=True,stdout=output)
    with sqlite3.connect('file:'+str(target)+'?mode=ro',uri=True) as db:
        if db.execute('PRAGMA integrity_check').fetchone()[0]!='ok':raise RuntimeError('Backup integrity check failed')
    cutoff=datetime.datetime.now().timestamp()-30*86400
    for old in destination.glob('home-*.sqlite'):
        if old.is_file() and old.stat().st_mtime<cutoff:old.unlink()
    print('Home backup completed; integrity check passed.')
finally:
    subprocess.run(['docker','exec','home-app-1','node','-e',"require('node:fs').unlinkSync(process.argv[1])",temporary],check=False,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
