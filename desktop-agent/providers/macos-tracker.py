#!/usr/bin/env python3
"""
WorkRank macOS Computer Activity Telemetry Streamer
High-Precision 50Hz OS Telemetry Detector using CoreGraphics & AppKit via ctypes.

Tracks:
- System Idle Time (seconds)
- Frontmost Application Name (NSWorkspace)
- Exact Mouse Clicks (Left, Right, Middle)
- Exact Keystrokes (KeyDown count) - STRICTLY NO key content captured
"""

import sys
import time
import ctypes
from ctypes import c_void_p, c_char_p, c_uint32, c_int, c_double

def _init():
    try:
        cg = ctypes.cdll.LoadLibrary('/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics')
        appkit = ctypes.cdll.LoadLibrary('/System/Library/Frameworks/AppKit.framework/AppKit')
        objc = ctypes.cdll.LoadLibrary('/usr/lib/libobjc.A.dylib')
        return cg, appkit, objc
    except Exception as e:
        sys.stderr.write(f"[macos-tracker] Framework load error: {e}\n")
        return None, None, None

cg, appkit, objc = _init()

# Setup ObjC message send for NSWorkspace
if objc and appkit:
    objc.objc_getClass.restype = c_void_p
    objc.objc_getClass.argtypes = [c_char_p]

    objc.sel_registerName.restype = c_void_p
    objc.sel_registerName.argtypes = [c_char_p]

    objc.objc_msgSend.restype = c_void_p
    objc.objc_msgSend.argtypes = [c_void_p, c_void_p]

    _NSWorkspace = objc.objc_getClass(b'NSWorkspace')
    _sel_sharedWorkspace = objc.sel_registerName(b'sharedWorkspace')
    _sel_frontmostApp = objc.sel_registerName(b'frontmostApplication')
    _sel_locName = objc.sel_registerName(b'localizedName')
    _sel_utf8 = objc.sel_registerName(b'UTF8String')

# Setup CoreGraphics
if cg:
    cg.CGEventSourceSecondsSinceLastEventType.restype = c_double
    cg.CGEventSourceSecondsSinceLastEventType.argtypes = [c_int, c_uint32]

def get_frontmost_app():
    if not (objc and appkit and _NSWorkspace):
        return "Unknown"
    try:
        ws = objc.objc_msgSend(_NSWorkspace, _sel_sharedWorkspace)
        if not ws:
            return "Finder"
        app = objc.objc_msgSend(ws, _sel_frontmostApp)
        if not app:
            return "Finder"
        name_obj = objc.objc_msgSend(app, _sel_locName)
        if not name_obj:
            return "Finder"
        utf8_str = objc.objc_msgSend(name_obj, _sel_utf8)
        if not utf8_str:
            return "Finder"
        val = ctypes.cast(utf8_str, c_char_p).value
        return val.decode('utf-8', errors='replace') if val else "Finder"
    except Exception:
        return "Finder"

def get_idle_seconds():
    if not cg:
        return 0
    try:
        sec_click = cg.CGEventSourceSecondsSinceLastEventType(0, 1) # LeftMouseDown
        sec_key = cg.CGEventSourceSecondsSinceLastEventType(0, 10) # KeyDown
        sec_move = cg.CGEventSourceSecondsSinceLastEventType(0, 5) # MouseMoved
        
        min_sec = min(sec_click, sec_key, sec_move)
        if min_sec < 0 or min_sec > 86400 * 30:
            return 0
        return int(min_sec)
    except Exception:
        return 0

def main():
    if not cg:
        sys.stderr.write("[macos-tracker] CoreGraphics not available.\n")
        return

    # Initialize previous event timestamps
    prev_left = cg.CGEventSourceSecondsSinceLastEventType(0, 1)
    prev_right = cg.CGEventSourceSecondsSinceLastEventType(0, 3)
    prev_other = cg.CGEventSourceSecondsSinceLastEventType(0, 25)
    prev_key = cg.CGEventSourceSecondsSinceLastEventType(0, 10)

    clicks_accum = 0
    keys_accum = 0

    last_tick_time = time.time()

    while True:
        try:
            time.sleep(0.02) # 50Hz high-frequency poll (20ms)

            cur_left = cg.CGEventSourceSecondsSinceLastEventType(0, 1)
            cur_right = cg.CGEventSourceSecondsSinceLastEventType(0, 3)
            cur_other = cg.CGEventSourceSecondsSinceLastEventType(0, 25)
            cur_key = cg.CGEventSourceSecondsSinceLastEventType(0, 10)

            # Left Click detection
            if cur_left < prev_left or (cur_left < 0.025 and prev_left >= 0.020):
                clicks_accum += 1

            # Right Click detection
            if cur_right < prev_right or (cur_right < 0.025 and prev_right >= 0.020):
                clicks_accum += 1

            # Middle/Other Click detection
            if cur_other < prev_other or (cur_other < 0.025 and prev_other >= 0.020):
                clicks_accum += 1

            # Keystroke detection
            if cur_key < prev_key or (cur_key < 0.025 and prev_key >= 0.020):
                keys_accum += 1

            prev_left = cur_left
            prev_right = cur_right
            prev_other = cur_other
            prev_key = cur_key

            now = time.time()
            # 1-second output tick
            if now - last_tick_time >= 1.0:
                idle = get_idle_seconds()
                app = get_frontmost_app()

                # Output line: idleSeconds|appName|clicks|keys
                out_line = f"{idle}|{app}|{clicks_accum}|{keys_accum}\n"
                sys.stdout.write(out_line)
                sys.stdout.flush()

                clicks_accum = 0
                keys_accum = 0
                last_tick_time = now

        except Exception as e:
            sys.stdout.write("0|Unknown|0|0\n")
            sys.stdout.flush()
            time.sleep(1)

if __name__ == '__main__':
    main()
