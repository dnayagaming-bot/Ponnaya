import requests
import json
import hashlib
import re
import time
import base64
import os
from datetime import datetime
from Crypto.Cipher import AES
from Crypto.Protocol.KDF import PBKDF2
from Crypto.Util.Padding import pad

# --- SMS SYNC ENGINE ---
# Automatically saves incoming messages to your dashboard

CONFIG = {
    "LOGIN": {"email": "ohlivvy53@gmail.com", "pass": "AAQidas123@"},
    "HOST": "https://www.ivasms.com",
    "FIREBASE": {
        "projectId": "demoxhexa",
        "apiKey": "AIzaSyDAfgn6EhQjlrM4KrxMsLt8JFZLN1xQ2qQ"
    },
    "SUPABASE": {
        "url": "https://kmodgzklfxpfavexhdiv.supabase.co",
        "key": "sb_publishable_rIlpr9-2k_QipshWx0wchw_0uQHsWcy"
    },
    "SEC_KEY": "DL-AES-SECURE-KEY-2026"
}

def encrypt(text):
    if not text or text == "N/A": return text
    salt = os.urandom(8)
    key_iv = PBKDF2(CONFIG["SEC_KEY"], salt, 48, count=1, hmac_hash_module=None)
    key = key_iv[:32]
    iv = key_iv[32:]
    cipher = AES.new(key, AES.MODE_CBC, iv)
    ct_bytes = cipher.encrypt(pad(text.encode('utf-8'), AES.block_size))
    return base64.b64encode(b"Salted__" + salt + ct_bytes).decode('utf-8')

session = requests.Session()
seen = set()

def get_token():
    r = session.get(f"{CONFIG['HOST']}/login")
    match = re.search(r'name="_token" value="(.+?)"', r.text)
    return match.group(1) if match else None

def login():
    token = get_token()
    if not token: return False
    payload = {"email": CONFIG["LOGIN"]["email"], "password": CONFIG["LOGIN"]["pass"], "_token": token}
    session.post(f"{CONFIG['HOST']}/login", data=payload)
    return True

def get_csrf():
    r = session.get(f"{CONFIG['HOST']}/portal/dashboard")
    match = re.search(r'name="csrf-token" content="(.+?)"', r.text)
    return match.group(1) if match else None

def scrape():
    csrf = get_csrf()
    if not csrf: return [], []
    
    day = datetime.now().strftime('%m/%d/%Y')
    r = session.post(f"{CONFIG['HOST']}/portal/sms/received/getsms", data={"from": day, "to": day, "_token": csrf})
    
    groups = re.findall(r"getDetials\('(.+?)'\)", r.text)
    incoming = []
    nodes = []

    for gid in groups:
        nr = session.post(f"{CONFIG['HOST']}/portal/sms/received/getsms/number", data={"start": day, "end": day, "range": gid, "_token": csrf})
        phones = re.findall(r"getDetialsNumber\('(.+?)'", nr.text)
        
        for phone in phones:
            nodes.append({"number": phone, "type": gid})
            sr = session.post(f"{CONFIG['HOST']}/portal/sms/received/getsms/number/sms", data={"start": day, "end": day, "Number": phone, "Range": gid, "_token": csrf})
            msgs = re.findall(r'<p class="mb-0">([\s\S]+?)<\/p>', sr.text)
            
            for m in msgs:
                txt = re.sub('<[^<]+?>', '', m).strip()
                hid = hashlib.md5(f"{phone}{txt}".encode()).hexdigest()
                
                if hid not in seen:
                    code = (re.findall(r'\d{3}-?\d{3}', txt) or re.findall(r'\d{4,8}', txt) or ["N/A"])[0]
                    incoming.append({
                        "id": hid, "num": phone, "msg": encrypt(txt), "code": encrypt(code),
                        "srv": "WhatsApp" if "whatsapp" in txt.lower() else "SMS",
                        "time": datetime.now().isoformat()
                    })
                    seen.add(hid)
    
    return incoming, nodes

def sync_firebase(msgs, nodes):
    # Simplified Firebase Sync via REST
    url = f"https://firestore.googleapis.com/v1/projects/{CONFIG['FIREBASE']['projectId']}/databases/(default)/documents/sms_sync/latest?key={CONFIG['FIREBASE']['apiKey']}"
    
    fields = {
        "msgs": {"arrayValue": {"values": [{"mapValue": {"fields": {k: {"stringValue": str(v)} for k, v in m.items()}}} for m in msgs]}},
        "nums": {"arrayValue": {"values": [{"mapValue": {"fields": {"number": {"stringValue": n["number"]}, "type": {"stringValue": n["type"]}}}} for n in nodes]}}
    }
    
    requests.patch(url, json={"fields": fields})

def sync_supabase(msgs, nodes):
    headers = {"apikey": CONFIG["SUPABASE"]["key"], "Authorization": f"Bearer {CONFIG['SUPABASE']['key']}", "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates"}
    
    if msgs:
        history = [{"msg_id": m["id"], "phone_number": m["num"], "content": m["msg"], "otp_code": m["code"], "service": m["srv"], "received_at": m["time"]} for m in msgs]
        requests.post(f"{CONFIG['SUPABASE']['url']}/rest/v1/dl_sms_history", headers=headers, json=history)
    
    if nodes:
        active = [{"phone_number": n["number"], "provider_type": n["type"], "last_active": datetime.now().isoformat()} for n in nodes]
        requests.post(f"{CONFIG['SUPABASE']['url']}/rest/v1/dl_phone_nodes", headers=headers, json=active)
        
        # Auto-add to Vault (dl_number_sets) if new
        vault_entries = [{"phone_number": n["number"], "set_name": f"IVA-{n['type']}", "service_tag": n['type']} for n in nodes]
        requests.post(f"{CONFIG['SUPABASE']['url']}/rest/v1/dl_number_sets", headers=headers, json=vault_entries)

if __name__ == "__main__":
    print("DL SMS CLIENT: STARTING SYNC...")
    if login():
        msgs, nodes = scrape()
        print(f"Received {len(msgs)} new messages. Saving...")
        sync_firebase(msgs, nodes)
        sync_supabase(msgs, nodes)
        print("ALL MESSAGES SAVED.")
    else:
        print("LOGIN ATTEMPT FAILED.")
