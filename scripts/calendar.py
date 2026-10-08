"""Versioned US regular-equity-close calendar. Source schedules in docs/data-contract.md.
No extrapolation beyond 2024–2027. Extraordinary closure on 2025-01-09 included.
"""
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo
from pathlib import Path
import json
holidays = {
2024:'01-01 01-15 02-19 03-29 05-27 06-19 07-04 09-02 11-28 12-25',
2025:'01-01 01-09 01-20 02-17 04-18 05-26 06-19 07-04 09-01 11-27 12-25',
2026:'01-01 01-19 02-16 04-03 05-25 06-19 07-03 09-07 11-26 12-25',
2027:'01-01 01-18 02-15 03-26 05-31 06-18 07-05 09-06 11-25 12-24'}
early={2024:'07-03 11-29 12-24',2025:'07-03 11-28 12-24',2026:'11-27 12-24',2027:'11-26'}
out=[]
for y in range(2024,2028):
 d=date(y,1,1)
 while d.year==y:
  md=d.strftime('%m-%d')
  if d.weekday()<5 and md not in holidays[y].split():
   h=13 if md in early[y].split() else 16
   close=datetime.combine(d,time(h),ZoneInfo('America/New_York')).astimezone(timezone.utc)
   out.append({'date':d.isoformat(),'close':close.isoformat(timespec='milliseconds').replace('+00:00','Z')})
  d+=timedelta(days=1)
Path(__file__).resolve().parents[1].joinpath('src/market-data/sessions.json').write_text(json.dumps(out,separators=(',',':'))+'\n')
print('sessions',len(out))
