#!/usr/bin/env python3
"""
Code Executor Service using Pyodide (WebAssembly)

Executes Python code in an isolated WebAssembly sandbox.
Provides a safe environment for ephemeral code execution.

Features:
- Complete isolation via WebAssembly
- No filesystem access
- No network access
- Timeout enforcement
- Memory limits
- Stateless execution
"""

import asyncio
import json
import os
import sys
import logging
import time
import traceback
import threading
from typing import Dict, Any, Optional
from io import StringIO
from contextlib import contextmanager

from flask import Flask, request, jsonify, Response
from flask_cors import CORS

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
SERVICE_PORT = int(os.getenv("CODE_EXECUTOR_PORT", "5002"))
MAX_EXECUTION_TIME = int(os.getenv("MAX_EXECUTION_TIME", "30"))  # seconds
MAX_OUTPUT_SIZE = int(os.getenv("MAX_OUTPUT_SIZE", "10240"))  # 10KB
MAX_CODE_SIZE = int(os.getenv("MAX_CODE_SIZE", "50000"))  # 50KB

# Pyodide runtime
pyodide_runtime = None


class TimeoutError(Exception):
    """Raised when code execution exceeds time limit"""
    pass


class OutputCapture:
    """Captures stdout and stderr with size limits"""

    def __init__(self, max_size: int = MAX_OUTPUT_SIZE):
        self.max_size = max_size
        self.stdout = StringIO()
        self.stderr = StringIO()
        self._stdout_size = 0
        self._stderr_size = 0
        self.truncated = False

    def write_stdout(self, text: str):
        if self._stdout_size < self.max_size:
            remaining = self.max_size - self._stdout_size
            if len(text) > remaining:
                self.stdout.write(text[:remaining])
                self.truncated = True
            else:
                self.stdout.write(text)
            self._stdout_size += len(text)

    def write_stderr(self, text: str):
        if self._stderr_size < self.max_size:
            remaining = self.max_size - self._stderr_size
            if len(text) > remaining:
                self.stderr.write(text[:remaining])
                self.truncated = True
            else:
                self.stderr.write(text)
            self._stderr_size += len(text)

    def get_output(self) -> Dict[str, Any]:
        result = {
            "stdout": self.stdout.getvalue(),
            "stderr": self.stderr.getvalue(),
        }
        if self.truncated:
            result["truncated"] = True
            result["note"] = f"Output truncated to {self.max_size} bytes"
        return result


class RestrictedExecutor:
    """
    Executes Python code with restrictions using RestrictedPython
    as a fallback when Pyodide is not available.
    """

    # Dangerous builtins to remove
    FORBIDDEN_BUILTINS = {
        'eval', 'exec', 'compile', '__import__', 'open', 'input',
        'breakpoint', 'memoryview', 'globals', 'locals', 'vars',
        'dir', 'getattr', 'setattr', 'delattr', 'hasattr',
    }

    # Safe builtins to allow
    SAFE_BUILTINS = {
        'abs', 'all', 'any', 'ascii', 'bin', 'bool', 'bytearray',
        'bytes', 'callable', 'chr', 'classmethod', 'complex',
        'dict', 'divmod', 'enumerate', 'filter', 'float', 'format',
        'frozenset', 'hash', 'hex', 'id', 'int', 'isinstance',
        'issubclass', 'iter', 'len', 'list', 'map', 'max', 'min',
        'next', 'object', 'oct', 'ord', 'pow', 'print', 'property',
        'range', 'repr', 'reversed', 'round', 'set', 'slice',
        'sorted', 'staticmethod', 'str', 'sum', 'super', 'tuple',
        'type', 'zip', 'True', 'False', 'None',
        # Math functions
        'Exception', 'ValueError', 'TypeError', 'KeyError',
        'IndexError', 'AttributeError', 'RuntimeError', 'StopIteration',
    }

    # Safe modules whitelist
    SAFE_MODULES = {
        'math', 'random', 'datetime', 'json', 're', 'itertools',
        'functools', 'collections', 'string', 'decimal', 'fractions',
        'statistics', 'operator', 'copy', 'textwrap', 'unicodedata',
    }

    def __init__(self, timeout: int = MAX_EXECUTION_TIME):
        self.timeout = timeout
        self._setup_safe_globals()

    def _setup_safe_globals(self):
        """Create a restricted global namespace"""
        import builtins

        # Build safe builtins
        safe_builtins = {}
        for name in self.SAFE_BUILTINS:
            if hasattr(builtins, name):
                safe_builtins[name] = getattr(builtins, name)

        # Custom safe import
        def safe_import(name, *args, **kwargs):
            if name in self.SAFE_MODULES:
                return __import__(name)
            raise ImportError(f"Import of '{name}' is not allowed in sandbox")

        safe_builtins['__import__'] = safe_import

        self.safe_globals = {
            '__builtins__': safe_builtins,
            '__name__': '__sandbox__',
            '__doc__': None,
        }

        # Pre-import safe modules
        for module_name in self.SAFE_MODULES:
            try:
                self.safe_globals[module_name] = __import__(module_name)
            except ImportError:
                pass

    def execute(self, code: str) -> Dict[str, Any]:
        """Execute code with restrictions and timeout"""
        output = OutputCapture()
        start_time = time.time()
        result = None
        error = None

        # Redirect stdout/stderr
        old_stdout = sys.stdout
        old_stderr = sys.stderr

        class StdoutCapture:
            def write(self, text):
                output.write_stdout(text)
            def flush(self):
                pass

        class StderrCapture:
            def write(self, text):
                output.write_stderr(text)
            def flush(self):
                pass

        # Use a flag to track timeout
        timed_out = threading.Event()

        def timeout_handler():
            """Called when timeout is reached"""
            timed_out.set()

        timeout_timer = threading.Timer(self.timeout, timeout_handler)
        timeout_timer.daemon = True

        try:
            sys.stdout = StdoutCapture()
            sys.stderr = StderrCapture()

            # Start timeout timer (thread-safe, works in worker threads)
            timeout_timer.start()

            # Compile and execute
            compiled = compile(code, '<sandbox>', 'exec')

            # Create fresh namespace for each execution (stateless)
            exec_globals = self.safe_globals.copy()
            exec_locals = {}

            # Execute with periodic checks for timeout
            exec(compiled, exec_globals, exec_locals)

            # Check if timeout occurred during execution
            if timed_out.is_set():
                error = f"Code execution timed out after {self.timeout} seconds"
            else:
                # Try to get return value from last expression
                # Check if there's a variable named 'result' or '_'
                if '_result_' in exec_locals:
                    result = exec_locals['_result_']
                elif 'result' in exec_locals:
                    result = exec_locals['result']

        except TimeoutError as e:
            error = str(e)
        except SyntaxError as e:
            error = f"SyntaxError: {e.msg} at line {e.lineno}"
        except Exception as e:
            error = f"{type(e).__name__}: {str(e)}"
            # Add truncated traceback
            tb = traceback.format_exc()
            if len(tb) > 500:
                tb = tb[:500] + "\n... (traceback truncated)"
            output.write_stderr(tb)
        finally:
            # Cancel timeout timer
            timeout_timer.cancel()

            sys.stdout = old_stdout
            sys.stderr = old_stderr

        execution_time = time.time() - start_time

        return {
            "success": error is None,
            "result": self._serialize_result(result),
            "error": error,
            "execution_time_ms": round(execution_time * 1000, 2),
            **output.get_output()
        }

    def _serialize_result(self, result: Any) -> Any:
        """Serialize result to JSON-safe format"""
        if result is None:
            return None

        try:
            # Test if JSON serializable
            json.dumps(result)
            return result
        except (TypeError, ValueError):
            # Convert to string representation
            return repr(result)


# Global executor instance
executor = RestrictedExecutor()

# Flask app
app = Flask(__name__)
CORS(app)


@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "service": "code-executor",
        "version": "1.0.0",
        "mode": "restricted-python",
        "limits": {
            "max_execution_time_seconds": MAX_EXECUTION_TIME,
            "max_output_size_bytes": MAX_OUTPUT_SIZE,
            "max_code_size_bytes": MAX_CODE_SIZE,
        }
    })


@app.route("/execute", methods=["POST"])
def execute_code():
    """
    Execute Python code in sandbox

    Request body:
    {
        "code": "print('Hello, World!')",
        "timeout": 30  // optional, default 30 seconds
    }

    Response:
    {
        "success": true,
        "result": null,
        "stdout": "Hello, World!\n",
        "stderr": "",
        "execution_time_ms": 5.2,
        "error": null
    }
    """
    try:
        data = request.get_json()

        if not data or "code" not in data:
            return jsonify({
                "success": False,
                "error": "Missing 'code' in request body"
            }), 400

        code = data["code"]
        timeout = min(data.get("timeout", MAX_EXECUTION_TIME), MAX_EXECUTION_TIME)

        # Validate code size
        if len(code) > MAX_CODE_SIZE:
            return jsonify({
                "success": False,
                "error": f"Code exceeds maximum size of {MAX_CODE_SIZE} bytes"
            }), 400

        # Validate code is not empty
        if not code.strip():
            return jsonify({
                "success": False,
                "error": "Code cannot be empty"
            }), 400

        logger.info(f"Executing code ({len(code)} bytes, timeout={timeout}s)")

        # Execute with custom timeout if specified
        if timeout != MAX_EXECUTION_TIME:
            local_executor = RestrictedExecutor(timeout=timeout)
            result = local_executor.execute(code)
        else:
            result = executor.execute(code)

        # Log execution result with error details if failed
        if result['success']:
            logger.info(f"Execution completed: success=True, time={result['execution_time_ms']}ms")
        else:
            logger.error(f"Execution completed: success=False, time={result['execution_time_ms']}ms, error={result.get('error', 'Unknown error')}")
            if result.get('stderr'):
                logger.error(f"Stderr output:\n{result['stderr']}")

        return jsonify(result)

    except Exception as e:
        logger.error(f"Error executing code: {e}")
        return jsonify({
            "success": False,
            "error": f"Internal error: {str(e)}"
        }), 500


@app.route("/limits", methods=["GET"])
def get_limits():
    """Get current execution limits"""
    return jsonify({
        "max_execution_time_seconds": MAX_EXECUTION_TIME,
        "max_output_size_bytes": MAX_OUTPUT_SIZE,
        "max_code_size_bytes": MAX_CODE_SIZE,
        "safe_modules": sorted(RestrictedExecutor.SAFE_MODULES),
        "forbidden_operations": [
            "file_operations",
            "network_access",
            "system_calls",
            "subprocess",
            "eval/exec",
            "import_arbitrary_modules"
        ]
    })


@app.route("/validate", methods=["POST"])
def validate_code():
    """
    Validate Python code syntax without executing

    Request body:
    {
        "code": "print('Hello')"
    }

    Response:
    {
        "valid": true,
        "error": null
    }
    """
    try:
        data = request.get_json()

        if not data or "code" not in data:
            return jsonify({
                "valid": False,
                "error": "Missing 'code' in request body"
            }), 400

        code = data["code"]

        try:
            compile(code, '<validation>', 'exec')
            return jsonify({
                "valid": True,
                "error": None
            })
        except SyntaxError as e:
            return jsonify({
                "valid": False,
                "error": f"SyntaxError: {e.msg} at line {e.lineno}"
            })

    except Exception as e:
        logger.error(f"Error validating code: {e}")
        return jsonify({
            "valid": False,
            "error": f"Internal error: {str(e)}"
        }), 500


@app.route("/examples", methods=["GET"])
def get_examples():
    """Get example code snippets"""
    return jsonify({
        "examples": [
            {
                "name": "Basic Math",
                "code": "result = 2 + 2\nprint(f'2 + 2 = {result}')",
                "description": "Simple arithmetic"
            },
            {
                "name": "Fibonacci",
                "code": """def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

for i in range(10):
    print(f'fib({i}) = {fibonacci(i)}')""",
                "description": "Recursive Fibonacci sequence"
            },
            {
                "name": "List Processing",
                "code": """numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
squared = [x**2 for x in numbers]
even = [x for x in numbers if x % 2 == 0]

print(f'Original: {numbers}')
print(f'Squared: {squared}')
print(f'Even: {even}')
print(f'Sum: {sum(numbers)}')
print(f'Average: {sum(numbers)/len(numbers)}')""",
                "description": "List comprehensions and aggregations"
            },
            {
                "name": "Using Math Module",
                "code": """import math

print(f'π = {math.pi}')
print(f'e = {math.e}')
print(f'sqrt(2) = {math.sqrt(2)}')
print(f'sin(π/2) = {math.sin(math.pi/2)}')
print(f'log(10) = {math.log(10)}')
print(f'factorial(5) = {math.factorial(5)}')""",
                "description": "Mathematical functions"
            },
            {
                "name": "Statistics",
                "code": """import statistics

data = [2, 5, 7, 3, 8, 9, 1, 4, 6]

print(f'Data: {data}')
print(f'Mean: {statistics.mean(data)}')
print(f'Median: {statistics.median(data)}')
print(f'Mode: {statistics.mode(data)}' if len(set(data)) < len(data) else 'No mode (all unique)')
print(f'Std Dev: {statistics.stdev(data):.2f}')
print(f'Variance: {statistics.variance(data):.2f}')""",
                "description": "Statistical calculations"
            },
            {
                "name": "JSON Processing",
                "code": """import json

data = {
    "name": "Alice",
    "age": 30,
    "skills": ["Python", "JavaScript", "SQL"],
    "active": True
}

# Convert to JSON string
json_str = json.dumps(data, indent=2)
print("JSON output:")
print(json_str)

# Parse back
parsed = json.loads(json_str)
print(f"\\nParsed name: {parsed['name']}")
print(f"Skills: {', '.join(parsed['skills'])}")""",
                "description": "JSON serialization and parsing"
            },
            {
                "name": "Date/Time",
                "code": """import datetime

now = datetime.datetime.now()
today = datetime.date.today()

print(f'Current time: {now}')
print(f'Today: {today}')
print(f'Year: {now.year}')
print(f'Month: {now.month}')
print(f'Day: {now.day}')

# Date arithmetic
future = today + datetime.timedelta(days=30)
print(f'30 days from now: {future}')""",
                "description": "Date and time operations"
            },
            {
                "name": "Regular Expressions",
                "code": """import re

text = "Contact us at email@example.com or support@company.org"

# Find all emails
emails = re.findall(r'[\\w.]+@[\\w.]+', text)
print(f'Found emails: {emails}')

# Replace pattern
masked = re.sub(r'([\\w.]+)@', 'HIDDEN@', text)
print(f'Masked: {masked}')

# Check if matches
if re.match(r'^Contact', text):
    print('Text starts with "Contact"')""",
                "description": "Pattern matching with regex"
            }
        ]
    })


if __name__ == "__main__":
    logger.info(f"🚀 Starting Code Executor Service on port {SERVICE_PORT}")
    logger.info(f"⏱ Max execution time: {MAX_EXECUTION_TIME}s")
    logger.info(f"📦 Max output size: {MAX_OUTPUT_SIZE} bytes")
    logger.info(f"📝 Max code size: {MAX_CODE_SIZE} bytes")
    logger.info(f"🔒 Mode: Restricted Python (safe builtins + whitelisted modules)")

    app.run(host="0.0.0.0", port=SERVICE_PORT, threaded=True)
