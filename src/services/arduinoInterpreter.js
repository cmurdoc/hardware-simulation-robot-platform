/**
 * High-fidelity behavioral C++ Arduino interpreter.
 * Translates standard C++ Arduino code sketches to JavaScript and runs them in a sandboxed async loop.
 */

// Inject C++ String helper prototypes if they aren't present
if (!String.prototype.toFloat) {
  String.prototype.toFloat = function () {
    const val = parseFloat(this);
    return isNaN(val) ? 0.0 : val;
  };
}
if (!String.prototype.toInt) {
  String.prototype.toInt = function () {
    const val = parseInt(this, 10);
    return isNaN(val) ? 0 : val;
  };
}

export const arduinoInterpreter = {
  /**
   * Translates Arduino C++ code to JavaScript.
   */
  translate(cppCode) {
    let js = cppCode;

    // 1. Remove comments
    js = js.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');

    // 2. Translate C++ variable declarations (int, float, double, char, String, bool, long)
    // Replace declarations like "const int pin = 3;" or "int state = 0;" with "let/const"
    js = js.replace(/\bconst\s+(int|float|double|char|String|bool|long|byte)\b/g, 'const');
    js = js.replace(/\b(int|float|double|char|String|bool|long|byte)\b/g, 'let');

    // 3. Translate C++ function declarations: "void setup()" -> "async function setup()"
    // and custom functions: "void driveMotors(float x, float y)" -> "async function driveMotors(x, y)"
    // Matches "void name(args) {" or "int name(args) {"
    js = js.replace(/\b(?:void|int|float|double|bool|String|long)\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*\{/g, (match, funcName, args) => {
      // Clean args of types (e.g. "let left, let right" -> "left, right")
      const cleanArgs = args
        .replace(/\b(?:let|const|int|float|double|char|String|bool|long|byte)\b/g, '')
        .trim();
      return `async function ${funcName}(${cleanArgs}) {`;
    });

    // 4. Translate delay() and delayMicroseconds() to await versions
    js = js.replace(/\bdelay\(([^)]+)\)/g, 'await delay($1)');
    js = js.replace(/\bdelayMicroseconds\(([^)]+)\)/g, 'await delayMicroseconds($1)');
    
    // 5. Translate pulseIn()
    js = js.replace(/\bpulseIn\(([^)]+)\)/g, 'await pulseIn($1)');

    // 6. Translate String functions and serial methods to make sure they are async-called if needed
    // e.g. "Serial.readStringUntil('\n')" -> "await Serial.readStringUntil('\n')"
    js = js.replace(/\bSerial\.readStringUntil\(([^)]+)\)/g, 'await Serial.readStringUntil($1)');

    // 7. Make sure any custom function calls inside loop() or other functions are awaited!
    // Since we made all user-defined functions async, they must be called with await.
    // To do this simply, we find declared functions and add await to their calls.
    const functionsDeclared = [];
    const declRegex = /async function\s+([a-zA-Z0-9_]+)/g;
    let match;
    while ((match = declRegex.exec(js)) !== null) {
      const name = match[1];
      if (name !== 'setup' && name !== 'loop') {
        functionsDeclared.push(name);
      }
    }

    // Replace func(...) with await func(...) for declared functions
    functionsDeclared.forEach(funcName => {
      // Negative lookbehind for "function " or "await " to avoid double-await or syntax errors
      const callRegex = new RegExp(`(?<!\\bfunction\\s+)(?<!\\bawait\\s+)\\b${funcName}\\s*\\(`, 'g');
      js = js.replace(callRegex, `await ${funcName}(`);
    });

    return js;
  },

  /**
   * Runs the translated JS Arduino code inside a sandboxed runner.
   * Returns a control object to stop execution, send serial inputs, and inspect states.
   */
  run(translatedJs, callbacks) {
    const {
      onPinWrite,        // (pin, value, isAnalog)
      onSerialWrite,     // (string)
      getSensorDistance, // () -> float in cm
      onError,           // (errorMsg)
      onDebug            // (msg)
    } = callbacks;

    // Execution state
    let isRunning = true;
    const serialInputBuffer = [];
    const pinStates = {};

    // Standard Arduino Constants
    const HIGH = 1;
    const LOW = 0;
    const INPUT = 'INPUT';
    const OUTPUT = 'OUTPUT';
    const INPUT_PULLUP = 'INPUT_PULLUP';

    // Mock functions to inject into the sandbox
    const delay = (ms) => new Promise((resolve) => {
      setTimeout(() => {
        if (isRunning) resolve();
      }, ms);
    });

    const delayMicroseconds = (us) => new Promise((resolve) => {
      // Rough mock for microseconds
      setTimeout(() => {
        if (isRunning) resolve();
      }, us / 1000);
    });

    const pinMode = (pin, mode) => {
      const pinKey = typeof pin === 'number' ? 'D' + pin : pin;
      pinStates[pinKey] = { mode, value: 0 };
    };

    const digitalWrite = (pin, val) => {
      const pinKey = typeof pin === 'number' ? 'D' + pin : pin;
      if (!pinStates[pinKey]) pinStates[pinKey] = { mode: OUTPUT, value: 0 };
      pinStates[pinKey].value = val;
      if (onPinWrite) onPinWrite(pinKey, val, false);
    };

    const analogWrite = (pin, val) => {
      const pinKey = typeof pin === 'number' ? 'D' + pin : pin;
      if (!pinStates[pinKey]) pinStates[pinKey] = { mode: OUTPUT, value: 0 };
      pinStates[pinKey].value = val;
      if (onPinWrite) onPinWrite(pinKey, val, true);
    };

    const digitalRead = (pin) => {
      const pinKey = typeof pin === 'number' ? 'D' + pin : pin;
      return pinStates[pinKey] ? pinStates[pinKey].value : 0;
    };

    const pulseIn = async (pin, state) => {
      // Simulates ultrasonic pulse duration based on raycast distance
      // Distance = duration * 0.034 / 2 => duration = distance * 2 / 0.034
      const dist = getSensorDistance() || 400; // cm
      const duration = (dist * 2) / 0.034;
      await delay(1); // simulate short timing
      return Math.round(duration);
    };

    const abs = (val) => Math.abs(val);
    const min = (a, b) => Math.min(a, b);
    const max = (a, b) => Math.max(a, b);
    const constrain = (x, a, b) => Math.max(a, Math.min(b, x));

    // Serial object mock
    const Serial = {
      begin(baud) {
        if (onDebug) onDebug(`Serial started at ${baud} baud.`);
      },
      print(val) {
        const str = String(val);
        if (onSerialWrite) onSerialWrite(str);
      },
      println(val) {
        const str = String(val) + '\n';
        if (onSerialWrite) onSerialWrite(str);
      },
      available() {
        return serialInputBuffer.length;
      },
      read() {
        if (serialInputBuffer.length === 0) return -1;
        return serialInputBuffer.shift().charCodeAt(0);
      },
      async readStringUntil(terminator) {
        let result = '';
        const termChar = typeof terminator === 'string' ? terminator.charAt(0) : String.fromCharCode(terminator);
        
        while (isRunning) {
          if (serialInputBuffer.length > 0) {
            const char = serialInputBuffer.shift();
            if (char === termChar) {
              break;
            }
            result += char;
          } else {
            // Wait for input to arrive
            await delay(10);
          }
        }
        return result;
      }
    };

    // Build the script string
    // Wraps the translated user script, making all injected helpers available.
    const runnerSource = `
      ${translatedJs}

      // Main runner loop
      async function runArduino() {
        try {
          if (typeof setup === 'function') {
            await setup();
          }
          while (isRunning()) {
            if (typeof loop === 'function') {
              await loop();
            }
            // Auto-yield to prevent UI lockup
            await delay(5);
          }
        } catch (err) {
          onError(err.message || String(err));
        }
      }
      return runArduino();
    `;

    try {
      // Create the sandboxed executor function
      const executor = new Function(
        'HIGH', 'LOW', 'INPUT', 'OUTPUT', 'INPUT_PULLUP',
        'pinMode', 'digitalWrite', 'analogWrite', 'digitalRead', 'pulseIn',
        'delay', 'delayMicroseconds', 'abs', 'min', 'max', 'constrain',
        'Serial', 'isRunning', 'onError',
        runnerSource
      );

      // Execute asynchronously
      executor(
        HIGH, LOW, INPUT, OUTPUT, INPUT_PULLUP,
        pinMode, digitalWrite, analogWrite, digitalRead, pulseIn,
        delay, delayMicroseconds, abs, min, max, constrain,
        Serial, () => isRunning, (err) => {
          if (onError) onError(err);
          isRunning = false;
        }
      );
    } catch (compileErr) {
      if (onError) onError(`Compilation Error: ${compileErr.message}`);
      isRunning = false;
    }

    // Return the controller API
    return {
      stop() {
        isRunning = false;
      },
      sendSerial(dataString) {
        for (let i = 0; i < dataString.length; i++) {
          serialInputBuffer.push(dataString.charAt(i));
        }
      },
      getPinState(pin) {
        const pinKey = typeof pin === 'number' ? 'D' + pin : pin;
        return pinStates[pinKey];
      }
    };
  }
};
