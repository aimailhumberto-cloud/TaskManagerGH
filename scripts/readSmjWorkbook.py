"""Read verified original bytes with Python stdlib; never edits the workbook."""
import hashlib,json,zipfile,xml.etree.ElementTree as ET
from pathlib import Path
SOURCE=Path('.local-data/smj-source/SMJ_HB_Targets_and_Contract_v2.xlsx')
EXPECTED='e71b43534aa380e9f239250e6ab76ffe986df574a0df69677dfd5e635de75795'
raw=SOURCE.read_bytes()
if len(raw)!=130035 or hashlib.sha256(raw).hexdigest()!=EXPECTED: raise ValueError('Source identity mismatch')
N={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
R='{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'
with zipfile.ZipFile(SOURCE) as z:
 if z.testzip() is not None: raise ValueError('Invalid workbook ZIP')
 shared=[]
 if 'xl/sharedStrings.xml' in z.namelist():
  for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('s:si',N): shared.append(''.join(t.text or '' for t in si.findall('.//s:t',N)))
 relationships={e.attrib['Id']:e.attrib['Target'] for e in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
 sheets={}
 for sheet in ET.fromstring(z.read('xl/workbook.xml')).findall('s:sheets/s:sheet',N):
  target=relationships[sheet.attrib[R]];target=target.lstrip('/') if target.startswith('/') else 'xl/'+target
  cells={}
  for cell in ET.fromstring(z.read(target)).findall('.//s:sheetData/s:row/s:c',N):
   value=cell.find('s:v',N);text=value.text if value is not None else None;typ=cell.attrib.get('t');formula=cell.find('s:f',N)
   if typ=='s' and text is not None: result=shared[int(text)]
   elif typ=='inlineStr':result=''.join(t.text or '' for t in cell.findall('.//s:t',N))
   elif typ=='b' and text is not None:result=text=='1'
   elif typ in (None,'n') and text is not None:
    try: result=float(text);result=int(result) if result.is_integer() else result
    except ValueError:result=text
   else:result=text
   cells[cell.attrib['r']]={'value':result,'formula':formula.text if formula is not None else None}
  sheets[sheet.attrib['name']]=cells
 expected=['Dashboard','Tracking','Scorecard','Fees','Routines','Terms','Clarifications','Target source','PortfolioValue','ScenarioAssumptions','RetailEvidence','TaskMapping']
 if list(sheets)!=expected:raise ValueError('Unexpected workbook sheets')
 output={'source':{'libraryFileId':'libfile_90898d2ba1a08191927ae57d76f06f3a','version':3,'sha256':EXPECTED,'fileName':SOURCE.name},'bytes':len(raw),'sheets':sheets}
 Path('.local-data/smj-workbook-cells.json').write_text(json.dumps(output,ensure_ascii=False),encoding='utf-8')
 for name,rows in [('Tracking',[6,7,8,59,60]),('Scorecard',[10,11,24]),('TaskMapping',[8,9,31,32,34,39,40,53,57,58,107]),('Routines',[1,2,3,4,5,6])]:
  print(json.dumps({'sheet':name,'rows':{str(row):{key:value['value'] for key,value in sheets[name].items() if int(''.join(c for c in key if c.isdigit()))==row} for row in rows}},ensure_ascii=True))
 print(json.dumps({'sha256':EXPECTED,'bytes':len(raw),'sheets':list(sheets),'output':'.local-data/smj-workbook-cells.json'}))
