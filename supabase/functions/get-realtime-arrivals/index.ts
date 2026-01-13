import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { lat, lon } = await req.json()
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

    const { data: stops, error: dbError } = await supabase.rpc('get_nearby_stops', {
      user_lat: lat, user_lon: lon, radius_meters: 1000
    })
    if (dbError) throw dbError

    const results = []

    for (const stop of (stops || []).slice(0, 5)) {
      let arrivals = []
      try {
        // שימוש ב-IP ישיר לעקיפת שגיאת ה-DNS שראינו בלוגים
        const resp = await fetch(`https://172.67.181.181/siri/stop/${stop.stop_id}`, {
          headers: { "Host": "bus.israel-it.org" }
        })
        
        if (resp.ok) {
          const data = await resp.json()
          const list = data.arrivals || []
          arrivals = list.map((a: any) => ({
            line: a.line_name || "Unknown",
            minutes_away: Math.round(a.minutes_away || 0)
          }))
        }
      } catch (e) {
        console.error(`Fetch error for stop ${stop.stop_id}:`, e.message)
      }
      results.push({ ...stop, arrivals })
    }

    return new Response(JSON.stringify({ stops: results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 400 })
  }
})