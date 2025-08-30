/** ===================== Code.gs (Google Apps Script, ES5-safe) =====================

  FEATURES
  - Optional SHEET_ID for standalone scripts; works bound-to-sheet as well.
  - Auto-creates tabs & headers on first run:
      Projects / Inventory / Leads / Admin
  - Leads tab includes "Permission-Block" column for blocking by IP/Mobile.
  - GET endpoints:
      ?type=ping
      ?type=projects
      ?type=inventory&project=ProjectName
      ?type=admins
      ?type=checkblock&ip=...&mobile=...      (optional helper; not required for current flow)
  - POST actions (send JSON body as text/plain):
      action=addlead              -> returns { success:true, blocked:true|false }
      action=addproject
      action=addinventory
      action=bulkaddinventory
      action=updateproject
      action=deleteproject
      action=updateinventory
      action=deleteinventory

  IMPORTANT (Frontend):
  - For POST: use fetch(..., { method:"POST", headers:{"Content-Type":"text/plain"}, body: JSON.stringify({...}) })
    to avoid CORS preflight with Apps Script.

==================================================================================== **/

/** If your script is STANDALONE, set SHEET_ID (from the Sheet URL).
 *  If the script is BOUND to the sheet (created via Extensions → Apps Script),
 *  you can leave this empty and we’ll use getActiveSpreadsheet().
 */
var SHEET_ID = ''; // e.g. '1AbCdEfGh...'; leave '' if bound to sheet

// Sheet/tab names
var TABS = {
  projects:  'Projects',
  inventory: 'Inventory',
  leads:     'Leads',
  admins:    'Admin'
};

// ---------- Spreadsheet helpers ----------
function ss(){
  if (SHEET_ID && SHEET_ID !== '') {
    return SpreadsheetApp.openById(SHEET_ID);
  }
  var s = SpreadsheetApp.getActiveSpreadsheet();
  if (!s) throw new Error('No active spreadsheet. Set SHEET_ID at top of Code.gs.');
  return s;
}
function sh(name){ return ss().getSheetByName(name); }

function toObjects(values){
  if(!values || values.length===0) return [];
  var h=values[0], out=[];
  for(var r=1;r<values.length;r++){
    var o={};
    for(var c=0;c<h.length;c++){ o[h[c]]=values[r][c]; }
    out.push(o);
  }
  return out;
}

/** Ensure tabs & headers exist; add "Permission-Block" if missing in Leads */
function ensure(){
  var s, hdr;

  if(!sh(TABS.projects)){
    s = ss().insertSheet(TABS.projects);
    s.appendRow(['Project Name','Location','Product Mix','Budget Range','Brochure URL','Photo URL 1','Photo URL 2','Photo URL 3','Photo URL 4','Video URL','Description']);
  }

  if(!sh(TABS.inventory)){
    s = ss().insertSheet(TABS.inventory);
    s.appendRow(['Project Name','Location','Property Type','Property Status','Unit Number','Size','Budget','Possession','Payment Plan']);
  }

  if(!sh(TABS.leads)){
    s = ss().insertSheet(TABS.leads);
    s.appendRow(['Date','Timestamp','IsAgent','Name','Mobile','City','Company','Timezone','IP','DeviceType','Permission-Block']);
  } else {
    // Add "Permission-Block" column if existing sheet doesn't have it
    s = sh(TABS.leads);
    hdr = s.getRange(1,1,1,s.getLastColumn()).getValues()[0];
    if (indexOfHeader(hdr, 'Permission-Block') === -1) {
      s.insertColumnAfter(hdr.length);
      s.getRange(1, hdr.length+1).setValue('Permission-Block');
    }
  }

  if(!sh(TABS.admins)){
    s = ss().insertSheet(TABS.admins);
    s.appendRow(['Username','Password']);
    s.appendRow(['admin','admin123']); // default credentials
  }
}

function ok(o){
  return ContentService
    .createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}
function err(m){
  return ContentService
    .createTextOutput(JSON.stringify({error:String(m)}))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------- HTTP ----------
function doGet(e){
  try{
    ensure();

    var type=(e&&e.parameter&&e.parameter.type)? String(e.parameter.type).toLowerCase():'';
    if(type==='' || type==='ping'){
      return ok({ ok:true, sheetId: ss().getId() });
    }

    // Optional helper endpoint (not necessary for current flow)
    if(type==='checkblock'){
      var ip     = (e && e.parameter && e.parameter.ip) ? String(e.parameter.ip) : '';
      var mobile = (e && e.parameter && e.parameter.mobile) ? String(e.parameter.mobile) : '';
      return ok({ blocked: isBlocked(ip, mobile) });
    }

    if(type==='projects'){
      return ok(toObjects(sh(TABS.projects).getDataRange().getValues()));
    }

    if(type==='inventory'){
      var all = toObjects(sh(TABS.inventory).getDataRange().getValues());
      var p   = (e&&e.parameter&&e.parameter.project)? String(e.parameter.project):'';
      if(p){
        var filtered=[], i;
        for(i=0;i<all.length;i++){
          if(String(all[i]['Project Name'])===p) filtered.push(all[i]);
        }
        return ok(filtered);
      }
      return ok(all);
    }

    if(type==='admins'){
      return ok(toObjects(sh(TABS.admins).getDataRange().getValues()));
    }

    return err('Unknown GET type');
  }catch(ex){
    return err(ex);
  }
}

function doPost(e){
  try{
    ensure();

    var action=(e&&e.parameter&&e.parameter.action)? String(e.parameter.action).toLowerCase():'';
    var body={};

    if(e && e.postData && e.postData.contents){
      try{
        body = JSON.parse(e.postData.contents); // text/plain JSON from frontend
      }catch(exParse){
        return err('Invalid JSON body');
      }
    }

    if(action==='addlead')          return ok(addLead(body));
    if(action==='addproject')       return ok(addProject(body));
    if(action==='addinventory')     return ok(addInventory(body));
    if(action==='bulkaddinventory') return ok(bulkAddInventory(body));
    if(action==='updateproject')    return ok(updateProject(body));
    if(action==='deleteproject')    return ok(deleteProject(body));
    if(action==='updateinventory')  return ok(updateInventory(body));
    if(action==='deleteinventory')  return ok(deleteInventory(body));

    return err('Unknown POST action');
  }catch(ex){
    return err(ex);
  }
}

// ---------- Blocking logic (by IP or Mobile) ----------
function isBlocked(ip, mobile){
  var sheet = sh(TABS.leads);
  var v = sheet.getDataRange().getValues();
  if(v.length < 2) return false;

  var headers = v[0];
  var ipIdx   = indexOfHeader(headers, 'IP');
  var mobIdx  = indexOfHeader(headers, 'Mobile');
  var permIdx = indexOfHeader(headers, 'Permission-Block');

  var i, ipVal, mobVal, perm;
  for(i=1;i<v.length;i++){
    ipVal  = (ipIdx  >=0) ? String(v[i][ipIdx])  : '';
    mobVal = (mobIdx >=0) ? String(v[i][mobIdx]) : '';
    perm   = (permIdx>=0) ? String(v[i][permIdx]).toLowerCase() : '';
    if ((ip && ipVal===ip) || (mobile && mobVal===mobile)) {
      if(perm==='block' || perm==='blocked' || perm==='yes' || perm==='true' || perm==='1'){
        return true;
      }
    }
  }
  return false;
}

// ---------- Leads ----------
/** Adds a lead and returns {success:true, blocked:true|false}
 *  - Always appends the lead (so you have a record)
 *  - If IP/Mobile present in Leads with Permission-Block set, blocked=true
 */
function addLead(d){
  var l   = sh(TABS.leads);
  var now = new Date();
  var date = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var time = Utilities.formatDate(now, Session.getScriptTimeZone(), 'HH:mm:ss');

  var blocked = isBlocked(d.ip || '', d.mobile || '');

  var headers = l.getRange(1,1,1,l.getLastColumn()).getValues()[0];
  var permIndex = indexOfHeader(headers, 'Permission-Block');

  var row = [
    date, time,
    d.isAgent || '',
    d.name || '',
    d.mobile || '',
    d.city || '',
    d.company || '',
    d.timezone || '',
    d.ip || '',
    d.deviceType || ''
  ];
  if (permIndex >= 0) {
    row.push(''); // leave Permission-Block blank on new insert
  }

  l.appendRow(row);

  return { success:true, blocked: blocked };
}

// ---------- Projects CRUD ----------
function addProject(p){
  var s=sh(TABS.projects);
  var p1=(p.photoUrls&&p.photoUrls.length>0)?p.photoUrls[0]:'';
  var p2=(p.photoUrls&&p.photoUrls.length>1)?p.photoUrls[1]:'';
  var p3=(p.photoUrls&&p.photoUrls.length>2)?p.photoUrls[2]:'';
  var p4=(p.photoUrls&&p.photoUrls.length>3)?p.photoUrls[3]:'';
  s.appendRow([
    p.projectName||'',
    p.location||'',
    p.productMix||'',
    p.budgetRange||'',
    p.brochureURL||'',
    p1,p2,p3,p4,
    p.videoURL||'',
    p.description||''
  ]);
  return {success:true};
}

function updateProject(body){
  var s=sh(TABS.projects);
  var id=body.id; // Project Name used as key
  var row=findRowByKey(s,'Project Name',id);
  if(row<0) return {success:false,message:'Not found'};
  writeFields(s,row,body.fields||{});
  return {success:true};
}

function deleteProject(body){
  var s=sh(TABS.projects);
  var row=findRowByKey(s,'Project Name',body.id);
  if(row<0) return {success:false,message:'Not found'};
  s.deleteRow(row);
  return {success:true};
}

// ---------- Inventory CRUD ----------
function addInventory(p){
  var s=sh(TABS.inventory);
  s.appendRow([
    p.projectName||'',
    p.location||'',
    p.propertyType||'',
    p.propertyStatus||'',
    p.unitNumber||'',
    p.size||'',
    p.budget||'',
    p.possession||'',
    p.paymentPlan||''
  ]);
  return {success:true};
}

function updateInventory(body){
  var s=sh(TABS.inventory);
  var match=body.match||{};
  var row=findRowByMatch(s,match);
  if(row<0) return {success:false,message:'Not found'};
  writeFields(s,row,body.fields||{});
  return {success:true};
}

function deleteInventory(body){
  var s=sh(TABS.inventory);
  var match=body.match||{};
  var row=findRowByMatch(s,match);
  if(row<0) return {success:false,message:'Not found'};
  s.deleteRow(row);
  return {success:true};
}

function bulkAddInventory(body){
  var rows=(body&&body.rows)?body.rows:[];
  if(!rows.length) return {success:false,message:'No rows'};

  var s=sh(TABS.inventory);
  var headers=['Project Name','Location','Property Type','Property Status','Unit Number','Size','Budget','Possession','Payment Plan'];
  var values=[], i, r, h, key, arr;

  for(i=0;i<rows.length;i++){
    r=rows[i]; arr=[];
    for(h=0;h<headers.length;h++){ key=headers[h]; arr.push(r[key]||''); }
    values.push(arr);
  }
  s.getRange(s.getLastRow()+1,1,values.length,headers.length).setValues(values);
  return {success:true,count:values.length};
}

// ---------- Helpers ----------
function indexOfHeader(headers, name){
  for (var i=0;i<headers.length;i++){
    if (headers[i] === name) return i;
  }
  return -1;
}

function findRowByKey(sheet,keyHeader,keyValue){
  var v=sheet.getDataRange().getValues();
  var headers=v[0], keyIndex=indexOfHeader(headers, keyHeader), r;
  if(keyIndex<0) return -1;
  for(r=1;r<v.length;r++){
    if(String(v[r][keyIndex])===String(keyValue)) return r+1; // 1-based
  }
  return -1;
}

function findRowByMatch(sheet,match){
  var v=sheet.getDataRange().getValues();
  var headers=v[0], r, i, k, idx, ok;
  for(r=1;r<v.length;r++){
    ok=true;
    for(k in match){
      idx=indexOfHeader(headers,k);
      if(idx<0 || String(v[r][idx])!==String(match[k])){ ok=false; break; }
    }
    if(ok) return r+1;
  }
  return -1;
}

function writeFields(sheet,row,fields){
  var headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
  for(var i=0;i<headers.length;i++){
    var h=headers[i];
    if(fields.hasOwnProperty(h)){
      sheet.getRange(row,i+1).setValue(fields[h]);
    }
  }
}