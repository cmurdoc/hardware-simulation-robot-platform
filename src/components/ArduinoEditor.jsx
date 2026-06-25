import React, { useState, useEffect } from 'react';
import { Download, Code, Play, RefreshCw, Terminal } from 'lucide-react';

const TEMPLATES = {
  aiMode: {
    name: '1. AI-Brain Serial Passthrough (Ollama Mode)',
    desc: 'Bridges distance sensor values to the Pi 5 over Serial, and receives motor power instructions from the Pi 5 AI.',
    code: `// --- Pins mapping (matches simulation wiring) ---
const int trigPin = 12;
const int echoPin = 11;

const int enA = 3;
const int in1 = 5;
const int in2 = 6;
const int in3 = 7;
const int in4 = 8;
const int enB = 9;

void setup() {
  // Start Serial connection to Raspberry Pi 5
  Serial.begin(9650);
  
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  
  pinMode(enA, OUTPUT);
  pinMode(in1, OUTPUT);
  pinMode(in2, OUTPUT);
  pinMode(in3, OUTPUT);
  pinMode(in4, OUTPUT);
  pinMode(enB, OUTPUT);
  
  // Set initial state
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
  
  // 2. Stream telemetry to Pi 5 over serial
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
  
  // 4. Listen for motor speed updates from Pi 5
  // Commands are sent in format: L:<speed>,R:<speed> \n (e.g. "L:0.65,R:-0.30")
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    
    if (cmd.startsWith("L:") && cmd.indexOf(",R:") > 0) {
      int commaIndex = cmd.indexOf(",R:");
      float leftSpeed = cmd.substring(2, commaIndex).toFloat();
      float rightSpeed = cmd.substring(commaIndex + 3).toFloat();
      
      driveMotors(leftSpeed, rightSpeed);
    }
  }
  
  // Refresh loop rate (100ms)
  delay(100);
}

void driveMotors(float left, float right) {
  // Left Motor control
  if (left >= 0) {
    digitalWrite(in1, HIGH);
    digitalWrite(in2, LOW);
  } else {
    digitalWrite(in1, LOW);
    digitalWrite(in2, HIGH);
  }
  
  // Right Motor control
  if (right >= 0) {
    digitalWrite(in3, HIGH);
    digitalWrite(in4, LOW);
  } else {
    digitalWrite(in3, LOW);
    digitalWrite(in4, HIGH);
  }
  
  // Apply PWM speeds (0 to 255)
  analogWrite(enA, abs(left) * 255);
  analogWrite(enB, abs(right) * 255);
}
`
  },
  autonomous: {
    name: '2. Autonomous Obstacle Avoidance (Pure Arduino)',
    desc: 'Runs completely on the Arduino board without needing a Pi 5 or Ollama. Navigates using local logic rules.',
    code: `// --- Pins mapping (matches simulation wiring) ---
const int trigPin = 12;
const int echoPin = 11;

const int enA = 3;
const int in1 = 5;
const int in2 = 6;
const int in3 = 7;
const int in4 = 8;
const int enB = 9;

void setup() {
  Serial.begin(9650);
  
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  
  pinMode(enA, OUTPUT);
  pinMode(in1, OUTPUT);
  pinMode(in2, OUTPUT);
  pinMode(in3, OUTPUT);
  pinMode(in4, OUTPUT);
  pinMode(enB, OUTPUT);
}

void loop() {
  // 1. Read sensor distance
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  
  long duration = pulseIn(echoPin, HIGH);
  int distance = duration * 0.034 / 2;
  
  Serial.print("Autonomous mode sensor distance: ");
  Serial.println(distance);
  
  // 2. Navigation Decision Rule Tree
  if (distance > 0 && distance < 35) {
    // Obstacle detected! Back up slightly then spin turn
    Serial.println("Obstacle close! Backing up...");
    driveMotors(-0.4, -0.4);
    delay(400);
    
    Serial.println("Turning right to avoid obstacle...");
    driveMotors(0.5, -0.5);
    delay(600);
  } else {
    // Path clear, drive forward smoothly
    driveMotors(0.6, 0.6);
  }
  
  delay(50);
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
`
  },
  manual: {
    name: '3. Keyboard Serial Commander',
    desc: 'Accepts manual command characters via serial inputs: W (forward), S (back), A (left), D (right), X (stop).',
    code: `const int enA = 3;
const int in1 = 5;
const int in2 = 6;
const int in3 = 7;
const int in4 = 8;
const int enB = 9;

void setup() {
  Serial.begin(9650);
  
  pinMode(enA, OUTPUT);
  pinMode(in1, OUTPUT);
  pinMode(in2, OUTPUT);
  pinMode(in3, OUTPUT);
  pinMode(in4, OUTPUT);
  pinMode(enB, OUTPUT);
  
  Serial.println("Manual Serial Commander Initialized.");
  Serial.println("Send commands: w (forward), s (back), a (left), d (right), x (stop)");
  
  driveMotors(0, 0);
}

void loop() {
  if (Serial.available() > 0) {
    char c = Serial.read();
    
    if (c == 'w') {
      Serial.println("Drive: Forward");
      driveMotors(0.7, 0.7);
    } 
    else if (c == 's') {
      Serial.println("Drive: Backward");
      driveMotors(-0.7, -0.7);
    } 
    else if (c == 'a') {
      Serial.println("Drive: Pivot Left");
      driveMotors(-0.6, 0.6);
    } 
    else if (c == 'd') {
      Serial.println("Drive: Pivot Right");
      driveMotors(0.6, -0.6);
    } 
    else if (c == 'x') {
      Serial.println("Drive: STOP");
      driveMotors(0, 0);
    }
  }
  delay(20);
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
`
  },
  customServerJson: {
    name: '4. Custom AI Server Serial Handler (JSON Parser)',
    desc: 'Reads raw JSON action strings (e.g. {"action":"DRIVE","params":{"left":0.8,"right":0.8}}) and drives motor inputs.',
    code: `// --- Pins mapping (matches simulation wiring) ---
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
  // 1. Send distance telemetry stream
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  
  long duration = pulseIn(echoPin, HIGH);
  int distance = duration * 0.034 / 2;
  
  Serial.print("D:");
  Serial.println(distance);
  
  // 2. Autonomous Safety Override / Failsafe
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
  
  // 3. Parse incoming JSON actions from serial port
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\\n');
    cmd.trim();
    
    // Quick string scans to isolate action instructions
    if (cmd.indexOf("\\"action\\":\\"DRIVE\\"") >= 0 || cmd.indexOf("\\"action\\": \\"DRIVE\\"") >= 0) {
      int leftIdx = cmd.indexOf("\\"left\\":");
      int rightIdx = cmd.indexOf("\\"right\\":");
      
      if (leftIdx > 0 && rightIdx > 0) {
        int leftEnd = cmd.indexOf(",", leftIdx);
        int rightEnd = cmd.indexOf("}", rightIdx);
        
        float leftSpeed = cmd.substring(leftIdx + 7, leftEnd).toFloat();
        float rightSpeed = cmd.substring(rightIdx + 8, rightEnd).toFloat();
        
        driveMotors(leftSpeed, rightSpeed);
      }
    }
    else if (cmd.indexOf("\\"action\\":\\"LED_ON\\"") >= 0 || cmd.indexOf("\\"action\\": \\"LED_ON\\"") >= 0) {
      digitalWrite(onboardLed, HIGH);
      Serial.println("Action: LED pin 13 is HIGH");
    }
    else if (cmd.indexOf("\\"action\\":\\"LED_OFF\\"") >= 0 || cmd.indexOf("\\"action\\": \\"LED_OFF\\"") >= 0) {
      digitalWrite(onboardLed, LOW);
      Serial.println("Action: LED pin 13 is LOW");
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
`
  }
};

export default function ArduinoEditor({
  code,
  setCode,
  onUpload,
  serialLogs,
  clearLogs,
  sendSerialInput,
  isCompiling
}) {
  const [selectedTemplate, setSelectedTemplate] = useState('aiMode');
  const [manualInput, setManualInput] = useState('');

  const handleTemplateChange = (e) => {
    const key = e.target.value;
    setSelectedTemplate(key);
    setCode(TEMPLATES[key].code);
  };

  const handleExportCode = () => {
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedTemplate}_sketch.ino`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSendSerial = (e) => {
    e.preventDefault();
    if (manualInput.trim()) {
      sendSerialInput(manualInput + '\n');
      setManualInput('');
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-700/50 rounded-xl overflow-hidden shadow-2xl backdrop-blur-md">
      <div className="p-3 bg-slate-950/70 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-grow">
          <Code size={16} className="text-sky-400" />
          <select
            value={selectedTemplate}
            onChange={handleTemplateChange}
            className="bg-slate-900 border border-slate-700 text-xs font-mono rounded px-2.5 py-1.5 text-slate-200 outline-none focus:border-sky-500"
          >
            {Object.entries(TEMPLATES).map(([key, val]) => (
              <option key={key} value={key}>
                {val.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleExportCode}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-700 hover:bg-slate-800 text-xs font-mono text-slate-300 rounded transition-all shadow-md"
            title="Download code as .ino file"
          >
            <Download size={12} /> Export .ino
          </button>
          
          <button
            onClick={onUpload}
            disabled={isCompiling}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 rounded text-xs font-mono font-bold text-white shadow-md shadow-sky-500/20 transition-all hover:scale-105 active:scale-95"
          >
            {isCompiling ? (
              <RefreshCw size={12} className="animate-spin" />
            ) : (
              <Play size={12} />
            )}
            Compile & Upload
          </button>
        </div>
      </div>

      <div className="px-3 py-1.5 bg-slate-950/30 border-b border-slate-800/50 text-[10px] font-mono text-slate-400 leading-tight">
        {TEMPLATES[selectedTemplate].desc}
      </div>

      <div className="flex-grow relative min-h-[220px]">
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
          className="w-full h-full p-4 bg-slate-950 font-mono text-xs text-sky-300 outline-none resize-none leading-relaxed"
          placeholder="// Write your Arduino C++ code here..."
          style={{
            tabSize: 2,
            fontFamily: '"JetBrains Mono", Consolas, Monaco, monospace'
          }}
        />
      </div>

      <div className="h-[180px] bg-slate-950 border-t border-slate-800/80 flex flex-col">
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-850">
          <div className="flex items-center gap-1.5">
            <Terminal size={12} className="text-slate-400" />
            <span className="text-[10px] font-mono font-bold text-slate-300">Serial Monitor (9600 baud)</span>
          </div>
          <button
            onClick={clearLogs}
            className="text-[9px] font-mono text-slate-500 hover:text-slate-300 bg-slate-950 px-2 py-0.5 border border-slate-800 rounded transition-all"
          >
            Clear Output
          </button>
        </div>

        <div className="flex-grow p-3 overflow-y-auto font-mono text-[10px] text-cyan-400/90 space-y-0.5 select-text">
          {serialLogs.length === 0 ? (
            <div className="text-slate-600 italic">No serial traffic. Click "Compile & Upload" to start running code.</div>
          ) : (
            serialLogs.map((log, idx) => (
              <div key={idx} className="whitespace-pre-wrap leading-tight">
                {log}
              </div>
            ))
          )}
        </div>

        <form onSubmit={handleSendSerial} className="flex border-t border-slate-800/60 bg-slate-900/50 p-1.5">
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="Type serial commands here..."
            className="flex-grow bg-slate-950 text-[10px] font-mono text-cyan-300 outline-none px-2 py-1 rounded-l border border-slate-800 focus:border-slate-700"
          />
          <button
            type="submit"
            className="px-3 bg-slate-800 border-t border-r border-b border-slate-700 hover:bg-slate-700 text-[10px] font-mono text-slate-200 rounded-r transition-all"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
