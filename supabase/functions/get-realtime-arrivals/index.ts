import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // בדיקה ישירה של השרת הקהילתי
    const testUrl = "https://172.67.181.181/siri/stop/14917"
    const resp = await fetch(testUrl, {
      headers: { "Host": "bus.israel-it.org" }
    })
    
    const status = resp.status
    const text = await resp.text()
    
    return new Response(JSON.stringify({ 
      status: status, 
      preview: text.substring(0, 200),
      message: "Check Supabase logs for full details" 
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })

  } catch (e) {
    console.error("CRITICAL ERROR:", e.message)
    return new Response(JSON.stringify({ error: e.message }), { headers: corsHeaders, status: 500 })
  }
})