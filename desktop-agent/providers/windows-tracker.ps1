# WorkRank Windows Computer Activity Telemetry Helper
# Lightweight Win32 API loop: reads idle seconds, active process name, click and keystroke counts.

$win32TypeDef = @"
using System;
using System.Runtime.InteropServices;
using System.Diagnostics;

public class WorkRankWin32 {
    [DllImport("user32.dll")]
    public static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    public static extern short GetAsyncKeyState(int vKey);

    [StructLayout(LayoutKind.Sequential)]
    public struct LASTINPUTINFO {
        public uint cbSize;
        public uint dwTime;
    }

    private static bool[] prevKeyStates = new bool[256];
    private static bool[] prevMouseStates = new bool[6];

    public static uint GetIdleSeconds() {
        LASTINPUTINFO lii = new LASTINPUTINFO();
        lii.cbSize = (uint)Marshal.SizeOf(lii);
        if (GetLastInputInfo(ref lii)) {
            uint tickCount = (uint)Environment.TickCount;
            return (tickCount - lii.dwTime) / 1000;
        }
        return 0;
    }

    public static string GetActiveProcessName() {
        IntPtr hwnd = GetForegroundWindow();
        if (hwnd == IntPtr.Zero) return "Desktop";
        uint pid;
        GetWindowThreadProcessId(hwnd, out pid);
        try {
            return Process.GetProcessById((int)pid).ProcessName;
        } catch {
            return "Unknown";
        }
    }

    public static void PollDeltas(out int clicks, out int keys) {
        clicks = 0;
        keys = 0;

        // Mouse buttons: 1=Left, 2=Right, 4=Middle
        int[] mouseKeys = new int[] { 0x01, 0x02, 0x04 };
        for (int i = 0; i < mouseKeys.Length; i++) {
            int vk = mouseKeys[i];
            bool isDown = (GetAsyncKeyState(vk) & 0x8000) != 0;
            if (isDown && !prevMouseStates[i]) {
                clicks++;
            }
            prevMouseStates[i] = isDown;
        }

        // Keyboard keys: 0x08 (Backspace) .. 0xFE
        for (int vk = 0x08; vk <= 0xFE; vk++) {
            if (vk == 0x01 || vk == 0x02 || vk == 0x04) continue;
            bool isDown = (GetAsyncKeyState(vk) & 0x8000) != 0;
            if (isDown && !prevKeyStates[vk]) {
                keys++;
            }
            prevKeyStates[vk] = isDown;
        }
    }
}
"@

try {
    Add-Type -TypeDefinition $win32TypeDef -ErrorAction Stop
} catch {
    # If already compiled in current session, ignore
}

while ($true) {
    try {
        $totalClicks = 0
        $totalKeys = 0

        # High-frequency poll (10 ticks x 100ms = 1s total window)
        for ($i = 0; $i -lt 10; $i++) {
            $c = 0
            $k = 0
            [WorkRankWin32]::PollDeltas([ref]$c, [ref]$k)
            $totalClicks += $c
            $totalKeys += $k
            Start-Sleep -Milliseconds 100
        }

        $idle = [WorkRankWin32]::GetIdleSeconds()
        $proc = [WorkRankWin32]::GetActiveProcessName()

        Write-Output "$idle|$proc|$totalClicks|$totalKeys"
        [Console]::Out.Flush()
    } catch {
        Write-Output "0|Unknown|0|0"
        [Console]::Out.Flush()
        Start-Sleep -Seconds 1
    }
}
