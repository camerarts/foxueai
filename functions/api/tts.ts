
interface Env {
  BUCKET: any;
  ELEVENLABS_API_KEY: string;
}

function splitText(text: string, limit: number): string[] {
  if (text.length <= limit) return [text];
  
  const chunks = [];
  let remaining = text;
  
  while (remaining.length > limit) {
    // Try to split at the last '。' within the limit
    let splitIdx = remaining.lastIndexOf('。', limit);
    
    // Fallback delimiters if '。' not found
    if (splitIdx === -1) splitIdx = remaining.lastIndexOf('.', limit);
    if (splitIdx === -1) splitIdx = remaining.lastIndexOf('！', limit);
    if (splitIdx === -1) splitIdx = remaining.lastIndexOf('!', limit);
    if (splitIdx === -1) splitIdx = remaining.lastIndexOf('？', limit);
    if (splitIdx === -1) splitIdx = remaining.lastIndexOf('?', limit);
    if (splitIdx === -1) splitIdx = remaining.lastIndexOf('\n', limit);
    if (splitIdx === -1) splitIdx = remaining.lastIndexOf('，', limit);
    if (splitIdx === -1) splitIdx = remaining.lastIndexOf(',', limit);
    
    // If absolutely no punctuation found, split at limit
    if (splitIdx === -1) {
       splitIdx = limit;
    } else {
       splitIdx += 1; // Include the punctuation mark
    }
    
    chunks.push(remaining.substring(0, splitIdx));
    remaining = remaining.substring(splitIdx);
  }
  
  if (remaining.length > 0) {
    chunks.push(remaining);
  }
  
  return chunks;
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

    const CHAR_LIMIT = 1700;

    // 3. Handle Long Text (Split & Merge Strategy) - Only for non-streaming
    if (!stream && text.length > CHAR_LIMIT) {
        const chunks = splitText(text, CHAR_LIMIT);
        const audioBuffers: ArrayBuffer[] = [];
        
        // Sequential Generation
        for (const chunk of chunks) {
             const elevenLabsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`;
             const response = await fetch(elevenLabsUrl, {
                method: 'POST',
                headers: {
                    'Accept': 'audio/mpeg',
                    'Content-Type': 'application/json',
                    'xi-api-key': env.ELEVENLABS_API_KEY
                },
                body: JSON.stringify({
                    text: chunk,
                    model_id: model_id || "eleven_multilingual_v2",
                    voice_settings: { stability: 0.5, similarity_boost: 0.75 }
                })
             });

             if (!response.ok) {
                 const errText = await response.text();
                 throw new Error(`ElevenLabs Split Error: ${errText}`);
             }
             
             audioBuffers.push(await response.arrayBuffer());
        }

        // Merge Audio Buffers
        const totalLength = audioBuffers.reduce((acc, buf) => acc + buf.byteLength, 0);
        const mergedBuffer = new Uint8Array(totalLength);
        let offset = 0;
        for (const buf of audioBuffers) {
            mergedBuffer.set(new Uint8Array(buf), offset);
            offset += buf.byteLength;
        }

        // Save to R2
        if (env.BUCKET) {
            await env.BUCKET.put(filename, mergedBuffer.buffer, {
                httpMetadata: { contentType: 'audio/mpeg' }
            });
        }

        return Response.json({ 
            cached: false, 
            url: `/api/images/${encodeURIComponent(filename)}` 
        });
    }

    // 4. Standard Generation (Short Text or Streaming)
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
        model_id: model_id || "eleven_multilingual_v2",
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

    if (stream) {
      // Pass-through stream
      return new Response(response.body, {
        headers: { 'Content-Type': 'audio/mpeg' }
      });
    } else {
      // Save to R2
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
