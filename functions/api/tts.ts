
interface Env {
  BUCKET: any;
  ELEVENLABS_API_KEY: string;
  AURA_API_KEY: string;
}

export const onRequestPost = async (context: any) => {
  try {
    const { request, env } = context;
    const { text, voice_id, stream, model_id, provider = 'elevenlabs' } = await request.json();

    if (!text || !voice_id) {
      return Response.json({ error: "Missing text or voice_id" }, { status: 400 });
    }

    // 1. Generate Cache Key (Hash of content + voice + model + provider)
    const encoder = new TextEncoder();
    const data = encoder.encode(`${text}::${voice_id}::${model_id || 'default'}::${provider}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    const filename = `tts/${provider}_${hashHex}.mp3`;

    // 2. Check Cache (Cost Optimization) - Only for non-streaming requests
    if (!stream && env.BUCKET) {
        const cachedObject = await env.BUCKET.get(filename);
        if (cachedObject) {
            return Response.json({ 
                cached: true, 
                url: `/api/images/${encodeURIComponent(filename)}`
            });
        }
    }

    // 3. Provider Logic
    let response: Response;

    if (provider === 'aura') {
        if (!env.AURA_API_KEY) {
            return Response.json({ error: "Server Configuration Error: Missing AURA_API_KEY" }, { status: 500 });
        }

        // Assuming Aura uses OpenAI-compatible endpoint structure based on common standards for 'aurastd'
        const auraUrl = `https://tts.aurastd.com/v1/audio/speech`;
        
        response = await fetch(auraUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${env.AURA_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: model_id || "aura-1",
                input: text,
                voice: voice_id,
                response_format: "mp3"
            })
        });

    } else {
        // Default: ElevenLabs
        if (!env.ELEVENLABS_API_KEY) {
            return Response.json({ error: "Server Configuration Error: Missing ELEVENLABS_API_KEY" }, { status: 500 });
        }

        const elevenLabsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voice_id}${stream ? '/stream' : ''}`;
        
        response = await fetch(elevenLabsUrl, {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': env.ELEVENLABS_API_KEY
          },
          body: JSON.stringify({
            text: text,
            model_id: model_id || "eleven_multilingual_v2",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75
            }
          })
        });
    }

    if (!response.ok) {
      const errText = await response.text();
      return Response.json({ error: `${provider} Error (${response.status}): ${errText}` }, { status: response.status });
    }

    if (stream) {
      // Pass-through stream to client
      return new Response(response.body, {
        headers: { 'Content-Type': 'audio/mpeg' }
      });
    } else {
      // Read stream into ArrayBuffer first for R2 storage
      const audioBuffer = await response.arrayBuffer();

      if (env.BUCKET) {
        await env.BUCKET.put(filename, audioBuffer, {
            httpMetadata: { contentType: 'audio/mpeg' }
        });
      }
      
      return Response.json({ 
        cached: false, 
        url: `/api/images/${encodeURIComponent(filename)}` 
      });
    }

  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
};
