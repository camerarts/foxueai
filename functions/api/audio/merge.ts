
interface Env {
  BUCKET: any;
}

export const onRequestPost = async (context: any) => {
  try {
    const { request, env } = context;
    const { url1, url2, projectId } = await request.json();

    if (!env.BUCKET) {
      return Response.json({ error: "Server Configuration Error: R2 Bucket binding missing" }, { status: 500 });
    }

    if (!url1 || !url2) {
      return Response.json({ error: "Missing audio URLs" }, { status: 400 });
    }

    // Helper to extract R2 key from the public API URL
    // URL format is typically /api/images/[encoded_key]
    const getKeyFromUrl = (url: string) => {
      const parts = url.split('/api/images/');
      if (parts.length < 2) throw new Error(`Invalid URL format: ${url}`);
      return decodeURIComponent(parts[1]);
    };

    const key1 = getKeyFromUrl(url1);
    const key2 = getKeyFromUrl(url2);

    // Fetch both objects from R2 concurrently (Internal network speed is very fast)
    const [obj1, obj2] = await Promise.all([
      env.BUCKET.get(key1),
      env.BUCKET.get(key2)
    ]);

    if (!obj1 || !obj2) {
      return Response.json({ error: "Source audio files not found in storage" }, { status: 404 });
    }

    // Get ArrayBuffers
    const [buf1, buf2] = await Promise.all([
      obj1.arrayBuffer(),
      obj2.arrayBuffer()
    ]);

    // Concatenate Audio Buffers (Binary concatenation works for MP3s)
    const combinedLength = buf1.byteLength + buf2.byteLength;
    const combinedArray = new Uint8Array(combinedLength);
    combinedArray.set(new Uint8Array(buf1), 0);
    combinedArray.set(new Uint8Array(buf2), buf1.byteLength);

    // Generate new key
    const timestamp = Date.now();
    const folder = projectId ? projectId : 'temp_voice_studio';
    const newKey = `${folder}/merged_${timestamp}.mp3`;

    // Save merged file back to R2
    await env.BUCKET.put(newKey, combinedArray.buffer, {
      httpMetadata: { contentType: 'audio/mpeg' }
    });

    const publicUrl = `/api/images/${encodeURIComponent(newKey)}`;

    return Response.json({ 
      success: true, 
      url: publicUrl 
    });

  } catch (err: any) {
    console.error("Merge Error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
};
