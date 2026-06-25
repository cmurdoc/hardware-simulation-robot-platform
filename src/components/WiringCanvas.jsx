import React, { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, HelpCircle, AlertCircle, CheckCircle2 } from 'lucide-react';

// Pin definitions with local coordinates relative to component dimensions
const COMPONENT_SCHEMATICS = {
  arduino: {
    name: 'Arduino Uno R4',
    width: 260,
    height: 180,
    color: 'bg-sky-950/90 border-sky-500/80',
    titleColor: 'text-sky-400',
    pins: [
      // Top pins (Digital)
      { name: 'D13', x: 240, y: 15, type: 'digital' },
      { name: 'D12', x: 220, y: 15, type: 'digital' },
      { name: 'D11', x: 200, y: 15, type: 'digital' },
      { name: 'D10', x: 180, y: 15, type: 'digital' },
      { name: 'D9', x: 160, y: 15, type: 'digital' },
      { name: 'D8', x: 140, y: 15, type: 'digital' },
      { name: 'D7', x: 120, y: 15, type: 'digital' },
      { name: 'D6', x: 100, y: 15, type: 'digital' },
      { name: 'D5', x: 80, y: 15, type: 'digital' },
      { name: 'D3', x: 60, y: 15, type: 'digital' },
      { name: 'GND', x: 40, y: 15, type: 'power' },
      // Bottom pins (Power / Analog)
      { name: '5V', x: 40, y: 165, type: 'power' },
      { name: '3.3V', x: 60, y: 165, type: 'power' },
      { name: 'GND2', x: 80, y: 165, type: 'power' },
      { name: 'A0', x: 140, y: 165, type: 'analog' },
      { name: 'A1', x: 160, y: 165, type: 'analog' },
      { name: 'A2', x: 180, y: 165, type: 'analog' },
      // USB port
      { name: 'USB', x: 15, y: 90, type: 'usb' }
    ]
  },
  raspberrypi: {
    name: 'Raspberry Pi 5',
    width: 280,
    height: 190,
    color: 'bg-emerald-950/90 border-emerald-500/80',
    titleColor: 'text-emerald-400',
    pins: [
      // 40-pin header simplified
      { name: '5V', x: 260, y: 30, type: 'power' },
      { name: 'GND', x: 260, y: 55, type: 'power' },
      { name: 'GPIO2', x: 260, y: 80, type: 'gpio' },
      { name: 'GPIO3', x: 260, y: 105, type: 'gpio' },
      { name: 'GPIO4', x: 260, y: 130, type: 'gpio' },
      { name: 'GPIO17', x: 260, y: 155, type: 'gpio' },
      // USB port for connection to Arduino
      { name: 'USB_PORT', x: 20, y: 95, type: 'usb' }
    ]
  },
  motorDriver: {
    name: 'L298N Motor Driver',
    width: 200,
    height: 160,
    color: 'bg-red-950/95 border-red-500/80',
    titleColor: 'text-red-400',
    pins: [
      // Inputs
      { name: 'ENA', x: 25, y: 145, type: 'signal' },
      { name: 'IN1', x: 50, y: 145, type: 'signal' },
      { name: 'IN2', x: 75, y: 145, type: 'signal' },
      { name: 'IN3', x: 100, y: 145, type: 'signal' },
      { name: 'IN4', x: 125, y: 145, type: 'signal' },
      { name: 'ENB', x: 150, y: 145, type: 'signal' },
      // Power terminal block
      { name: 'VNS', x: 25, y: 15, type: 'power' },
      { name: 'GND', x: 50, y: 15, type: 'power' },
      { name: '5V_OUT', x: 75, y: 15, type: 'power' },
      // Output terminal blocks (motors)
      { name: 'OUT1', x: 185, y: 40, type: 'motor' },
      { name: 'OUT2', x: 185, y: 65, type: 'motor' },
      { name: 'OUT3', x: 185, y: 95, type: 'motor' },
      { name: 'OUT4', x: 185, y: 120, type: 'motor' }
    ]
  },
  sensor: {
    name: 'HC-SR04 Sonar Sensor',
    width: 180,
    height: 80,
    color: 'bg-slate-900/95 border-indigo-500/80',
    titleColor: 'text-indigo-400',
    pins: [
      { name: 'VCC', x: 45, y: 65, type: 'power' },
      { name: 'TRIG', x: 75, y: 65, type: 'signal' },
      { name: 'ECHO', x: 105, y: 65, type: 'signal' },
      { name: 'GND', x: 135, y: 65, type: 'power' }
    ]
  },
  motorLeft: {
    name: 'DC Motor (Left)',
    width: 140,
    height: 90,
    color: 'bg-slate-950/90 border-slate-600/80',
    titleColor: 'text-slate-300',
    pins: [
      { name: '+', x: 15, y: 35, type: 'motor' },
      { name: '-', x: 15, y: 55, type: 'motor' }
    ]
  },
  motorRight: {
    name: 'DC Motor (Right)',
    width: 140,
    height: 90,
    color: 'bg-slate-950/90 border-slate-600/80',
    titleColor: 'text-slate-300',
    pins: [
      { name: '+', x: 15, y: 35, type: 'motor' },
      { name: '-', x: 15, y: 55, type: 'motor' }
    ]
  },
  battery: {
    name: '9V Battery Pack',
    width: 130,
    height: 140,
    color: 'bg-neutral-900 border-neutral-600',
    titleColor: 'text-neutral-300',
    pins: [
      { name: '+', x: 40, y: 15, type: 'power' },
      { name: '-', x: 90, y: 15, type: 'power' }
    ]
  }
};

export default function WiringCanvas({
  components,
  setComponents,
  wires,
  setWires
}) {
  const [activeWire, setActiveWire] = useState(null);
  const [wireColor, setWireColor] = useState('#ef4444'); // Red default
  const [draggingCompId, setDraggingCompId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [selectedWireId, setSelectedWireId] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const canvasRef = useRef(null);

  const colors = [
    { value: '#ef4444', label: 'Red (Power)' },
    { value: '#000000', label: 'Black (GND)' },
    { value: '#eab308', label: 'Yellow (Signal)' },
    { value: '#3b82f6', label: 'Blue (Signal)' },
    { value: '#22c55e', label: 'Green (Signal)' },
    { value: '#8b5cf6', label: 'Purple (USB Link)' }
  ];

  // Run electric wiring checks
  useEffect(() => {
    const list = [];
    
    // Check if USB wire links Pi and Arduino
    const hasUSBWire = wires.some(w => 
      (w.fromComponent === 'arduino' && w.fromPin === 'USB' && w.toComponent === 'raspberrypi' && w.toPin === 'USB_PORT') ||
      (w.toComponent === 'arduino' && w.toPin === 'USB' && w.fromComponent === 'raspberrypi' && w.fromPin === 'USB_PORT')
    );

    const hasArduino = components.some(c => c.type === 'arduino');
    const hasPi = components.some(c => c.type === 'raspberrypi');
    const hasDriver = components.some(c => c.type === 'motorDriver');
    const hasSensor = components.some(c => c.type === 'sensor');
    const hasLeftMotor = components.some(c => c.type === 'motorLeft');
    const hasRightMotor = components.some(c => c.type === 'motorRight');

    if (hasPi && hasArduino && !hasUSBWire) {
      list.push('Raspberry Pi 5 is not linked to Arduino via USB Cable. AI model will not be able to send serial commands.');
    }

    // Check HC-SR04 wiring to Arduino
    if (hasSensor && hasArduino) {
      const trigWired = wires.some(w => 
        (w.fromComponent === 'sensor' && w.fromPin === 'TRIG' && w.toComponent === 'arduino' && w.toPin === 'D12') ||
        (w.toComponent === 'sensor' && w.toPin === 'TRIG' && w.fromComponent === 'arduino' && w.fromPin === 'D12')
      );
      const echoWired = wires.some(w => 
        (w.fromComponent === 'sensor' && w.fromPin === 'ECHO' && w.toComponent === 'arduino' && w.toPin === 'D11') ||
        (w.toComponent === 'sensor' && w.toPin === 'ECHO' && w.fromComponent === 'arduino' && w.fromPin === 'D11')
      );
      const pwrWired = wires.some(w => 
        (w.fromComponent === 'sensor' && w.fromPin === 'VCC' && w.toComponent === 'arduino' && w.toPin === '5V') ||
        (w.toComponent === 'sensor' && w.toPin === 'VCC' && w.fromComponent === 'arduino' && w.fromPin === '5V')
      );
      const gndWired = wires.some(w => 
        (w.fromComponent === 'sensor' && w.fromPin === 'GND' && (w.toPin.startsWith('GND') || w.toPin === 'GND2'))
      );

      if (!trigWired) list.push('Sensor TRIG should be connected to Arduino Digital Pin 12.');
      if (!echoWired) list.push('Sensor ECHO should be connected to Arduino Digital Pin 11.');
      if (!pwrWired) list.push('Sensor VCC requires 5V from Arduino.');
    }

    // Check L298N driver input wires
    if (hasDriver && hasArduino) {
      const driverPins = ['ENA', 'IN1', 'IN2', 'IN3', 'IN4', 'ENB'];
      const correctArduinoPins = { ENA: 'D3', IN1: 'D5', IN2: 'D6', IN3: 'D7', IN4: 'D8', ENB: 'D9' };
      
      driverPins.forEach(dp => {
        const wired = wires.some(w => 
          (w.fromComponent === 'motorDriver' && w.fromPin === dp && w.toComponent === 'arduino' && w.toPin === correctArduinoPins[dp]) ||
          (w.toComponent === 'motorDriver' && w.toPin === dp && w.fromComponent === 'arduino' && w.fromPin === correctArduinoPins[dp])
        );
        if (!wired) {
          list.push(`L298N Driver input ${dp} should connect to Arduino Pin ${correctArduinoPins[dp]}.`);
        }
      });
    }

    // Check L298N output to DC motors
    if (hasDriver) {
      if (hasLeftMotor) {
        const out1 = wires.some(w => (w.fromComponent === 'motorDriver' && w.fromPin === 'OUT1' && w.toComponent === 'motorLeft') || (w.toComponent === 'motorDriver' && w.toPin === 'OUT1' && w.fromComponent === 'motorLeft'));
        const out2 = wires.some(w => (w.fromComponent === 'motorDriver' && w.fromPin === 'OUT2' && w.toComponent === 'motorLeft') || (w.toComponent === 'motorDriver' && w.toPin === 'OUT2' && w.fromComponent === 'motorLeft'));
        if (!out1 || !out2) list.push('DC Motor (Left) must be connected to L298N OUT1 and OUT2.');
      }
      if (hasRightMotor) {
        const out3 = wires.some(w => (w.fromComponent === 'motorDriver' && w.fromPin === 'OUT3' && w.toComponent === 'motorRight') || (w.toComponent === 'motorDriver' && w.toPin === 'OUT3' && w.fromComponent === 'motorRight'));
        const out4 = wires.some(w => (w.fromComponent === 'motorDriver' && w.fromPin === 'OUT4' && w.toComponent === 'motorRight') || (w.toComponent === 'motorDriver' && w.toPin === 'OUT4' && w.fromComponent === 'motorRight'));
        if (!out3 || !out4) list.push('DC Motor (Right) must be connected to L298N OUT3 and OUT4.');
      }
    }

    // Check battery power to motor driver (L298N needs external battery pack power)
    if (hasDriver && components.some(c => c.type === 'battery')) {
      const batPlus = wires.some(w => 
        (w.fromComponent === 'battery' && w.fromPin === '+' && w.toComponent === 'motorDriver' && w.toPin === 'VNS') ||
        (w.toComponent === 'battery' && w.toPin === '+' && w.fromComponent === 'motorDriver' && w.fromPin === 'VNS')
      );
      const batMinus = wires.some(w => 
        (w.fromComponent === 'battery' && w.fromPin === '-' && w.toComponent === 'motorDriver' && w.toPin === 'GND') ||
        (w.toComponent === 'battery' && w.toPin === '-' && w.fromComponent === 'motorDriver' && w.fromPin === 'GND')
      );
      if (!batPlus) list.push('L298N driver power (VNS) should connect to Battery (+).');
      if (!batMinus) list.push('L298N GND must connect to Battery (-) for a common ground reference.');
    }

    setWarnings(list);
  }, [wires, components]);

  // Compute absolute coordinate of a pin
  const getPinCoords = (compId, pinName) => {
    const comp = components.find(c => c.id === compId);
    if (!comp) return { x: 0, y: 0 };
    const schematic = COMPONENT_SCHEMATICS[comp.type];
    const pin = schematic.pins.find(p => p.name === pinName);
    if (!pin) return { x: 0, y: 0 };
    return {
      x: comp.x + pin.x,
      y: comp.y + pin.y
    };
  };

  // Add a component to the board
  const addComponent = (type) => {
    // Generate unique ID
    const count = components.filter(c => c.type === type).length;
    const id = type === 'arduino' ? 'arduino' : type === 'raspberrypi' ? 'raspberrypi' : `${type}_${count + 1}`;
    
    // Check if Arduino or Pi already added (only 1 allowed)
    if ((type === 'arduino' || type === 'raspberrypi') && components.some(c => c.type === type)) {
      return;
    }

    const newComp = {
      id,
      type,
      x: 50 + (components.length * 40) % 200,
      y: 80 + (components.length * 45) % 150
    };

    setComponents([...components, newComp]);
  };

  // Delete a component and its associated wires
  const deleteComponent = (id) => {
    setComponents(components.filter(c => c.id !== id));
    setWires(wires.filter(w => w.fromComponent !== id && w.toComponent !== id));
  };

  // Mouse drag handlers for components
  const handleCompMouseDown = (e, compId) => {
    if (e.target.closest('.pin-node')) return; // Ignore if clicking a pin node
    e.preventDefault();
    const comp = components.find(c => c.id === compId);
    if (!comp) return;

    setDraggingCompId(compId);
    setDragOffset({
      x: e.clientX - comp.x,
      y: e.clientY - comp.y
    });
  };

  const handleCanvasMouseMove = (e) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (draggingCompId) {
      const x = e.clientX - dragOffset.x;
      const y = e.clientY - dragOffset.y;
      
      // Clamp to canvas borders
      const comp = components.find(c => c.id === draggingCompId);
      const sch = COMPONENT_SCHEMATICS[comp.type];
      const clampedX = Math.max(10, Math.min(rect.width - sch.width - 10, x));
      const clampedY = Math.max(10, Math.min(rect.height - sch.height - 10, y));

      setComponents(
        components.map(c => c.id === draggingCompId ? { ...c, x: clampedX, y: clampedY } : c)
      );
    } else if (activeWire) {
      // Update temporary wire endpoint
      setActiveWire({
        ...activeWire,
        toX: mouseX,
        toY: mouseY
      });
    }
  };

  const handleCanvasMouseUp = () => {
    setDraggingCompId(null);
    if (activeWire) {
      setActiveWire(null);
    }
  };

  // Pin interaction
  const handlePinClick = (e, compId, pinName) => {
    e.stopPropagation();
    const coords = getPinCoords(compId, pinName);

    if (!activeWire) {
      // Start wiring
      setActiveWire({
        fromComponent: compId,
        fromPin: pinName,
        fromX: coords.x,
        fromY: coords.y,
        toX: coords.x,
        toY: coords.y
      });
    } else {
      // Complete wiring
      const { fromComponent, fromPin } = activeWire;

      // Don't wire a pin to itself or to the same component
      if (fromComponent === compId) {
        setActiveWire(null);
        return;
      }

      // Check if connection already exists
      const exists = wires.some(
        w => (w.fromComponent === fromComponent && w.fromPin === fromPin && w.toComponent === compId && w.toPin === pinName) ||
             (w.fromComponent === compId && w.fromPin === pinName && w.toComponent === fromComponent && w.toPin === fromPin)
      );

      if (!exists) {
        const isUSB = (fromPin === 'USB' && pinName === 'USB_PORT') || (fromPin === 'USB_PORT' && pinName === 'USB');
        
        setWires([
          ...wires,
          {
            id: `wire_${Date.now()}`,
            fromComponent,
            fromPin,
            toComponent: compId,
            toPin: pinName,
            color: isUSB ? '#8b5cf6' : wireColor // Force violet for USB cable
          }
        ]);
      }
      setActiveWire(null);
    }
  };

  const deleteSelectedWire = () => {
    if (selectedWireId) {
      setWires(wires.filter(w => w.id !== selectedWireId));
      setSelectedWireId(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-700/50 rounded-xl overflow-hidden shadow-2xl backdrop-blur-md">
      {/* Circuit Toolbox Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-950/70 border-b border-slate-800/80">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono text-slate-400">Add Parts:</span>
          <button
            onClick={() => addComponent('arduino')}
            disabled={components.some(c => c.type === 'arduino')}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-sky-950/80 border border-sky-600/50 disabled:opacity-30 disabled:pointer-events-none hover:bg-sky-900 hover:border-sky-500 rounded text-xs font-mono text-sky-300 transition-all"
          >
            <Plus size={12} /> Arduino Uno
          </button>
          <button
            onClick={() => addComponent('raspberrypi')}
            disabled={components.some(c => c.type === 'raspberrypi')}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/80 border border-emerald-600/50 disabled:opacity-30 disabled:pointer-events-none hover:bg-emerald-900 hover:border-emerald-500 rounded text-xs font-mono text-emerald-300 transition-all"
          >
            <Plus size={12} /> Raspberry Pi 5
          </button>
          <button
            onClick={() => addComponent('motorDriver')}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-red-950/80 border border-red-600/50 hover:bg-red-900 hover:border-red-500 rounded text-xs font-mono text-red-300 transition-all"
          >
            <Plus size={12} /> L298N Driver
          </button>
          <button
            onClick={() => addComponent('sensor')}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-950/80 border border-indigo-600/50 hover:bg-indigo-900 hover:border-indigo-500 rounded text-xs font-mono text-indigo-300 transition-all"
          >
            <Plus size={12} /> Sonar Sensor
          </button>
          <button
            onClick={() => addComponent('motorLeft')}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900/80 border border-slate-600/50 hover:bg-slate-800 hover:border-slate-500 rounded text-xs font-mono text-slate-300 transition-all"
          >
            <Plus size={12} /> Left Motor
          </button>
          <button
            onClick={() => addComponent('motorRight')}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900/80 border border-slate-600/50 hover:bg-slate-800 hover:border-slate-500 rounded text-xs font-mono text-slate-300 transition-all"
          >
            <Plus size={12} /> Right Motor
          </button>
          <button
            onClick={() => addComponent('battery')}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-neutral-800 border border-neutral-600 hover:bg-neutral-700 rounded text-xs font-mono text-neutral-300 transition-all"
          >
            <Plus size={12} /> 9V Battery
          </button>
        </div>

        {/* Wire Color Selection */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-400">Wire Color:</span>
          <div className="flex items-center gap-1">
            {colors.map((c) => (
              <button
                key={c.value}
                onClick={() => setWireColor(c.value)}
                style={{ backgroundColor: c.value }}
                title={c.label}
                className={`w-4 h-4 rounded-full border transition-all ${
                  wireColor === c.value
                    ? 'border-white scale-125 shadow-md shadow-white/20'
                    : 'border-transparent opacity-80 hover:opacity-100 hover:scale-110'
                }`}
              />
            ))}
          </div>
          {selectedWireId && (
            <button
              onClick={deleteSelectedWire}
              className="flex items-center gap-1 px-2 py-1 bg-red-950/80 border border-red-500/50 hover:bg-red-900 hover:text-white rounded text-xs text-red-300 transition-all"
            >
              <Trash2 size={12} /> Delete Wire
            </button>
          )}
        </div>
      </div>

      {/* Grid Canvas Area */}
      <div
        ref={canvasRef}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        className="flex-grow w-full relative select-none overflow-hidden"
        style={{
          backgroundColor: '#0b0f19',
          backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }}
      >
        {/* SVG wires layer */}
        <svg className="absolute inset-0 pointer-events-none w-full h-full z-10">
          <defs>
            <filter id="wire-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Render permanent wires */}
          {wires.map((wire) => {
            const start = getPinCoords(wire.fromComponent, wire.fromPin);
            const end = getPinCoords(wire.toComponent, wire.toPin);
            
            // Bezier curve calculations
            const dx = Math.abs(end.x - start.x) * 0.5;
            const controlPointStartX = start.x + (end.x > start.x ? dx : -dx);
            const controlPointEndX = end.x + (end.x > start.x ? -dx : dx);
            const path = `M ${start.x} ${start.y} C ${controlPointStartX} ${start.y}, ${controlPointEndX} ${end.y}, ${end.x} ${end.y}`;

            const isSelected = selectedWireId === wire.id;

            return (
              <g key={wire.id} className="pointer-events-auto cursor-pointer">
                {/* Thick invisible click helper line */}
                <path
                  d={path}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="12"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedWireId(wire.id);
                  }}
                />
                {/* Visual wire path */}
                <path
                  d={path}
                  fill="none"
                  stroke={wire.color}
                  strokeWidth={isSelected ? '4' : '2.5'}
                  filter="url(#wire-glow)"
                  className="transition-all duration-150"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedWireId(wire.id);
                  }}
                  style={{
                    opacity: isSelected ? 1.0 : 0.85,
                    strokeDasharray: wire.color === '#8b5cf6' ? '6,3' : 'none' // Dash representation for USB cable
                  }}
                />
              </g>
            );
          })}

          {/* Render active dragging wire */}
          {activeWire && (
            <path
              d={`M ${activeWire.fromX} ${activeWire.fromY} C ${activeWire.fromX + (activeWire.toX > activeWire.fromX ? 50 : -50)} ${activeWire.fromY}, ${activeWire.toX + (activeWire.toX > activeWire.fromX ? -50 : 50)} ${activeWire.toY}, ${activeWire.toX} ${activeWire.toY}`}
              fill="none"
              stroke={wireColor}
              strokeWidth="2.5"
              filter="url(#wire-glow)"
              style={{ opacity: 0.6 }}
            />
          )}
        </svg>

        {/* Render Components */}
        {components.map((comp) => {
          const schematic = COMPONENT_SCHEMATICS[comp.type];
          if (!schematic) return null;

          return (
            <div
              key={comp.id}
              style={{
                left: comp.x,
                top: comp.y,
                width: schematic.width,
                height: schematic.height
              }}
              onMouseDown={(e) => handleCompMouseDown(e, comp.id)}
              className={`absolute border rounded-xl p-3 flex flex-col shadow-xl cursor-grab active:cursor-grabbing select-none transition-shadow hover:shadow-2xl z-20 ${schematic.color}`}
            >
              {/* Component Header */}
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-mono font-bold uppercase tracking-wider ${schematic.titleColor}`}>
                  {schematic.name}
                </span>
                <button
                  onClick={() => deleteComponent(comp.id)}
                  className="p-1 hover:bg-slate-800 text-slate-400 hover:text-red-400 rounded transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>

              {/* Graphical Board details inside component */}
              <div className="flex-grow rounded border border-slate-800 bg-slate-950/80 p-2 flex flex-col justify-center items-center text-[10px] font-mono text-slate-500 relative">
                {comp.type === 'arduino' && (
                  <>
                    <div className="w-10 h-10 border border-slate-700 bg-slate-900 rounded flex items-center justify-center text-slate-500 font-bold mb-1 shadow-inner">MCU</div>
                    <div className="text-[9px] text-cyan-500/80">32-bit Cortex-M4</div>
                    <div className="absolute left-2 top-[35%] w-6 h-10 bg-slate-800 border border-slate-700 rounded flex items-center justify-center font-bold text-[8px] text-slate-400">USB</div>
                  </>
                )}
                {comp.type === 'raspberrypi' && (
                  <>
                    <div className="w-12 h-12 border border-slate-700 bg-slate-900 rounded-lg flex items-center justify-center text-slate-500 font-bold mb-1 shadow-inner">BCM2712</div>
                    <div className="text-[9px] text-emerald-500/80">Cortex-A76 (4-core)</div>
                    <div className="absolute left-2 top-[40%] w-6 h-8 bg-slate-800 border border-slate-700 rounded flex items-center justify-center font-bold text-[8px] text-slate-400">USB</div>
                  </>
                )}
                {comp.type === 'motorDriver' && (
                  <>
                    <div className="w-10 h-12 bg-red-900/80 border border-red-700 rounded flex flex-col justify-around items-center font-bold text-[7px] text-red-200 mb-1">
                      <div className="w-8 h-1 bg-red-950"></div>
                      <div className="w-8 h-1 bg-red-950"></div>
                      <div className="w-8 h-1 bg-red-950"></div>
                      L298N
                    </div>
                    <div className="text-[8px] text-red-400/80">HEATSINK</div>
                  </>
                )}
                {comp.type === 'sensor' && (
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full border-2 border-indigo-500 bg-slate-900 flex items-center justify-center font-bold text-[9px] text-indigo-400">T</div>
                    <div className="w-10 h-10 rounded-full border-2 border-indigo-500 bg-slate-900 flex items-center justify-center font-bold text-[9px] text-indigo-400">R</div>
                  </div>
                )}
                {comp.type.startsWith('motor') && (
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-6 bg-slate-800 border border-slate-700 rounded-t flex items-center justify-center text-[7px]">GEAR</div>
                    <div className="w-14 h-4 bg-slate-700 border border-slate-600 rounded-full shadow flex items-center justify-center font-bold text-[8px] text-slate-400">TIRE</div>
                  </div>
                )}
                {comp.type === 'battery' && (
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-3 bg-neutral-700 border border-neutral-600 rounded flex items-center justify-center font-bold text-[6px]">9V</div>
                    <div className="w-10 h-12 bg-neutral-800 border border-neutral-600 rounded shadow-md mt-1"></div>
                  </div>
                )}
              </div>

              {/* Pins node overlays */}
              {schematic.pins.map((pin) => (
                <div
                  key={pin.name}
                  style={{
                    left: pin.x - 6,
                    top: pin.y - 6
                  }}
                  title={`${pin.name} (${pin.type})`}
                  onClick={(e) => handlePinClick(e, comp.id, pin.name)}
                  className={`pin-node absolute w-3.5 h-3.5 rounded-full border-2 cursor-pointer flex items-center justify-center text-[7px] font-bold font-mono transition-all z-30 ${
                    activeWire && activeWire.fromComponent === comp.id && activeWire.fromPin === pin.name
                      ? 'bg-yellow-400 border-white scale-125 animate-ping'
                      : pin.type === 'power'
                      ? 'bg-red-800 border-red-500 hover:bg-red-500 hover:scale-125'
                      : pin.type === 'usb'
                      ? 'bg-purple-900 border-purple-500 hover:bg-purple-500 hover:scale-125'
                      : 'bg-slate-800 border-cyan-500 hover:bg-cyan-500 hover:scale-125'
                  }`}
                >
                  {/* Miniature labels inside pin overlay */}
                  <span className="absolute text-[6px] text-slate-400 pointer-events-none transform -translate-y-4">
                    {pin.name}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Validation Checklist Panel */}
      <div className="p-3 bg-slate-950 border-t border-slate-800/80">
        <div className="flex items-center gap-1.5 mb-2">
          <HelpCircle size={14} className="text-slate-400" />
          <span className="text-xs font-mono font-bold text-slate-300">Circuit Validation Helper</span>
        </div>
        
        {warnings.length === 0 ? (
          <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-950/40 p-2 border border-emerald-900/60 rounded">
            <CheckCircle2 size={14} />
            <span>Wiring checklist complete! Circuit logic ready for simulator.</span>
          </div>
        ) : (
          <div className="max-h-24 overflow-y-auto space-y-1 bg-slate-900/50 p-2 border border-slate-800/60 rounded">
            {warnings.map((w, idx) => (
              <div key={idx} className="flex items-start gap-1.5 text-[10px] font-mono text-amber-400/90 leading-tight">
                <AlertCircle size={10} className="flex-shrink-0 mt-0.5" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
