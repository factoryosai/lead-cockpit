// Vercel serverless: Google Sheet (Anyone with link: Viewer) -> JSON
const ID = process.env.SHEET_ID || '1K3VlszAtekhJQ8LkNkTrByqN3M9jUwo_Umm5o5Oq7oU';
const TAB = process.env.SHEET_TAB || 'Daily_Leads';
function csv(t){const r=[];let row=[],c='',q=false;for(let i=0;i<t.length;i++){const ch=t[i];
  if(q){if(ch=='"'){if(t[i+1]=='"'){c+='"';i++}else q=false}else c+=ch}
  else if(ch=='"')q=true;else if(ch==','){row.push(c);c=''}
  else if(ch=='\n'){row.push(c);r.push(row);row=[];c=''}else if(ch!='\r')c+=ch}
  if(c||row.length){row.push(c);r.push(row)}return r}
module.exports = async (req, res) => {
  try {
    const u = `https://docs.google.com/spreadsheets/d/${ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(TAB)}`;
    const t = await (await fetch(u)).text();
    if (t.trim().startsWith('<')) throw new Error('Sheet private hai: Share > Anyone with the link > Viewer karein');
    const [h, ...rows] = csv(t);
    const leads = rows.filter(r => r[0]).map(r => {
      const o = {}; h.forEach((k, i) => o[k] = r[i] || '');
      const n = k => parseFloat(o[k]) || 0;
      let p = String(o['Contact Number']).replace(/\D/g, '');
      if (p.length == 10 && /^[6-9]/.test(p)) p = '91' + p;
      return { id: o['Lead ID'], name: o['Business Name'], cat: o['Category'], area: o['Area / Locality'],
        web: /^http/.test(o['Website Status']) ? o['Website Status'] : '', phone: p, mobile: /^91[6-9]\d{9}$/.test(p),
        rating: n('Current Rating'), reviews: n('Total Reviews'), comp: o['Top Competitor'],
        compRating: n('Competitor Rating'), compReviews: n('Competitor Reviews'), reviewGap: n('Review Gap'),
        score: n('Lead Score'), hot: /hot/i.test(o['Priority']), callStatus: o['Call Status'],
        analysis: o['Team Call Pitch Analysis'], pitch: (o['WhatsApp Pitch Message'] || '').replace(/\\n/g, '\n'),
        notes: o['Team Notes'] };
    });
    res.setHeader('Cache-Control', 's-maxage=60');
    res.json({ updated: Date.now(), leads });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
