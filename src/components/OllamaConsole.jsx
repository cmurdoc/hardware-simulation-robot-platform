import React, { useState, useEffect } from 'react';
import { Cpu, RefreshCw, CheckCircle2, AlertTriangle, Terminal, Eye, MessageSquare } from 'lucide-react';
import { ollamaService } from '../services/ollamaService';

const PERSONALITIES = {
  explorer: {
    name: 'Cautious Mapper',
    prompt: `You are the AI brain of a Raspberry Pi 5 mounted on a robot car. Your goal is to explore the 3D room, identify obstacles, and construct a mental map of where walls and furniture are. You must navigate carefully, slow down when approaching obstacles, and map the room.

Kinematics & Movement Guidelines to prevent spinning in circles:
- Drive forward: Set left_motor and right_motor to equal positive values (e.g., left_motor=0.5, right_motor=0.5).
- Turn left or right: Set one motor speed higher than the other (e.g., left_motor=0.6, right_motor=0.2 to turn right, or left_motor=0.2, right_motor=0.6 to turn left).
- Do NOT spin in place indefinitely (e.g., left_motor=0.4, right_motor=-0.4). Only spin in place for a single step to adjust your heading, then set both motors to positive values to drive forward and explore. If you spin in place every step, you will be stuck in one spot!
- If the ultrasonic sensor reads an obstacle very close (distance < 30cm), reverse immediately (e.g. left_motor=-0.4, right_motor=-0.4) for a step, then turn, and then drive forward.`
  },
  corner_finder: {
    name: 'Corner Finder',
    prompt: `You are the AI brain of a Raspberry Pi 5 mounted on a robot car. Your goal is to spend a short time (approx. 5-7 steps) exploring and mapping the room, then locate one of the corners of the room and park there.

The room boundaries are approximately X in [-3.6, 3.6] and Y in [-2.6, 2.6]. The four corners are at:
1. Bottom-Left: (-3.6, -2.6)
2. Bottom-Right: (3.6, -2.6)
3. Top-Left: (-3.6, 2.6)
4. Top-Right: (3.6, 2.6)

Instructions:
1. First, drive forward and steer to map out the nearest walls and obstacles (5-7 steps).
2. After exploring, choose one corner that is clear of obstacles and navigate toward it.
3. Once your position X is close to ±3.6 and Y is close to ±2.6, and your ultrasonic sensor reads a wall close by (distance < 45cm), stop the robot by setting left_motor = 0.0 and right_motor = 0.0. Remain parked there indefinitely.

Kinematics & Movement Guidelines to prevent spinning in circles:
- Drive forward: Set left_motor and right_motor to equal positive values (e.g., left_motor=0.5, right_motor=0.5).
- Turn: Set one motor speed higher than the other (e.g., left_motor=0.6, right_motor=0.2 to turn right, or left_motor=0.2, right_motor=0.6 to turn left).
- Do NOT spin in place indefinitely (e.g., left_motor=0.4, right_motor=-0.4). Spin in place for at most one step to adjust your angle, then drive forward.
- If you hit a wall or obstacle (distance < 30cm), reverse (e.g., left_motor=-0.4, right_motor=-0.4), turn away, and then drive forward.`
  },
  detective: {
    name: 'Change Detective',
    prompt: `You are an environmental scanner robot. Your primary mission is to detect if objects have been moved or if you are placed in a new room. Constantly cross-reference your current sensor inputs with your previous mental map coordinates. If a distance sensor reading is significantly different than your map coordinates suggest, flag an anomaly!

Kinematics Guidelines:
- Drive forward: Set left_motor and right_motor to equal positive values (e.g., 0.5, 0.5).
- Turn: Set one motor speed higher than the other (e.g., 0.5, 0.2).
- Do NOT spin in place indefinitely (e.g., 0.4, -0.4). Spin in place for at most one step to adjust your angle, then drive forward.`
  },
  courageous: {
    name: 'Fast Surveyor',
    prompt: `You are a fast-moving surveyor robot. You sweep the room in straight lines, mapping boundaries quickly. When encountering a wall, you spin 90 degrees and continue surveying.

Kinematics Guidelines:
- Drive forward in straight lines: Set left_motor and right_motor to equal positive values (e.g., 0.6, 0.6).
- When distance < 40cm, spin 90 degrees (e.g., left_motor=0.5, right_motor=-0.5 for a single step), then resume driving forward (e.g., 0.6, 0.6). Do not spin in circles.`
  },
  custom: {
    name: 'Custom Brain Script',
    prompt: 'You are a customizable hardware-simulated robot.'
  }
};

export default function OllamaConsole({
  endpoint,
  setEndpoint,
  selectedModel,
  setSelectedModel,
  personality,
  setPersonality,
  systemPrompt,
  setSystemPrompt,
  isConnected,
  setIsConnected,
  models,
  setModels,
  piLogs,
  clearPiLogs,
  mentalMap,
  setMentalMap,
  anomalyDetected,
  // Custom server settings
  brainProvider,
  setBrainProvider,
  customServerMode,
  setCustomServerMode,
  customEndpoint,
  setCustomEndpoint,
  lastJsonAction
}) {
  const [loadingModels, setLoadingModels] = useState(false);

  const handlePersonalityChange = (e) => {
    const key = e.target.value;
    setPersonality(key);
    setSystemPrompt(PERSONALITIES[key].prompt);
  };

  const refreshAI = async () => {
    setLoadingModels(true);
    try {
      if (brainProvider === 'ollama') {
        const connected = await ollamaService.checkConnection(endpoint);
        setIsConnected(connected);
        if (connected) {
          const fetched = await ollamaService.fetchModels(endpoint);
          setModels(fetched);
          if (fetched.length > 0 && !selectedModel) {
            setSelectedModel(fetched[0].name);
          }
        } else {
          setModels([]);
        }
      } else {
        // Custom Server on port 8000
        const connected = await ollamaService.checkCustomConnection(customEndpoint);
        setIsConnected(connected);
      }
    } catch (e) {
      setIsConnected(false);
      setModels([]);
    } finally {
      setLoadingModels(false);
    }
  };

  useEffect(() => {
    refreshAI();
  }, [endpoint, customEndpoint, brainProvider]);

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-700/50 rounded-xl overflow-hidden shadow-2xl backdrop-blur-md">
      {/* Top configuration panel */}
      <div className="p-3 bg-slate-950/70 border-b border-slate-800/80 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-300">
            <Cpu size={14} className="text-emerald-400" />
            <span>Raspberry Pi 5 OS Config</span>
          </div>

          <div className="flex items-center gap-2">
            {isConnected ? (
              <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 border border-emerald-900/60 rounded">
                <CheckCircle2 size={10} /> Ready
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] font-mono text-amber-500 bg-amber-950/40 px-2 py-0.5 border border-amber-900/60 rounded">
                <AlertTriangle size={10} /> Disconnected
              </span>
            )}
            
            <button
              onClick={refreshAI}
              disabled={loadingModels}
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
              title="Refresh models"
            >
              <RefreshCw size={12} className={loadingModels ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Brain Provider Selection */}
        <div className="space-y-1">
          <label className="text-[10px] font-mono text-slate-400">AI Brain Provider:</label>
          <select
            value={brainProvider}
            onChange={(e) => setBrainProvider(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs font-mono text-slate-200 focus:border-emerald-500 outline-none"
          >
            <option value="ollama">Local Ollama API (Default: Port 11434)</option>
            <option value="custom">Custom Local AI Server (Port 8000)</option>
          </select>
        </div>

        {/* Dynamic Host and parameters input */}
        {brainProvider === 'ollama' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400">Ollama API Host:</label>
              <input
                type="text"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 focus:border-emerald-500 outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-400">Model loaded on Pi 5:</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={!isConnected || models.length === 0}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 focus:border-emerald-500 outline-none disabled:opacity-50"
              >
                {models.length === 0 ? (
                  <option value="">No models found</option>
                ) : (
                  models.map(m => (
                    <option key={m.name} value={m.name}>
                      {m.name}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>
        ) : (
          // Custom Server Form
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400">AI Server Host:</label>
              <input
                type="text"
                value={customEndpoint}
                onChange={(e) => setCustomEndpoint(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 focus:border-emerald-500 outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-400">AI Inference Mode:</label>
              <div className="flex gap-1 bg-slate-900 p-0.5 border border-slate-700 rounded">
                <button
                  onClick={() => setCustomServerMode('command')}
                  className={`flex-grow flex items-center justify-center gap-1 py-1 rounded text-[10px] font-bold ${
                    customServerMode === 'command'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <MessageSquare size={10} /> /command
                </button>
                <button
                  onClick={() => setCustomServerMode('tandem')}
                  className={`flex-grow flex items-center justify-center gap-1 py-1 rounded text-[10px] font-bold ${
                    customServerMode === 'tandem'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Eye size={10} /> /pipeline/tandem
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CORS Troubleshooting instructions */}
        {!isConnected && (
          <div className="bg-amber-950/30 border border-amber-800/40 p-2.5 rounded text-[9px] font-mono text-amber-300 space-y-1">
            <div className="font-bold flex items-center gap-1">
              <AlertTriangle size={10} /> Local Connection Offline?
            </div>
            <div>
              {brainProvider === 'ollama' ? (
                'Enable CORS. Stop the Ollama App and run in Terminal: OLLAMA_ORIGINS="*" ollama serve'
              ) : (
                `Verify that your custom AI server is listening at ${customEndpoint} and that CORS headers are enabled to allow requests from http://localhost:5173.`
              )}
            </div>
          </div>
        )}
      </div>

      {/* System prompt / Personality Configurator */}
      <div className="p-3 bg-slate-950/30 border-b border-slate-800/80 space-y-2.5">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-slate-400">AI Prompt Guidelines:</span>
          <select
            value={personality}
            onChange={handlePersonalityChange}
            className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-slate-200 outline-none focus:border-emerald-500"
          >
            {Object.entries(PERSONALITIES).map(([key, val]) => (
              <option key={key} value={key}>
                {val.name}
              </option>
            ))}
          </select>
        </div>

        <textarea
          value={systemPrompt}
          onChange={(e) => {
            setSystemPrompt(e.target.value);
            setPersonality('custom');
          }}
          rows={2}
          className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-[10px] font-mono text-emerald-400 leading-normal outline-none focus:border-emerald-600 resize-none"
          placeholder="Enter custom prompt directives..."
        />
      </div>

      {/* Renders returned JSON action blocks (For custom server response tracking) */}
      {brainProvider === 'custom' && (
        <div className="p-3 bg-slate-950/20 border-b border-slate-800/80 flex flex-col gap-1.5 text-xs font-mono">
          <span className="text-slate-400">Latest Action JSON (from Server):</span>
          <div className="bg-slate-950 p-2 rounded border border-slate-800 text-[10px] text-cyan-400 font-mono min-h-[40px] whitespace-pre">
            {lastJsonAction ? JSON.stringify(lastJsonAction, null, 2) : 'No JSON packets received yet. Switch to custom C++ sketch template.'}
          </div>
        </div>
      )}

      {/* Mental Map Display (Ollama and Custom Stateful modes) */}
      {(brainProvider === 'ollama' || brainProvider === 'custom') && (
        <div className="p-3 bg-slate-950/20 border-b border-slate-800/80 flex flex-col gap-1.5 text-xs font-mono">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">AI's Mental Mapping Grid:</span>
            {anomalyDetected && (
              <span className="text-[9px] font-bold text-rose-400 bg-rose-950/50 px-2 py-0.5 border border-rose-800 rounded animate-pulse">
                ⚠️ ANOMALY / MOVEMENT DETECTED
              </span>
            )}
          </div>
          <div className="bg-slate-950 p-2.5 rounded border border-slate-800 text-[10px] text-slate-300 font-bold min-h-[50px] whitespace-pre-wrap">
            {mentalMap || 'No mapping data built. Start the simulator and AI Mode to let Ollama build coordinates.'}
          </div>
        </div>
      )}

      {/* Pi logs terminal */}
      <div className="flex-grow flex flex-col bg-slate-950 min-h-[120px]">
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/60 border-b border-slate-850">
          <div className="flex items-center gap-1.5">
            <Terminal size={12} className="text-slate-400" />
            <span className="text-[10px] font-mono font-bold text-slate-300">Raspberry Pi 5 System Log</span>
          </div>
          <button
            onClick={clearPiLogs}
            className="text-[9px] font-mono text-slate-500 hover:text-slate-300 bg-slate-950 px-2 py-0.5 border border-slate-800 rounded transition-all"
          >
            Clear Log
          </button>
        </div>

        <div className="flex-grow p-3 overflow-y-auto font-mono text-[9px] text-emerald-400 space-y-1 select-text">
          {piLogs.length === 0 ? (
            <div className="text-slate-600 italic">Waiting for Pi 5 boot sequence... Wiring USB link and starting simulation runs the Python AI loops.</div>
          ) : (
            piLogs.map((log, idx) => (
              <div key={idx} className="whitespace-pre-wrap leading-tight border-b border-slate-900/30 pb-0.5">
                {log}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
