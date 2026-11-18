# Lead Cockpit — IntellectFlow
1. Google Sheet: Share > "Anyone with the link" > Viewer.
2. GitHub pe push karo, Vercel > Import (Framework: Other). Optional env: SHEET_ID, SHEET_TAB.
3. `worker/` ko Railway/Render pe deploy karo (Root Directory: worker, persistent volume on /app/data).
   Env: TOKEN (strong secret), DASHBOARD_URL (Vercel URL), DAILY_CAP=25.
4. Dashboard > WhatsApp > Worker URL + Token daalo > QR scan (WhatsApp > Linked devices).
5. Pehle 1 number se test, phir Auto mode ON.
