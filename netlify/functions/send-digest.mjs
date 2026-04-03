// Email digest sender via Resend API
export default async (req) => {
  const RESEND = Netlify.env.get("RESEND_API_KEY");
  const AKEY = Netlify.env.get("ANTHROPIC_API_KEY");
  if (req.method === "OPTIONS") return new Response(null, {headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"POST","Access-Control-Allow-Headers":"Content-Type"}});
  let body; try { body = await req.json() } catch { body = {} }
  const email = body.email;
  if (!email) return new Response(JSON.stringify({error:"Email required"}),{status:400,headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}});
  const today = new Date().toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"});
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method:"POST", headers:{"Content-Type":"application/json","x-api-key":AKEY,"anthropic-version":"2023-06-01"},
      body: JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:2048,
        system:"You are The Signal. Write a morning briefing email in clean HTML with inline styles. Use #FAFAF7 bg, #1A1917 text. Include: header, greeting, 5 top stories, one deep dive paragraph, footer.",
        tools:[{type:"web_search_20250305",name:"web_search"}],
        messages:[{role:"user",content:"Create morning briefing for "+today+". Search news first."}]})
    });
    const d = await r.json();
    let html = (d.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("").replace(/<\/?\/cite[^>]*>/gi,"");
    if (!RESEND) return new Response(JSON.stringify({success:false,error:"Set RESEND_API_KEY in Netlify env vars",preview:html.slice(0,300)}),{status:200,headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}});
    const sr = await fetch("https://api.resend.com/emails", {
      method:"POST", headers:{"Content-Type":"application/json",Authorization:"Bearer "+RESEND},
      body: JSON.stringify({from:"The Signal <signal@resend.dev>",to:[email],subject:"The Signal — "+today,html:html})
    });
    const sd = await sr.json();
    if (sr.ok) return new Response(JSON.stringify({success:true,id:sd.id}),{headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}});
    return new Response(JSON.stringify({success:false,error:sd}),{status:422,headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}});
  } catch(e) { return new Response(JSON.stringify({error:e.message}),{status:500,headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}}) }
};
export const config = { path: "/api/digest" };
