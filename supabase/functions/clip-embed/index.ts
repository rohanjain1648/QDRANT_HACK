import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

interface CLIPEmbedRequest {
  image?: string; // Base64 image data or URL
  text?: string; // Text description for text-to-image search
  mode: 'image' | 'text' | 'both';
}

// Generate CLIP-style embeddings using multimodal model
async function generateImageEmbedding(imageData: string): Promise<number[]> {
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: `You are a yoga pose analysis system. Analyze the image and generate a detailed semantic description focusing on:
- Body position and alignment
- Limb positions (arms, legs, head, torso)
- Balance and weight distribution
- Muscle engagement visible
- Overall pose characteristics
Return ONLY a JSON object with these fields: { "description": "detailed description", "features": ["feature1", "feature2", ...] }`
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: imageData }
            },
            {
              type: 'text',
              text: 'Analyze this yoga pose image for semantic similarity matching.'
            }
          ]
        }
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Image analysis failed: ${response.status}`);
  }

  const result = await response.json();
  const analysisText = result.choices?.[0]?.message?.content || '';
  
  // Now generate embedding from the analysis
  return await generateTextEmbedding(analysisText);
}

async function generateTextEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://ai.gateway.lovable.dev/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Embedding generation failed: ${response.status}`);
  }

  const result = await response.json();
  return result.data?.[0]?.embedding || [];
}

// Generate multimodal description for yoga pose
async function analyzePoseImage(imageData: string): Promise<{
  description: string;
  features: string[];
  poseType: string;
  bodyAlignment: string;
}> {
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: `You are an expert yoga instructor analyzing pose images. Provide detailed analysis for semantic matching.
Return a JSON object with:
{
  "description": "Comprehensive description of the pose including body position, limb placement, and alignment",
  "features": ["array", "of", "specific", "visual", "features"],
  "poseType": "standing|seated|balancing|inversion|backbend|forward fold|twist|restorative",
  "bodyAlignment": "description of spine, limbs, and weight distribution"
}`
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: imageData }
            },
            {
              type: 'text',
              text: 'Analyze this yoga pose image in detail for similarity matching.'
            }
          ]
        }
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Pose analysis failed: ${response.status}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content || '';
  
  try {
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('Failed to parse pose analysis:', e);
  }
  
  return {
    description: content,
    features: [],
    poseType: 'unknown',
    bodyAlignment: 'unknown',
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image, text, mode } = await req.json() as CLIPEmbedRequest;

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    let imageEmbedding: number[] | null = null;
    let textEmbedding: number[] | null = null;
    let poseAnalysis: {
      description: string;
      features: string[];
      poseType: string;
      bodyAlignment: string;
    } | null = null;

    if ((mode === 'image' || mode === 'both') && image) {
      // Analyze the image first
      poseAnalysis = await analyzePoseImage(image);
      
      // Generate embedding from the combined analysis
      const combinedText = `${poseAnalysis.description} Features: ${poseAnalysis.features.join(', ')}. Type: ${poseAnalysis.poseType}. Alignment: ${poseAnalysis.bodyAlignment}`;
      imageEmbedding = await generateTextEmbedding(combinedText);
    }

    if ((mode === 'text' || mode === 'both') && text) {
      textEmbedding = await generateTextEmbedding(text);
    }

    return new Response(
      JSON.stringify({
        success: true,
        imageEmbedding,
        textEmbedding,
        poseAnalysis,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('CLIP embed error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
