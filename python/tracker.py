# python/tracker.py
import pynput
import time
import json
import sys

# Lấy thời gian bắt đầu làm mốc
start_time = time.time()

def get_timestamp():
    """Trả về thời gian trôi qua tính bằng millisecond kể từ khi script bắt đầu."""
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


# Thiết lập và chạy listener
# Sử dụng 'with' để đảm bảo listener được dọn dẹp sạch sẽ khi kết thúc
with pynput.mouse.Listener(on_move=on_move, on_click=on_click) as listener:
    listener.join()