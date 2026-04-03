// Server-side news fetching - API key stays on server
export default async (req) => {
  const KEY = Netlify.env.get("ANTHROPIC_API_KEY");
  if (!KEY) return new Response(JSON.stringify({error:"No API key"}), {status:500, headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}});
  if (req.method === "OPTIONS") return new Response(null, {headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"POST","Access-Control-Allow-Headers":"Content-Type"}});
  let body; try { body = await req.json() } catch { body = {} }
  const mode = body.mode || "news";
  const topic = body.topic || "";
  const question = body.question || "";
  const today = new Date().toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"});
  let sys, usr;
  if (mode==="news") {
    sys = "You are a news JSON API. Respond ONLY with a JSON array. No HTML tags, no markdown, no citation tags. Start with [ end with ].";
    usr = "Search for today's top news ("+today+"). Return JSON array of 6-8 stories: [{id,headline,summary,category,source,importance,confidence,sourceCount,keyPlayers:[],questions:[]}]";
  } else if (mode==="dive") {
    sys = "Research JSON API. ONLY valid JSON. No HTML tags.";
    usr = 'Research: "'+topic+'". Return: {background,timeline:[{date,event}],perspectives:[{view,arg}],implications,facts:[]}';
  } else if (mode==="ask") {
    sys = "Concise analyst. 2-3 paragraphs. No HTML.";
    usr = 'Story: "'+topic+'". Question: "'+question+'". Answer concisely.';
  } else if (mode==="digest") {
    sys = "Morning digest writer. Clean HTML email. Inline styles. Premium editorial design.";
    usr = "Write morning briefing for "+today+". Search news first.";
  }
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method:"POST", headers:{"Content-Type":"application/json","x-api-key":KEY,"anthropic-version":"2023-06-01"},
      body: JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:4096,system:sys,tools:[{type:"web_search_20250305",name:"web_search"}],messages:[{role:"user",content:usr}]})
    });
    if (!r.ok) return new Response(JSON.stringify({error:"API "+r.status}),{status:r.status,headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}});
    const d = await r.json();
    const texts = (d.content||[]).filter(b=>b.type==="text").map(b=>b.text);
    const raw = texts.join("\n");
    const clean = s => (s||"").replace(/<\/?[a-z][^>]*>/gi,"").trim();
    if (mode==="news") {
      let parsed = null;
      const s = raw.replace(/```json\s*/g,"").replace(/```\s*/g,"").trim();
      try { parsed = JSON.parse(s) } catch {}
      if (!parsed) { const a=s.indexOf("["),b=s.lastIndexOf("]"); if(a!==-1&&b>a) try{parsed=JSON.parse(s.slice(a,b+1))}catch{} }
      if (parsed && Array.isArray(parsed)) {
        parsed = parsed.map((x,i)=>({id:x.id||i+1,headline:clean(x.headline),summary:clean(x.summary),category:x.category||"Other",source:clean(x.source),importance:x.importance||3,confidence:x.confidence||0.8,sourceCount:x.sourceCount||3,keyPlayers:(x.keyPlayers||[]).map(clean),questions:(x.questions||[]).map(clean)}));
        return new Response(JSON.stringify({stories:parsed}),{headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}});
      }
      return new Response(JSON.stringify({error:"parse_failed",raw:raw.slice(0,300)}),{status:422,headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}});
    } else if (mode==="dive") {
      let p = null; const s = raw.replace(/```json\s*/g,"").replace(/```\s*/g,"").trim();
      try { p = JSON.parse(s) } catch {}
      if (!p) { const x=s.indexOf("{"),y=s.lastIndexOf("}"); if(x!==-1&&y>x) try{p=JSON.parse(s.slice(x,y+1))}catch{} }
      if (p) { p.background=clean(p.background);p.implications=clean(p.implications);p.facts=(p.facts||[]).map(clean) }
      return new Response(JSON.stringify({dive:p||{background:clean(raw),timeline:[],perspectives:[],facts:[]}}),{headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}});
    } else {
      return new Response(JSON.stringify({text:clean(raw)}),{headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}});
    }
  } catch(e) { return new Response(JSON.stringify({error:e.message}),{status:500,headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}}) }
};
export const config = { path: "/api/news" };
