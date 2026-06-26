import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Cpu, Code, MapPin, Activity, HelpCircle, ShieldAlert } from 'lucide-react';
import WiringCanvas from './components/WiringCanvas';
import SimulationArena3D from './components/SimulationArena3D';
import ArduinoEditor from './components/ArduinoEditor';
import OllamaConsole from './components/OllamaConsole';
import { robotPhysics } from './services/robotPhysics';
import { arduinoInterpreter } from './services/arduinoInterpreter';
import { ollamaService } from './services/ollamaService';

const DEFAULT_COMPONENTS = [
  { id: 'arduino', type: 'arduino', x: 40, y: 40 },
  { id: 'raspberrypi', type: 'raspberrypi', x: 340, y: 40 },
  { id: 'motorDriver', type: 'motorDriver', x: 40, y: 260 },
  { id: 'sensor', type: 'sensor', x: 260, y: 260 },
  { id: 'motorLeft', type: 'motorLeft', x: 470, y: 260 },
  { id: 'motorRight', type: 'motorRight', x: 470, y: 370 },
  { id: 'battery', type: 'battery', x: 280, y: 370 }
];

const DEFAULT_WIRES = [
  { id: 'wire_usb', fromComponent: 'arduino', fromPin: 'USB', toComponent: 'raspberrypi', toPin: 'USB_PORT', color: '#8b5cf6' },
  { id: 'wire_bat_pwr', fromComponent: 'battery', fromPin: '+', toComponent: 'motorDriver', toPin: 'VNS', color: '#ef4444' },
  { id: 'wire_bat_gnd', fromComponent: 'battery', fromPin: '-', toComponent: 'motorDriver', toPin: 'GND', color: '#000000' },
  { id: 'wire_ard_gnd', fromComponent: 'arduino', fromPin: 'GND', toComponent: 'motorDriver', toPin: '5V_OUT', color: '#000000' },
  { id: 'wire_sens_vcc', fromComponent: 'sensor', fromPin: 'VCC', toComponent: 'arduino', toPin: '5V', color: '#ef4444' },
  { id: 'wire_sens_trig', fromComponent: 'sensor', fromPin: 'TRIG', toComponent: 'arduino', toPin: 'D12', color: '#eab308' },
  { id: 'wire_sens_echo', fromComponent: 'sensor', fromPin: 'ECHO', toComponent: 'arduino', toPin: 'D11', color: '#3b82f6' },
  { id: 'wire_sens_gnd', fromComponent: 'sensor', fromPin: 'GND', toComponent: 'arduino', toPin: 'GND2', color: '#000000' },
  { id: 'wire_ena', fromComponent: 'motorDriver', fromPin: 'ENA', toComponent: 'arduino', toPin: 'D3', color: '#eab308' },
  { id: 'wire_in1', fromComponent: 'motorDriver', fromPin: 'IN1', toComponent: 'arduino', toPin: 'D5', color: '#3b82f6' },
  { id: 'wire_in2', fromComponent: 'motorDriver', fromPin: 'IN2', toComponent: 'arduino', toPin: 'D6', color: '#22c55e' },
  { id: 'wire_in3', fromComponent: 'motorDriver', fromPin: 'IN3', toComponent: 'arduino', toPin: 'D7', color: '#eab308' },
  { id: 'wire_in4', fromComponent: 'motorDriver', fromPin: 'IN4', toComponent: 'arduino', toPin: 'D8', color: '#3b82f6' },
  { id: 'wire_enb', fromComponent: 'motorDriver', fromPin: 'ENB', toComponent: 'arduino', toPin: 'D9', color: '#22c55e' },
  { id: 'wire_m_l1', fromComponent: 'motorDriver', fromPin: 'OUT1', toComponent: 'motorLeft', toPin: '+', color: '#ef4444' },
  { id: 'wire_m_l2', fromComponent: 'motorDriver', fromPin: 'OUT2', toComponent: 'motorLeft', toPin: '-', color: '#000000' },
  { id: 'wire_m_r1', fromComponent: 'motorDriver', fromPin: 'OUT3', toComponent: 'motorRight', toPin: '+', color: '#ef4444' },
  { id: 'wire_m_r2', fromComponent: 'motorDriver', fromPin: 'OUT4', toComponent: 'motorRight', toPin: '-', color: '#000000' }
];

const INITIAL_OBSTACLES = [
  { id: 'chair_1', type: 'chair', x: 2.0, z: 1.5, width: 0.8, depth: 0.8, height: 1.0, color: '#3b82f6' },
  { id: 'chair_2', type: 'chair', x: -2.2, z: -1.2, width: 0.8, depth: 0.8, height: 1.0, color: '#3b82f6' },
  { id: 'toy_1', type: 'toy', x: -1.0, z: 1.8, radius: 0.25, height: 0.4, color: '#a855f7' },
  { id: 'toy_2', type: 'toy', x: 1.5, z: -1.5, radius: 0.3, height: 0.5, color: '#ec4899' },
  { id: 'step_1', type: 'box', x: 0.0, z: 2.5, width: 2.0, depth: 0.6, height: 0.2, color: '#f59e0b' }
];

export default function App() {
  const [leftTab, setLeftTab] = useState('wiring');
  const [rightTab, setRightTab] = useState('arena');

  const [components, setComponents] = useState(DEFAULT_COMPONENTS);
  const [wires, setWires] = useState(DEFAULT_WIRES);

  const [robotState, setRobotState] = useState(robotPhysics.getInitialState(0, 0, 0));
  const [obstacles, setObstacles] = useState(INITIAL_OBSTACLES);
  const [simulationRunning, setSimulationRunning] = useState(false);

  const [arduinoCode, setArduinoCode] = useState('');
  const [serialLogs, setSerialLogs] = useState([]);
  const [isCompiling, setIsCompiling] = useState(false);
  const activeArduinoRunner = useRef(null);

  // AI config states
  const [ollamaEndpoint, setOllamaEndpoint] = useState('http://localhost:11434');
  const [selectedModel, setSelectedModel] = useState('');
  const [personality, setPersonality] = useState('explorer');
  const [systemPrompt, setSystemPrompt] = useState(
    `You are the AI brain of a Raspberry Pi 5 mounted on a robot car. You have two primary sensors:
1. A front-facing camera (sent as the image attachment).
2. An ultrasonic distance sensor (reads distance to objects directly in front of you).

Your goal is to explore the 3D room, identify obstacles, and construct a mental map of where walls and furniture are. You must navigate carefully, slow down when approaching obstacles, and map the room.

To move correctly, you must follow these Kinematics Rules:
- Drive forward: Set left_motor and right_motor to equal positive values (e.g. 0.5, 0.5).
- Turn left or right while driving forward: BOTH motors must be positive but make one higher than the other (e.g. left_motor=0.6, right_motor=0.2 to steer right, or left_motor=0.2, right_motor=0.6 to steer left). Never make one motor negative when steering.
- Spin in place (opposing signs, e.g. left_motor=-0.4, right_motor=0.4): Only do this for a single step to adjust heading if you are facing a wall. Never spin in place for consecutive steps, or you will get stuck in a circle.
- To reverse/backup, set both motors to negative values (e.g., -0.4, -0.4).

Look closely at the attached image (your camera view) and the ultrasonic distance reading:
- If the image shows a clear path ahead (grey grid floor and no obstacles close by) and distance > 100cm, drive forward (e.g., 0.5, 0.5). Do not spin or reverse when the path is clear!
- If you see a red obstacle cylinder or wall close ahead, steer left or right to avoid it.
- If distance is very small (< 40cm) or you hit a wall, reverse for one step (e.g. -0.4, -0.4), spin in place for one step to turn away, and then drive forward.`
  );
  const [isOllamaConnected, setIsOllamaConnected] = useState(false);
  const [ollamaModels, setOllamaModels] = useState([]);
  const [piLogs, setPiLogs] = useState([]);
  const [mentalMap, setMentalMap] = useState('');
  const [anomalyDetected, setAnomalyDetected] = useState(false);

  // Custom Local Server (Port 8000) states
  const [brainProvider, setBrainProvider] = useState('ollama'); // ollama vs custom
  const [customServerMode, setCustomServerMode] = useState('command'); // command vs tandem
  const [customEndpoint, setCustomEndpoint] = useState('http://localhost:8000');
  const [currentFrameBase64, setCurrentFrameBase64] = useState('');
  const [lastJsonAction, setLastJsonAction] = useState(null);

  const [isAiThinking, setIsAiThinking] = useState(false);
  const lastAiQueryTime = useRef(0);
  const aiActionHistory = useRef([]);

  // Buffer to accumulate fragmented serial data before line processing
  const serialRxBufferRef = useRef('');

  // REF STATE SYNC
  const stateRef = useRef({});
  useEffect(() => {
    stateRef.current = {
      components,
      wires,
      simulationRunning,
      ollamaEndpoint,
      selectedModel,
      systemPrompt,
      isOllamaConnected,
      mentalMap,
      brainProvider,
      customServerMode,
      customEndpoint,
      currentFrameBase64,
      robotState
    };
  });

  useEffect(() => {
    const defaultTemplate = `// --- Pins mapping (matches simulation wiring) ---
const int trigPin = 12;
const int echoPin = 11;

const int enA = 3;
const int in1 = 5;
const int in2 = 6;
const int in3 = 7;
const int in4 = 8;
const int enB = 9;

const int onboardLed = 13;

void setup() {
  Serial.begin(9650);
  
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  pinMode(onboardLed, OUTPUT);
  
  pinMode(enA, OUTPUT);
  pinMode(in1, OUTPUT);
  pinMode(in2, OUTPUT);
  pinMode(in3, OUTPUT);
  pinMode(in4, OUTPUT);
  pinMode(enB, OUTPUT);
  
  digitalWrite(onboardLed, LOW);
  driveMotors(0, 0);
}

void loop() {
  // 1. Measure distance using HC-SR04 sonar
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  
  long duration = pulseIn(echoPin, HIGH);
  int distance = duration * 0.034 / 2;
  
  // 2. Stream telemetry to serial (Pi 5 reads this)
  Serial.print("D:");
  Serial.println(distance);
  
  // 3. Autonomous Safety Override / Failsafe
  if (distance > 0 && distance < 30) {
    Serial.println("Warning: Obstacle detected! Safe override active.");
    driveMotors(-0.4, -0.4);
    delay(500);
    driveMotors(0.5, -0.5);
    delay(600);
    driveMotors(0.0, 0.0);
    while (Serial.available() > 0) {
      Serial.read();
    }
    Serial.println("Safe override complete. Resuming AI control.");
  }
  
  // 4. Listen for commands from Pi 5 (handles both protocols)
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\\n');
    cmd.trim();
    
    // Protocol A: Ollama Serial commands (format: L:power,R:power)
    if (cmd.startsWith("L:") && cmd.indexOf(",R:") > 0) {
      int commaIndex = cmd.indexOf(",R:");
      float leftSpeed = cmd.substring(2, commaIndex).toFloat();
      float rightSpeed = cmd.substring(commaIndex + 3).toFloat();
      driveMotors(leftSpeed, rightSpeed);
    }
    // Protocol B: Custom Server JSON Actions (format: {"action":"DRIVE","params":{"left":x,"right":y}})
    else if (cmd.indexOf("\\"action\\":\\"DRIVE\\"") >= 0 || cmd.indexOf("\\"action\\": \\"DRIVE\\"") >= 0 ||
             cmd.indexOf("\\"action\\":\\"MOVE\\"") >= 0 || cmd.indexOf("\\"action\\": \\"MOVE\\"") >= 0) {
      int leftIdx = cmd.indexOf("\\"left\\":");
      int rightIdx = cmd.indexOf("\\"right\\":");
      if (leftIdx > 0 && rightIdx > 0) {
        int leftEnd = cmd.indexOf(",", leftIdx);
        if (leftEnd < 0) leftEnd = cmd.indexOf("}", leftIdx);
        int rightEnd = cmd.indexOf(",", rightIdx);
        if (rightEnd < 0) rightEnd = cmd.indexOf("}", rightIdx);
        
        float leftSpeed = cmd.substring(leftIdx + 7, leftEnd).toFloat();
        float rightSpeed = cmd.substring(rightIdx + 8, rightEnd).toFloat();
        driveMotors(leftSpeed, rightSpeed);
      }
    }
    else if (cmd.indexOf("\\"action\\":\\"LED_ON\\"") >= 0 || cmd.indexOf("\\"action\\": \\"LED_ON\\"") >= 0) {
      digitalWrite(onboardLed, HIGH);
      Serial.println("Action: LED is ON");
    }
    else if (cmd.indexOf("\\"action\\":\\"LED_OFF\\"") >= 0 || cmd.indexOf("\\"action\\": \\"LED_OFF\\"") >= 0) {
      digitalWrite(onboardLed, LOW);
      Serial.println("Action: LED is OFF");
    }
  }
  
  delay(100);
}

void driveMotors(float left, float right) {
  if (left >= 0) {
    digitalWrite(in1, HIGH);
    digitalWrite(in2, LOW);
  } else {
    digitalWrite(in1, LOW);
    digitalWrite(in2, HIGH);
  }
  
  if (right >= 0) {
    digitalWrite(in3, HIGH);
    digitalWrite(in4, LOW);
  } else {
    digitalWrite(in3, LOW);
    digitalWrite(in4, HIGH);
  }
  
  analogWrite(enA, abs(left) * 255);
  analogWrite(enB, abs(right) * 255);
}
`;
    setArduinoCode(defaultTemplate);
  }, []);

  // Schematic Netlist solver to compute motor inputs
  const getRoutedSignal = (targetCompId, targetPinName, defaultValue = 0) => {
    const currentWires = stateRef.current.wires || [];
    const wire = currentWires.find(w => 
      (w.fromComponent === targetCompId && w.fromPin === targetPinName) ||
      (w.toComponent === targetCompId && w.toPin === targetPinName)
    );
    if (!wire) return defaultValue;

    const otherCompId = wire.fromComponent === targetCompId ? wire.toComponent : wire.fromComponent;
    const otherPinName = wire.fromComponent === targetCompId ? wire.toPin : wire.fromPin;

    if (otherCompId === 'arduino') {
      if (activeArduinoRunner.current) {
        const pinState = activeArduinoRunner.current.getPinState(otherPinName);
        return pinState ? pinState.value : defaultValue;
      }
    } else if (otherCompId === 'battery') {
      return otherPinName === '+' ? 255 : 0;
    }
    return defaultValue;
  };

  // Compile and upload Arduino Sketch
  const handleCompileAndUpload = () => {
    setIsCompiling(true);
    setSerialLogs(prev => [...prev, '--- Compiling Arduino Sketch C++ ---']);
    
    setTimeout(() => {
      if (activeArduinoRunner.current) {
        activeArduinoRunner.current.stop();
      }

      // Reset the lines buffer
      serialRxBufferRef.current = '';

      const translated = arduinoInterpreter.translate(arduinoCode);
      
      try {
        const runner = arduinoInterpreter.run(translated, {
          onPinWrite: (pin, val, isAnalog) => {},
          onSerialWrite: (dataString) => {
            // Log raw output
            setSerialLogs(prev => {
              const current = [...prev];
              if (current.length > 50) current.shift();
              return [...current, dataString.trim()];
            });

            // Line-buffering stream solver to handle fragmented Serial prints
            serialRxBufferRef.current += dataString;
            let lines = serialRxBufferRef.current.split('\n');
            serialRxBufferRef.current = lines.pop(); // Keep last fragment

            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith('D:')) {
                const distVal = parseFloat(trimmed.substring(2));
                if (!isNaN(distVal)) {
                  handlePiSerialReceive(distVal);
                }
              }
            }
          },
          getSensorDistance: () => {
            return stateRef.current.robotState.sensorDistance;
          },
          onError: (err) => {
            setSerialLogs(prev => [...prev, `⚠️ [Runtime Error] ${err}`]);
            setSimulationRunning(false);
          },
          onDebug: (msg) => {
            setSerialLogs(prev => [...prev, `[Debug] ${msg}`]);
          }
        });

        activeArduinoRunner.current = runner;
        setSerialLogs(prev => [...prev, '✅ Upload complete. Sketch running.']);
      } catch (err) {
        setSerialLogs(prev => [...prev, `❌ Compilation Failed: ${err.message}`]);
      }
      setIsCompiling(false);
    }, 800);
  };

  // Pi 5 Serial Listener (utilizes live stateRef variables)
  const handlePiSerialReceive = async (distance) => {
    const {
      components: curComps,
      wires: curWires,
      simulationRunning: isSimRunning,
      brainProvider: curProvider,
      isOllamaConnected: ollamaOk,
      ollamaEndpoint: curOllamaHost,
      selectedModel: curModel,
      systemPrompt: curPrompt,
      customServerMode: curMode,
      customEndpoint: curCustomHost,
      currentFrameBase64: curFrame,
      robotState: curRobotState,
      mentalMap: curMentalMap
    } = stateRef.current;

    const hasPi = curComps.some(c => c.type === 'raspberrypi');
    const hasUSB = curWires.some(w => 
      (w.fromComponent === 'arduino' && w.fromPin === 'USB' && w.toComponent === 'raspberrypi' && w.toPin === 'USB_PORT') ||
      (w.toComponent === 'arduino' && w.toPin === 'USB' && w.fromComponent === 'raspberrypi' && w.fromPin === 'USB_PORT')
    );

    if (!hasPi || !hasUSB || !isSimRunning) return;

    const now = Date.now();
    if (now - lastAiQueryTime.current > 1500 && !isAiThinking) {
      lastAiQueryTime.current = now;

      // Only abort if provider is standard Ollama and not connected
      if (curProvider === 'ollama' && !ollamaOk) {
        setPiLogs(prev => [
          ...prev,
          `⚠️ [Pi OS Alert] Disconnected from local Ollama host.`
        ]);
        return;
      }

      setIsAiThinking(true);

      const sensorsPayload = {
        distance,
        x: curRobotState.x,
        y: curRobotState.z,
        collided: curRobotState.collided
      };

      try {
        if (curProvider === 'ollama') {
          // Standard Ollama API query
          setPiLogs(prev => [...prev, `[Pi OS] Querying Ollama: distance = ${distance}cm.`]);
          const result = await ollamaService.queryAI(
            curOllamaHost,
            curModel,
            curPrompt,
            aiActionHistory.current,
            { ...sensorsPayload, angle: (curRobotState.angle * 180) / Math.PI },
            curMentalMap,
            curFrame
          );

          setMentalMap(typeof result.mental_map === 'object' ? JSON.stringify(result.mental_map, null, 2) : (result.mental_map || ''));
          setAnomalyDetected(result.anomaly_detected);

          setPiLogs(prev => [
            ...prev,
            `[Ollama Thought] "${result.thought}"`,
            `[Serial Tx] L:${result.left_motor.toFixed(2)},R:${result.right_motor.toFixed(2)}`
          ]);

          if (activeArduinoRunner.current) {
            activeArduinoRunner.current.sendSerial(`L:${result.left_motor.toFixed(2)},R:${result.right_motor.toFixed(2)}\n`);
          }

          aiActionHistory.current.push({
            distance,
            left: result.left_motor,
            right: result.right_motor,
            thought: result.thought
          });
          if (aiActionHistory.current.length > 5) aiActionHistory.current.shift();

        } else {
          // Custom local AI server query (Port 8000)
          let resultJSON;
          if (curMode === 'command') {
            setPiLogs(prev => [...prev, `[Pi OS] POSTing to Custom Server /command...`]);
            const prompt = `Distance = ${distance}cm, Position X=${curRobotState.x.toFixed(2)}, Z=${curRobotState.z.toFixed(2)}, Collided=${curRobotState.collided}. System prompt guidelines: "${curPrompt}"`;
            resultJSON = await ollamaService.queryCustomCommand(curCustomHost, prompt, sensorsPayload, aiActionHistory.current, curMentalMap);
          } else {
            setPiLogs(prev => [...prev, `[Pi OS] POSTing to Custom Server /pipeline/tandem with camera frame...`]);
            const prompt = `Sensors: distance=${distance}cm. Guidelines: "${curPrompt}"`;
            resultJSON = await ollamaService.queryCustomTandem(curCustomHost, curFrame, prompt, sensorsPayload, aiActionHistory.current, curMentalMap);
          }

          setLastJsonAction(resultJSON);

          const actionObject = (resultJSON && resultJSON.action && typeof resultJSON.action === 'object')
            ? resultJSON.action
            : ((resultJSON && resultJSON.command && typeof resultJSON.command === 'object')
              ? resultJSON.command
              : resultJSON);

          // Update mental map & anomaly state if returned by Custom Server
          if (resultJSON) {
            if (resultJSON.mental_map) {
              setMentalMap(typeof resultJSON.mental_map === 'object' ? JSON.stringify(resultJSON.mental_map, null, 2) : (resultJSON.mental_map || ''));
            }
            if (resultJSON.anomaly_detected !== undefined) {
              setAnomalyDetected(resultJSON.anomaly_detected);
            }
          }

          setPiLogs(prev => [
            ...prev,
            `[Server Thought] "${resultJSON?.thought || 'Exploring.'}"`,
            `[Server Action] ${actionObject?.action || 'UNKNOWN'}`,
            `[Serial Tx] ${JSON.stringify(actionObject)}`
          ]);

          if (activeArduinoRunner.current && actionObject) {
            activeArduinoRunner.current.sendSerial(JSON.stringify(actionObject) + '\n');
          }

          let leftVal = 0;
          let rightVal = 0;
          if (actionObject && actionObject.params) {
            leftVal = actionObject.params.left || 0;
            rightVal = actionObject.params.right || 0;
          }
          aiActionHistory.current.push({
            distance,
            left: leftVal,
            right: rightVal,
            thought: resultJSON?.thought || (actionObject?.action || 'Exploring')
          });
          if (aiActionHistory.current.length > 5) aiActionHistory.current.shift();
        }
      } catch (err) {
        setPiLogs(prev => [...prev, `❌ [Pi OS Error] AI query failed: ${err.message}`]);
      } finally {
        setIsAiThinking(false);
      }
    }
  };

  // 60FPS physics loop
  useEffect(() => {
    let animId;
    let lastTime = performance.now();

    const tick = () => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      if (simulationRunning) {
        const hasDriver = components.some(c => c.type === 'motorDriver');
        const driverGND = getRoutedSignal('motorDriver', 'GND', -1);
        const driverVNS = getRoutedSignal('motorDriver', 'VNS', -1);
        
        let leftMotorPower = 0;
        let rightMotorPower = 0;

        if (hasDriver && driverVNS > 0 && driverGND === 0) {
          const in1 = getRoutedSignal('motorDriver', 'IN1', 0);
          const in2 = getRoutedSignal('motorDriver', 'IN2', 0);
          const in3 = getRoutedSignal('motorDriver', 'IN3', 0);
          const in4 = getRoutedSignal('motorDriver', 'IN4', 0);
          const ena = getRoutedSignal('motorDriver', 'ENA', 0);
          const enb = getRoutedSignal('motorDriver', 'ENB', 0);

          let leftDir = 0;
          if (in1 > 0 && in2 === 0) leftDir = 1;
          else if (in1 === 0 && in2 > 0) leftDir = -1;

          let rightDir = 0;
          if (in3 > 0 && in4 === 0) rightDir = 1;
          else if (in3 === 0 && in4 > 0) rightDir = -1;

          leftMotorPower = leftDir * (ena / 255);
          rightMotorPower = rightDir * (enb / 255);
        }

        const hasPi = components.some(c => c.type === 'raspberrypi');
        const hasUSB = wires.some(w => 
          (w.fromComponent === 'arduino' && w.fromPin === 'USB' && w.toComponent === 'raspberrypi' && w.toPin === 'USB_PORT') ||
          (w.toComponent === 'arduino' && w.toPin === 'USB' && w.fromComponent === 'raspberrypi' && w.fromPin === 'USB_PORT')
        );
        const isAiActive = hasPi && hasUSB;
        const speedScale = isAiActive ? 0.12 : 1.0;
        const dtScaled = dt * speedScale;

        setRobotState(prev => 
          robotPhysics.tick(prev, leftMotorPower, rightMotorPower, obstacles, 8.0, 6.0, dtScaled)
        );
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [simulationRunning, wires, components, obstacles]);

  useEffect(() => {
    return () => {
      if (activeArduinoRunner.current) {
        activeArduinoRunner.current.stop();
      }
    };
  }, []);

  return (
    <div className="flex flex-col h-screen bg-slate-950 font-sans text-slate-100 overflow-hidden">
      {/* Top Header */}
      <header className="flex flex-wrap items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800 shadow-lg z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center shadow-md shadow-sky-500/20 text-white font-bold text-sm">
            🤖
          </div>
          <div>
            <h1 className="text-sm font-mono font-bold tracking-tight text-white">RoboSim: AI Hardware Prototyping Platform</h1>
            <p className="text-[10px] font-mono text-slate-400">Tinkercad-style board layout & local Ollama 3D simulator</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const nextRunning = !simulationRunning;
              if (nextRunning) {
                if (!activeArduinoRunner.current) {
                  handleCompileAndUpload();
                }
              } else {
                if (activeArduinoRunner.current) {
                  activeArduinoRunner.current.stop();
                  activeArduinoRunner.current = null;
                }
              }
              setSimulationRunning(nextRunning);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-bold shadow-md transition-all hover:scale-105 active:scale-95 ${
              simulationRunning
                ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-500/20'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'
            }`}
          >
            {simulationRunning ? <><Pause size={14} /> Pause Simulation</> : <><Play size={14} /> Run Simulation</>}
          </button>

          <button
            onClick={() => {
              setSimulationRunning(false);
              setRobotState(robotPhysics.getInitialState(0, 0, 0));
              setSerialLogs([]);
              setPiLogs([]);
              setMentalMap('');
              setAnomalyDetected(false);
              setLastJsonAction(null);
              aiActionHistory.current = [];
              if (activeArduinoRunner.current) {
                activeArduinoRunner.current.stop();
                activeArduinoRunner.current = null;
              }
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 rounded-lg text-xs font-mono text-slate-300 transition-all hover:text-white"
          >
            <RotateCcw size={13} /> Reset
          </button>
        </div>
      </header>

      {/* Main dashboard splitscreen */}
      <div className="flex-grow flex overflow-hidden">
        {/* Left Side: Layout Wiring / Arduino Editor / Pi config */}
        <div className="w-1/2 flex flex-col border-r border-slate-800">
          <div className="flex bg-slate-900 border-b border-slate-800">
            <button
              onClick={() => setLeftTab('wiring')}
              className={`flex items-center gap-1.5 px-6 py-3 border-b-2 font-mono text-xs font-bold transition-all ${
                leftTab === 'wiring'
                  ? 'border-sky-500 text-sky-400 bg-sky-950/20'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              <Cpu size={14} /> 1. Circuit Design
            </button>
            <button
              onClick={() => setLeftTab('code')}
              className={`flex items-center gap-1.5 px-6 py-3 border-b-2 font-mono text-xs font-bold transition-all ${
                leftTab === 'code'
                  ? 'border-sky-500 text-sky-400 bg-sky-950/20'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              <Code size={14} /> 2. Arduino IDE
            </button>
            <button
              onClick={() => setLeftTab('pi')}
              className={`flex items-center gap-1.5 px-6 py-3 border-b-2 font-mono text-xs font-bold transition-all ${
                leftTab === 'pi'
                  ? 'border-emerald-500 text-emerald-400 bg-emerald-950/20'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              <Cpu size={14} /> 3. Pi 5 AI Brain
            </button>
          </div>

          <div className="flex-grow p-4 overflow-hidden relative">
            {leftTab === 'wiring' && (
              <WiringCanvas
                components={components}
                setComponents={setComponents}
                wires={wires}
                setWires={setWires}
              />
            )}
            {leftTab === 'code' && (
              <ArduinoEditor
                code={arduinoCode}
                setCode={setArduinoCode}
                onUpload={handleCompileAndUpload}
                serialLogs={serialLogs}
                clearLogs={() => setSerialLogs([])}
                sendSerialInput={(cmd) => {
                  if (activeArduinoRunner.current) activeArduinoRunner.current.sendSerial(cmd);
                }}
                isCompiling={isCompiling}
              />
            )}
            {leftTab === 'pi' && (
              <OllamaConsole
                endpoint={ollamaEndpoint}
                setEndpoint={setOllamaEndpoint}
                selectedModel={selectedModel}
                setSelectedModel={setSelectedModel}
                personality={personality}
                setPersonality={setPersonality}
                systemPrompt={systemPrompt}
                setSystemPrompt={setSystemPrompt}
                isConnected={isOllamaConnected}
                setIsConnected={setIsOllamaConnected}
                models={ollamaModels}
                setModels={setOllamaModels}
                piLogs={piLogs}
                clearPiLogs={() => setPiLogs([])}
                mentalMap={mentalMap}
                setMentalMap={setMentalMap}
                anomalyDetected={anomalyDetected}
                brainProvider={brainProvider}
                setBrainProvider={setBrainProvider}
                customServerMode={customServerMode}
                setCustomServerMode={setCustomServerMode}
                customEndpoint={customEndpoint}
                setCustomEndpoint={setCustomEndpoint}
                lastJsonAction={lastJsonAction}
              />
            )}
          </div>
        </div>

        {/* Right Side: 3D Arena / Telemetry */}
        <div className="w-1/2 flex flex-col">
          <div className="flex bg-slate-900 border-b border-slate-800">
            <button
              onClick={() => setRightTab('arena')}
              className={`flex items-center gap-1.5 px-6 py-3 border-b-2 font-mono text-xs font-bold transition-all ${
                rightTab === 'arena'
                  ? 'border-sky-500 text-sky-400 bg-sky-950/20'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              <MapPin size={14} /> 3D Room Simulation
            </button>
            <button
              onClick={() => setRightTab('telemetry')}
              className={`flex items-center gap-1.5 px-6 py-3 border-b-2 font-mono text-xs font-bold transition-all ${
                rightTab === 'telemetry'
                  ? 'border-sky-500 text-sky-400 bg-sky-950/20'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              <Activity size={14} /> Telemetry
            </button>
          </div>

          <div className="flex-grow p-4 overflow-hidden relative flex flex-col">
            {rightTab === 'arena' && (
              <SimulationArena3D
                robotState={robotState}
                setRobotState={setRobotState}
                obstacles={obstacles}
                setObstacles={setObstacles}
                isRunning={simulationRunning}
                onFrameCapture={setCurrentFrameBase64}
                mentalMap={mentalMap}
              />
            )}
            
            {rightTab === 'telemetry' && (
              <div className="flex-grow p-6 bg-slate-900 border border-slate-700/50 rounded-xl flex flex-col justify-start gap-6 overflow-y-auto">
                <h3 className="text-sm font-mono font-bold text-sky-400">Simulation Real-time Telemetry</h3>
                
                <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                  <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block mb-1">Estimated Speed (Linear)</span>
                    <span className="text-lg font-bold text-white">
                      {((robotState.leftSpeed + robotState.rightSpeed) / 2.0).toFixed(2)} m/s
                    </span>
                  </div>
                  
                  <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block mb-1">Rotational Velocity</span>
                    <span className="text-lg font-bold text-white">
                      {((robotState.rightSpeed - robotState.leftSpeed) / 0.4).toFixed(2)} rad/s
                    </span>
                  </div>

                  <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block mb-1">Wheel Speeds (L / R)</span>
                    <span className="text-sm text-white">
                      Left: {robotState.leftSpeed.toFixed(2)} m/s | Right: {robotState.rightSpeed.toFixed(2)} m/s
                    </span>
                  </div>

                  <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block mb-1">Camera Vision Mode</span>
                    <span className="text-sm text-white uppercase text-emerald-400 font-bold">
                      {brainProvider === 'custom' && customServerMode === 'tandem' ? '🔴 Live WebGL Stream' : '⚪ Text Only'}
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-slate-950 rounded-lg border border-emerald-900/40 relative flex flex-col gap-2">
                  <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1.5">
                    <Cpu size={12} /> Target Server Link:
                  </span>
                  
                  {isAiThinking ? (
                    <div className="text-xs font-mono text-emerald-500/80 animate-pulse blink-cursor">
                      AI is compiling decision payload...
                    </div>
                  ) : (
                    <div className="text-xs font-mono text-slate-200 italic leading-relaxed">
                      {brainProvider === 'custom' 
                        ? (lastJsonAction ? `Executing server action: ${lastJsonAction.action}` : 'Waiting for JSON action commands from host server...')
                        : `"${aiActionHistory.current.length > 0 
                            ? aiActionHistory.current[aiActionHistory.current.length - 1].thought 
                            : 'Waiting for Ollama decision cycles...'}"`
                      }
                    </div>
                  )}
                </div>

                {brainProvider === 'custom' && customServerMode === 'tandem' && currentFrameBase64 && (
                  <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 flex flex-col gap-2">
                    <span className="text-xs font-mono text-slate-400">WebGL Frame Payload Buffer:</span>
                    <img
                      src={currentFrameBase64}
                      alt="WebGL Buffer"
                      className="w-[120px] h-[90px] border border-slate-800 rounded bg-black"
                    />
                  </div>
                )}

                <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 flex items-start gap-3">
                  <ShieldAlert size={18} className="text-sky-500 mt-0.5" />
                  <div className="text-xs font-mono space-y-1">
                    <div className="font-bold text-slate-200">Hardware Controller Mode</div>
                    <div className="text-slate-400 leading-normal">
                      Arduino routes telemetry values to the Pi 5. If Custom Server mode is active, the Pi queries port 8000 and returns JSON-RPC action packets directly to the C++ parser.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
