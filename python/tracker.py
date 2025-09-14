# python/tracker.py
import pynput
import time
import json
import sys

# Get start time
start_time = time.time()

def get_timestamp():
    """Return the time elapsed in milliseconds since the script started."""
    return round((time.time() - start_time) * 1000)

def on_move(x, y):
    event_data = {
        "type": "move",
        "x": x,
        "y": y,
        "timestamp": get_timestamp()
    }
    print(json.dumps(event_data), flush=True)

def on_click(x, y, button, pressed):
    event_data = {
        "type": "click",
        "x": x,
        "y": y,
        "button": str(button),
        "pressed": pressed,
        "timestamp": get_timestamp()
    }
    print(json.dumps(event_data), flush=True)


# Set up and run listener
# Use 'with' to ensure the listener is cleaned up when it ends
with pynput.mouse.Listener(on_move=on_move, on_click=on_click) as listener:
    listener.join()