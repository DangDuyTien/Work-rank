#!/usr/bin/env python3
"""
WorkRank macOS Computer Activity Telemetry Streamer
Outputs a stream of 1-second records on stdout:
  idleSeconds|appName|clicks|keys

- Uses CoreGraphics CGEventTap (Listen-Only) for exact real-time click and keystroke counts.
- Uses CoreGraphics CGEventSourceSecondsSinceLastEventType and IOHIDSystem as seamless fallback.
- Uses NSWorkspace for instantaneous frontmost application tracking.
- ZERO keylogging: strictly counts events, never records keystroke characters or text.
"""

import sys
import time
import threading
import ctypes
from ctypes import c_void_p, c_char_p, c_uint32, c_uint64, c_int, c_double, c_bool, CFUNCTYPE

_clicks_delta = 0
_keys_delta = 0
_lock = threading.Lock()

def _init():
    try:
        cg = ctypes.cdll.LoadLibrary('/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics')
        cf = ctypes.cdll.LoadLibrary('/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation')
        appkit = ctypes.cdll.LoadLibrary('/System/Library/Frameworks/AppKit.framework/AppKit')
        objc = ctypes.cdll.LoadLibrary('/usr/lib/libobjc.A.dylib')
        return cg, cf, appkit, objc
    except Exception as e:
        sys.stderr.write(f"[macos-tracker] Framework load error: {e}\n")
        return None, None, None, None

cg, cf, appkit, objc = _init()

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

# Setup CoreGraphics & CoreFoundation signatures
if cg and cf:
    cg.CGEventSourceSecondsSinceLastEventType.restype = c_double
    cg.CGEventSourceSecondsSinceLastEventType.argtypes = [c_int, c_uint32]

    CGEventTapCallBack = CFUNCTYPE(c_void_p, c_void_p, c_uint32, c_void_p, c_void_p)

    cg.CGEventTapCreate.restype = c_void_p
    cg.CGEventTapCreate.argtypes = [c_uint32, c_uint32, c_uint32, c_uint64, CGEventTapCallBack, c_void_p]

    cf.CFMachPortCreateRunLoopSource.restype = c_void_p
    cf.CFMachPortCreateRunLoopSource.argtypes = [c_void_p, c_void_p, c_int]

    cf.CFRunLoopGetCurrent.restype = c_void_p
    cf.CFRunLoopAddSource.argtypes = [c_void_p, c_void_p, c_void_p]
    cg.CGEventTapEnable.argtypes = [c_void_p, c_bool]

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

def _callback(proxy, type_id, event, refcon):
    global _clicks_delta, _keys_delta
    # 1: LeftMouseDown, 3: RightMouseDown, 25: OtherMouseDown
    if type_id in (1, 3, 25):
        with _lock:
            _clicks_delta += 1
    # 10: KeyDown
    elif type_id == 10:
        with _lock:
            _keys_delta += 1
    return event

_cb_holder = CGEventTapCallBack(_callback) if (cg and cf) else None

def _start_event_tap_loop():
    if not (cg and cf and _cb_holder):
        return
    try:
        # mask for LeftMouseDown(1), RightMouseDown(3), OtherMouseDown(25), KeyDown(10)
        mask = (1 << 1) | (1 << 3) | (1 << 25) | (1 << 10)
        tap = cg.CGEventTapCreate(
            0, # kCGHIDEventTap
            0, # kCGHeadInsertEventTap
            1, # kCGEventTapOptionListenOnly
            c_uint64(mask),
            _cb_holder,
            None
        )
        if not tap:
            return

        run_loop_source = cf.CFMachPortCreateRunLoopSource(None, tap, 0)
        if not run_loop_source:
            return

        current_run_loop = cf.CFRunLoopGetCurrent()
        kCFRunLoopCommonModes = c_void_p.in_dll(cf, 'kCFRunLoopCommonModes')
        cf.CFRunLoopAddSource(current_run_loop, run_loop_source, kCFRunLoopCommonModes)
        cg.CGEventTapEnable(tap, True)

        cf.CFRunLoopRun()
    except Exception as e:
        sys.stderr.write(f"[macos-tracker] Event loop error: {e}\n")

def main():
    tap_thread = threading.Thread(target=_start_event_tap_loop, daemon=True)
    tap_thread.start()

    last_click_sec_ago = 9999.0
    last_key_sec_ago = 9999.0

    while True:
        try:
            idle = get_idle_seconds()
            app = get_frontmost_app()

            global _clicks_delta, _keys_delta
            with _lock:
                clicks = _clicks_delta
                keys = _keys_delta
                _clicks_delta = 0
                _keys_delta = 0

            # Fallback estimation if event tap didn't catch (e.g. initial setup)
            if cg and clicks == 0 and keys == 0 and idle == 0:
                cur_click_sec = cg.CGEventSourceSecondsSinceLastEventType(0, 1)
                cur_key_sec = cg.CGEventSourceSecondsSinceLastEventType(0, 10)
                
                if cur_click_sec < 1.0 and cur_click_sec <= last_click_sec_ago + 0.15:
                    clicks = 1
                if cur_key_sec < 1.0 and cur_key_sec <= last_key_sec_ago + 0.15:
                    keys = 2

                last_click_sec_ago = cur_click_sec
                last_key_sec_ago = cur_key_sec

            # Output formatted line
            sys.stdout.write(f"{idle}|{app}|{clicks}|{keys}\n")
            sys.stdout.flush()
        except Exception:
            sys.stdout.write("0|Unknown|0|0\n")
            sys.stdout.flush()

        time.sleep(1)

if __name__ == '__main__':
    main()
