
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

        const auraUrl = `https://tts.aurastd.com/api/v1/tts`;
        // Aura typically behaves better when generating a URL first, even for "streaming" scenarios
        // direct streaming via 'stream: true' has shown inconsistent results (returning JSON instead of binary).
        const payload: any = {
            text: text,
            model: model_id || "speech-2.6-turb",
            voice_setting: {
                voice_id: voice_id,
                speed: 1,
                vol: 1,
                pitch: 0
            },
            audio_setting: {
                sample_rate: 32000,
                bitrate: 128000,
                format: "mp3",
                channel: 1
            },
            language_boost: "auto",
            output_format: "url", // Force URL generation
            stream: false
        };

        const initRes = await fetch(auraUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${env.AURA_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!initRes.ok) {
            const errText = await initRes.text();
            return Response.json({ error: `Aura Error (${initRes.status}): ${errText}` }, { status: initRes.status });
        }

        const json: any = await initRes.json();
        
        if (!json.audio || !json.audio.startsWith('http')) {
             console.error("Aura Unexpected Response:", json);
             return Response.json({ error: `Aura success but invalid audio URL. Response: ${JSON.stringify(json)}` }, { status: 500 });
        }

        // Fetch the actual audio stream from the returned URL
        // This makes it compatible with our streaming response logic below
        response = await fetch(json.audio);

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

    // CRITICAL FIX: Check status AND Content-Type
    // Upstream might return 200 but with JSON body if something logical failed (e.g. Aura status:ok but no audio?)
    // Or normally 4xx/5xx for errors.
    const cType = response.headers.get('content-type') || '';
    
    if (!response.ok || cType.includes('application/json')) {
      const errText = await response.text();
      try {
          const errJson = JSON.parse(errText);
          return Response.json({ error: `${provider} API Error: ${errJson.detail?.message || errJson.message || JSON.stringify(errJson)}` }, { status: response.ok ? 400 : response.status });
      } catch {
          return Response.json({ error: `${provider} API Error (${response.status}): ${errText.substring(0, 200)}` }, { status: response.ok ? 500 : response.status });
      }
    }

    if (stream) {
      // Pass-through stream to client
      // Note: For Aura, this is streaming the data fetched from the temporary URL
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
