

interface Env {
  BUCKET: any;
}

export const onRequestPut = async (context: any) => {
  const key = context.params.key;
  const url = new URL(context.request.url);
  const projectId = url.searchParams.get('project');
  const contentType = context.request.headers.get('Content-Type') || 'application/octet-stream';

  try {
    // 1. CRITICAL CHECK: Verify R2 Binding
    if (!context.env.BUCKET) {
      console.error("R2 Binding 'BUCKET' is missing in Cloudflare Pages Settings.");
      return Response.json({ 
        error: "Server Configuration Error: R2 Bucket binding 'BUCKET' not found. Please check Cloudflare Pages Settings -> Functions -> R2 Bucket Bindings." 
      }, { status: 500 });
    }
    
    // 2. Determine Storage Key
    // If project ID is provided, store in a folder structure "projectId/filename"
    // Decode key to handle potential URL encoding issues from client
    const decodedKey = decodeURIComponent(key);
    const storageKey = projectId ? `${projectId}/${decodedKey}` : decodedKey;
    
    // 3. Get Body Stream
    const body = context.request.body;
    if (!body) {
         return Response.json({ error: "No file data received" }, { status: 400 });
    }
    
    // 4. Upload to R2
    // Cloudflare Pages Functions R2 binding supports streaming the request body directly.
    // This is crucial for large files (like 27MB audio) to avoid memory limits.
    const object = await context.env.BUCKET.put(storageKey, body, {
        httpMetadata: { contentType: contentType }
    });
    
    if (!object) {
        throw new Error("R2 put operation returned null");
    }
    
    // 5. Return success
    const publicUrl = `/api/images/${encodeURIComponent(storageKey)}`;
    return Response.json({ success: true, url: publicUrl, key: object.key });

  } catch (err: any) {
    console.error("R2 Upload Error:", err);
    return Response.json({ error: `Upload Failed: ${err.message}` }, { status: 500 });
  }
};

export const onRequestGet = async (context: any) => {
  // Decode the key to get the actual R2 path (handling slashed folders)
  const key = decodeURIComponent(context.params.key);
  
  try {
    if (!context.env.BUCKET) return new Response("Server Config Error: R2 Bucket not configured", {status: 500});
    
    const object = await context.env.BUCKET.get(key);
    
    if (!object) {
        return new Response("File not found in R2", { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    // Force allow range requests for audio seeking
    headers.set('Accept-Ranges', 'bytes'); 
    
    // If it's a range request (audio seeking), handle it roughly
    // Note: R2 get() supports range, but standard object.body usually handles it if passed through.
    // However, for basic implementation, we just return the body.
    // Advanced: context.request.headers.get("Range") logic requires manual slicing or R2 range options.
    
    return new Response(object.body, { headers });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
};

export const onRequestDelete = async (context: any) => {
  const key = decodeURIComponent(context.params.key);

  try {
    if (!context.env.BUCKET) return new Response("R2 Bucket not configured", {status: 500});
    
    await context.env.BUCKET.delete(key);
    return Response.json({ success: true });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
};