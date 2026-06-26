/**
 * Service to interface with AI models.
 * Supports local Ollama API (port 11434) and custom local AI servers (port 8000).
 */

// Helper to clean up any potential markdown block wrapped around JSON output from LLMs
function cleanJsonString(str) {
  let cleaned = str.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

// Helper to resolve localhost:8000 to Vite's reverse proxy '/custom-api' to bypass CORS
function resolveEndpoint(endpoint) {
  if (endpoint && (endpoint.includes('localhost:8000') || endpoint.includes('127.0.0.1:8000'))) {
    return '/custom-api';
  }
  if (endpoint && (endpoint.includes('localhost:11434') || endpoint.includes('127.0.0.1:11434'))) {
    return '/ollama-api';
  }
  return endpoint;
}

export const ollamaService = {
  /**
   * Check connection to Ollama server by fetching models
   */
  async checkConnection(endpoint = 'http://localhost:11434') {
    const target = resolveEndpoint(endpoint);
    try {
      const response = await fetch(`${target}/api/tags`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      return response.ok;
    } catch (e) {
      console.warn('Ollama connection check failed:', e);
      return false;
    }
  },

  /**
   * Fetch all installed models on the local Ollama server
   */
  async fetchModels(endpoint = 'http://localhost:11434') {
    const target = resolveEndpoint(endpoint);
    try {
      const response = await fetch(`${target}/api/tags`);
      if (!response.ok) throw new Error('Failed to fetch models');
      const data = await response.json();
      return data.models || [];
    } catch (e) {
      console.error('Error fetching Ollama models:', e);
      return [];
    }
  },

  /**
   * Query the selected model on Ollama
   * Returns a JSON object with decision keys: left_motor, right_motor, thought, mental_map, anomaly_detected
   */
  async queryAI(endpoint, model, systemPrompt, history, currentSensor, mentalMapState, imageBase64 = null) {
    const target = resolveEndpoint(endpoint);
    try {
      const prompt = `
[CURRENT SENSOR INPUT]
- Ultrasonic Sensor Reading: ${currentSensor.distance.toFixed(1)} cm
- Current Position Estimator (Odometer): X=${currentSensor.x.toFixed(1)}, Y=${currentSensor.y.toFixed(1)}, Angle=${currentSensor.angle.toFixed(1)}°
- Bumper Collision State: ${currentSensor.collided ? 'COLLIDED / OBSTACLE HIT' : 'Clear'}

[PREVIOUS MENTAL MAP STATE]
${mentalMapState || 'No mental map built yet.'}

[RECENT ACTION HISTORY]
${history && history.length > 0 
  ? history.map((h, i) => `${i + 1}. Distance=${h.distance.toFixed(1)}cm, Action: Left=${h.left.toFixed(2)} Right=${h.right.toFixed(2)} -> Thought: "${h.thought}"`).join('\n')
  : 'None (just started)'
}

[INSTRUCTIONS]
Based on your sensor input, history, and previous mental map, decide what motor commands to send to the Arduino.
You must:
1. Update your mental map representation of the room (e.g. note obstacle positions, layout).
2. Check if there is an anomaly or change in the environment (e.g. if the sensor reads a different distance than expected for this position, or if you hit a wall, or if an obstacle was moved).
3. Output the motor speeds to navigate safely (avoid collisions, explore the space).

You MUST respond ONLY with a raw JSON object (no other text, no markdown blocks) using this format:
{
  "left_motor": (float between -1.0 and 1.0, where 1.0 is forward, -1.0 is backward),
  "right_motor": (float between -1.0 and 1.0, where 1.0 is forward, -1.0 is backward),
  "thought": "Short sentence explaining why you made this move",
  "mental_map": "Updated description of your mental map grid (e.g. 'Obstacle at X=15, Y=-10. Clear path ahead. New room boundary detected.')",
  "anomaly_detected": (true/false, true if an obstacle moved or if you are in a brand new space you haven't mapped)
}
`;

      let imagesArray = undefined;
      if (imageBase64) {
        let rawBase64 = imageBase64;
        if (rawBase64.includes(',')) {
          rawBase64 = rawBase64.split(',')[1];
        }
        imagesArray = [rawBase64];
      }

      const response = await fetch(`${target}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model,
          system: systemPrompt,
          prompt: prompt,
          stream: false,
          images: imagesArray,
          options: {
            temperature: 0.2,
            num_ctx: 8192,
            num_predict: 1024
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.error(`Ollama request failed: Status ${response.status}, Error:`, errText);
        throw new Error(`Ollama request failed with status ${response.status}: ${errText}`);
      }

      const data = await response.json();
      const rawText = data.response;
      
      try {
        const cleanedText = cleanJsonString(rawText);
        const parsed = JSON.parse(cleanedText);
        
        const left_motor = Math.max(-1, Math.min(1, Number(parsed.left_motor || 0)));
        const right_motor = Math.max(-1, Math.min(1, Number(parsed.right_motor || 0)));
        
        return {
          left_motor,
          right_motor,
          thought: parsed.thought || 'Exploring.',
          mental_map: parsed.mental_map || mentalMapState,
          anomaly_detected: !!parsed.anomaly_detected,
          rawResponse: rawText
        };
      } catch (parseError) {
        console.error('Failed to parse JSON response from Ollama:', rawText, parseError);
        const leftMatch = rawText.match(/"left_motor"\s*:\s*(-?\d+(\.\d+)?)/);
        const rightMatch = rawText.match(/"right_motor"\s*:\s*(-?\d+(\.\d+)?)/);
        const thoughtMatch = rawText.match(/"thought"\s*:\s*"([^"]+)"/);
        
        return {
          left_motor: leftMatch ? Math.max(-1, Math.min(1, parseFloat(leftMatch[1]))) : 0,
          right_motor: rightMatch ? Math.max(-1, Math.min(1, parseFloat(rightMatch[1]))) : 0,
          thought: thoughtMatch ? thoughtMatch[1] : 'Processing error, holding position.',
          mental_map: mentalMapState,
          anomaly_detected: false,
          rawResponse: rawText,
          error: 'JSON parse error'
        };
      }
    } catch (e) {
      console.error('Error querying Ollama API:', e);
      throw e;
    }
  },

  /**
   * Check connection to the custom AI server running on port 8000
   */
  async checkCustomConnection(endpoint = 'http://localhost:8000') {
    const target = resolveEndpoint(endpoint);
    try {
      // Check server via a simple fetch (e.g. root or options)
      const response = await fetch(`${target}`, { method: 'OPTIONS' }).catch(() => null);
      if (response) return true;
      
      // Fallback: try querying a check on endpoint
      const res = await fetch(`${target}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'ping', sensors: { distance: 100, x: 0, y: 0, collided: false } })
      });
      return res.status === 200 || res.status === 404; // 404 means route exists but checking got rejected, 200 is healthy
    } catch (e) {
      // If we got CORS or connection refused, it failed
      console.warn('Custom server connection check failed:', e);
      return false;
    }
  },

  /**
   * Query the text-only endpoint on the custom AI server
   */
  async queryCustomCommand(endpoint = 'http://localhost:8000', promptText, sensors, history, mentalMap) {
    const target = resolveEndpoint(endpoint);
    try {
      const response = await fetch(`${target}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: promptText,
          system_prompt: "You control an Arduino board. Analyze the request and respond with ONLY valid JSON: {\"action\": \"DRIVE\", \"params\": {\"left\": 0.5, \"right\": 0.5}}",
          history: history || [],
          mental_map: mentalMap || ""
        })
      });

      if (!response.ok) {
        throw new Error(`Custom server '/command' endpoint failed with status ${response.status}`);
      }

      return await response.json(); // Returns { action: "DRIVE", params: { left: 0.5, right: 0.5 } }
    } catch (e) {
      console.error('Error querying Custom Server /command:', e);
      throw e;
    }
  },

  /**
   * Query the combined vision + decision-making endpoint on the custom AI server
   */
  async queryCustomTandem(endpoint = 'http://localhost:8000', imageBase64, promptText, sensors, history, mentalMap) {
    const target = resolveEndpoint(endpoint);
    try {
      const response = await fetch(`${target}/pipeline/tandem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: promptText,
          include_vision: true,
          vision_question: "Describe what you see in the camera frame, identify any obstacles, and decide how the robot car should move.",
          image: imageBase64,
          history: history || [],
          mental_map: mentalMap || ""
        })
      });

      if (!response.ok) {
        throw new Error(`Custom server '/pipeline/tandem' endpoint failed with status ${response.status}`);
      }

      return await response.json(); // Returns { action: "DRIVE", params: { left: 0.5, right: 0.5 } }
    } catch (e) {
      console.error('Error querying Custom Server /pipeline/tandem:', e);
      throw e;
    }
  }
};
