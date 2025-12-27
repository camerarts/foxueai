
interface Env {
  BUCKET: any;
  ELEVENLABS_API_KEY: string;
}

export const onRequestPost = async (context: any) => {
  try {
    const { request, env } = context;
    const { text, voice_id, stream, model_id } = await request.json();

    if (!env.ELEVENLABS_API_KEY) {
      return Response.json({ error: "Server Configuration Error: Missing ELEVENLABS_API_KEY" }, { status: 500 });
    }

    if (!text || !voice_id) {
      return Response.json({ error: "Missing text or voice_id" }, { status: 400 });
    }

    // 1. Generate Cache Key (Hash of content + voice + model)
    const encoder = new TextEncoder();
    const data = encoder.encode(`${text}::${voice_id}::${model_id || 'default'}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    const filename = `tts/${hashHex}.mp3`;

    // 2. If NOT streaming, check cache first (Cost Optimization)
    if (!stream && env.BUCKET) {
        const cachedObject = await env.BUCKET.get(filename);
        if (cachedObject) {
            // Cache Hit: Return the URL to the stored file
            return Response.json({ 
                cached: true, 
                url: `/api/images/${encodeURIComponent(filename)}` // Re-using existing image proxy for R2 access
            });
        }
    }

    // 3. Call ElevenLabs API
    const elevenLabsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voice_id}${stream ? '/stream' : ''}`;
    
    const response = await fetch(elevenLabsUrl, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': env.ELEVENLABS_API_KEY
      },
      body: JSON.stringify({
        text: text,
        model_id: model_id || "eleven_multilingual_v2", // Better for mixed Chinese/English
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return Response.json({ error: `ElevenLabs Error: ${errText}` }, { status: response.status });
    }

    // 4. Handle Response
    if (stream) {
      // Pass-through stream directly to frontend for low latency
      return new Response(response.body, {
        headers: { 'Content-Type': 'audio/mpeg' }
      });
    } else {
      // Buffer the audio
      const audioBuffer = await response.arrayBuffer();
      
      // Save to R2 Cache if bucket exists
      if (env.BUCKET) {
        await env.BUCKET.put(filename, audioBuffer, {
            httpMetadata: { contentType: 'audio/mpeg' }
        });
      }

      // Return the access URL
      return Response.json({ 
        cached: false, 
        url: `/api/images/${encodeURIComponent(filename)}` 
      });
    }

  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
};
